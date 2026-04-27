import { Color, Mesh, Program, Renderer, Triangle } from "ogl";
import { useEffect, useMemo, useRef } from "react";
import "./IridescenceBackground.css";

const vertexShader = `
attribute vec2 uv;
attribute vec2 position;

varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 0, 1);
}
`;

const fragmentShader = `
precision highp float;

uniform float uTime;
uniform vec3 uColor;
uniform vec3 uResolution;
uniform vec2 uMouse;
uniform float uAmplitude;
uniform float uSpeed;

varying vec2 vUv;

void main() {
  float mr = min(uResolution.x, uResolution.y);
  vec2 uv = (vUv.xy * 2.0 - 1.0) * uResolution.xy / mr;

  uv += (uMouse - vec2(0.5)) * uAmplitude;

  float d = -uTime * 0.5 * uSpeed;
  float a = 0.0;
  for (float i = 0.0; i < 8.0; ++i) {
    a += cos(i - d - a * uv.x);
    d += sin(uv.y * i + a);
  }
  d += uTime * 0.5 * uSpeed;
  vec3 col = vec3(cos(uv * vec2(d, a)) * 0.6 + 0.4, cos(a + d) * 0.5 + 0.5);
  col = cos(col * cos(vec3(d, a, 2.5)) * 0.5 + 0.5) * uColor;
  gl_FragColor = vec4(col, 1.0);
}
`;

export type IridescenceBackgroundProps = {
  /** RGB each in [0..1]. */
  color?: [number, number, number];
  speed?: number;
  amplitude?: number;
  mouseReact?: boolean;
  className?: string;
};

function useDisableIridescence(): boolean {
  return useMemo(() => {
    if (typeof window === "undefined") return true;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
    const coarse = window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
    return reduced || coarse;
  }, []);
}

export default function IridescenceBackground({
  color = [1, 1, 1],
  speed = 1.0,
  amplitude = 0.1,
  mouseReact = true,
  className,
}: IridescenceBackgroundProps) {
  const disabled = useDisableIridescence();
  const ctnDom = useRef<HTMLDivElement | null>(null);
  const mousePos = useRef({ x: 0.5, y: 0.5 });

  useEffect(() => {
    if (disabled) return;
    const ctn = ctnDom.current;
    if (!ctn) return;

    const renderer = new Renderer();
    const gl = renderer.gl;
    gl.clearColor(1, 1, 1, 1);

    let program: Program | null = null;

    const resize = () => {
      const scale = 1;
      renderer.setSize(ctn.offsetWidth * scale, ctn.offsetHeight * scale);
      if (program) {
        program.uniforms.uResolution.value = new Color(
          gl.canvas.width,
          gl.canvas.height,
          gl.canvas.width / gl.canvas.height
        );
      }
    };

    window.addEventListener("resize", resize, false);
    resize();

    const geometry = new Triangle(gl);
    program = new Program(gl, {
      vertex: vertexShader,
      fragment: fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new Color(...color) },
        uResolution: {
          value: new Color(gl.canvas.width, gl.canvas.height, gl.canvas.width / gl.canvas.height),
        },
        uMouse: { value: new Float32Array([mousePos.current.x, mousePos.current.y]) },
        uAmplitude: { value: amplitude },
        uSpeed: { value: speed },
      },
    });

    const mesh = new Mesh(gl, { geometry, program });
    let animateId = 0;

    const update = (t: number) => {
      animateId = window.requestAnimationFrame(update);
      (program as Program).uniforms.uTime.value = t * 0.001;
      renderer.render({ scene: mesh });
    };
    animateId = window.requestAnimationFrame(update);
    ctn.appendChild(gl.canvas);

    const handleMouseMove = (e: MouseEvent) => {
      const rect = ctn.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = 1.0 - (e.clientY - rect.top) / rect.height;
      mousePos.current = { x, y };
      const uMouse = (program as Program).uniforms.uMouse.value as Float32Array;
      uMouse[0] = x;
      uMouse[1] = y;
    };
    if (mouseReact) {
      ctn.addEventListener("mousemove", handleMouseMove);
    }

    return () => {
      window.cancelAnimationFrame(animateId);
      window.removeEventListener("resize", resize);
      if (mouseReact) {
        ctn.removeEventListener("mousemove", handleMouseMove);
      }
      try {
        ctn.removeChild(gl.canvas);
      } catch {
        // ignore
      }
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [disabled, color, speed, amplitude, mouseReact]);

  if (disabled) return null;

  return <div ref={ctnDom} className={`iridescence-container${className ? ` ${className}` : ""}`} />;
}

