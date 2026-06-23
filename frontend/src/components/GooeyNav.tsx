import { useEffect, useMemo, useRef, useState } from "react";
import "./GooeyNav.css";

export type GooeyNavItem = {
  label: string;
  /** A stable key to track active state (usually a pathname like "/learning"). */
  key: string;
  onSelect: () => void;
};

export type GooeyNavProps = {
  items: GooeyNavItem[];
  /** If provided, GooeyNav will highlight that item. Otherwise uses internal state. */
  activeKey?: string;
  animationTime?: number;
  particleCount?: number;
  particleDistances?: [number, number];
  particleR?: number;
  timeVariance?: number;
  colors?: number[];
};

function noise(n = 1): number {
  return n / 2 - Math.random() * n;
}

function getXY(distance: number, pointIndex: number, totalPoints: number): [number, number] {
  const angle = ((360 + noise(8)) / totalPoints) * pointIndex * (Math.PI / 180);
  return [distance * Math.cos(angle), distance * Math.sin(angle)];
}

export default function GooeyNav({
  items,
  activeKey,
  animationTime = 600,
  particleCount = 15,
  particleDistances = [90, 10],
  particleR = 100,
  timeVariance = 300,
  colors = [1, 2, 3, 1, 2, 3, 1, 4],
}: GooeyNavProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const navRef = useRef<HTMLElement | null>(null);
  const filterRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLDivElement | null>(null);

  const derivedActiveIndex = useMemo(() => {
    if (!activeKey) return -1;
    return Math.max(
      0,
      items.findIndex((x) => x.key === activeKey)
    );
  }, [activeKey, items]);

  const [activeIndex, setActiveIndex] = useState(() => (derivedActiveIndex >= 0 ? derivedActiveIndex : 0));

  useEffect(() => {
    if (derivedActiveIndex >= 0) setActiveIndex(derivedActiveIndex);
  }, [derivedActiveIndex]);

  const createParticle = (i: number, t: number, d: [number, number], r: number) => {
    const rotateNoise = noise(r / 10);
    return {
      start: getXY(d[0], particleCount - i, particleCount),
      end: getXY(d[1] + noise(7), particleCount - i, particleCount),
      time: t,
      scale: 1 + noise(0.2),
      color: colors[Math.floor(Math.random() * colors.length)] ?? 1,
      rotate: rotateNoise > 0 ? (rotateNoise + r / 20) * 10 : (rotateNoise - r / 20) * 10,
    };
  };

  const makeParticles = (element: HTMLElement) => {
    const d: [number, number] = particleDistances;
    const r = particleR;
    const bubbleTime = animationTime * 2 + timeVariance;
    element.style.setProperty("--time", `${bubbleTime}ms`);

    for (let i = 0; i < particleCount; i++) {
      const t = animationTime * 2 + noise(timeVariance * 2);
      const p = createParticle(i, t, d, r);
      element.classList.remove("active");

      window.setTimeout(() => {
        const particle = document.createElement("span");
        const point = document.createElement("span");
        particle.classList.add("particle");
        particle.style.setProperty("--start-x", `${p.start[0]}px`);
        particle.style.setProperty("--start-y", `${p.start[1]}px`);
        particle.style.setProperty("--end-x", `${p.end[0]}px`);
        particle.style.setProperty("--end-y", `${p.end[1]}px`);
        particle.style.setProperty("--time", `${p.time}ms`);
        particle.style.setProperty("--scale", `${p.scale}`);
        particle.style.setProperty("--color", `var(--color-${p.color}, white)`);
        particle.style.setProperty("--rotate", `${p.rotate}deg`);
        point.classList.add("point");
        particle.appendChild(point);
        element.appendChild(particle);
        requestAnimationFrame(() => element.classList.add("active"));
        window.setTimeout(() => {
          try {
            element.removeChild(particle);
          } catch {
            // ignore
          }
        }, t);
      }, 30);
    }
  };

  const updateEffectPosition = (element: HTMLElement) => {
    const container = containerRef.current;
    const filter = filterRef.current;
    const text = textRef.current;
    if (!container || !filter || !text) return;

    const containerRect = container.getBoundingClientRect();
    const pos = element.getBoundingClientRect();
    const styles: Partial<CSSStyleDeclaration> = {
      left: `${pos.x - containerRect.x}px`,
      top: `${pos.y - containerRect.y}px`,
      width: `${pos.width}px`,
      height: `${pos.height}px`,
    };
    Object.assign(filter.style, styles);
    Object.assign(text.style, styles);
    text.innerText = element.innerText;
  };

  const animateToIndex = (liEl: HTMLElement, index: number) => {
    if (activeIndex === index) return;
    setActiveIndex(index);
    updateEffectPosition(liEl);

    const filter = filterRef.current;
    const text = textRef.current;
    if (filter) {
      const particles = filter.querySelectorAll(".particle");
      particles.forEach((p) => filter.removeChild(p));
    }

    if (text) {
      text.classList.remove("active");
      void text.offsetWidth;
      text.classList.add("active");
    }

    if (filter) makeParticles(filter);
  };

  useEffect(() => {
    const nav = navRef.current;
    const container = containerRef.current;
    if (!nav || !container) return;

    const li = nav.querySelectorAll("li")[activeIndex] as HTMLElement | undefined;
    if (li) {
      updateEffectPosition(li);
      textRef.current?.classList.add("active");
    }

    const ro = new ResizeObserver(() => {
      const current = navRef.current?.querySelectorAll("li")[activeIndex] as HTMLElement | undefined;
      if (current) updateEffectPosition(current);
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [activeIndex]);

  return (
    <div ref={containerRef} className="gooey-nav-container" aria-label="Primary navigation">
      <div ref={filterRef} className="effect filter" aria-hidden />
      <div ref={textRef} className="effect text" aria-hidden />
      <nav ref={navRef}>
        <ul>
          {items.map((item, index) => {
            const isActive = index === activeIndex;
            return (
              <li
                key={item.key}
                className={isActive ? "active" : ""}
                onClick={(e) => {
                  animateToIndex(e.currentTarget, index);
                  item.onSelect();
                }}
              >
                <button
                  type="button"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      const liEl = e.currentTarget.parentElement;
                      if (liEl) {
                        animateToIndex(liEl, index);
                        item.onSelect();
                      }
                    }
                  }}
                >
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

