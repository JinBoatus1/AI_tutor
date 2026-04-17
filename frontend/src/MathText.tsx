import React from "react";
import { InlineMath, BlockMath } from "react-katex";
import "katex/dist/katex.min.css";

type Segment = { type: "text" | "inline" | "block"; content: string };

/**
 * Split text into LaTeX segments.
 * Inline: \\(...\\) or $...$ (single $, not $$)
 * Block: \\[...\\] or $$...$$
 */
function parseMathSegments(text: string): Segment[] {
  const segments: Segment[] = [];
  let remaining = text;

  // Order: $$...$$, then \\(...\\) / \\[...\\], then $...$ (avoid splitting $$ as two $)
  const regex = /(\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]|\$\$[\s\S]*?\$\$|\$(?!\$)([^$]*?)\$(?!\$))/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;

  while ((m = regex.exec(remaining)) !== null) {
    const before = remaining.slice(lastIndex, m.index);
    if (before) segments.push({ type: "text", content: before });

    const raw = m[0];
    if (raw.startsWith("\\(") && raw.endsWith("\\)")) {
      segments.push({ type: "inline", content: raw.slice(2, -2).trim() });
    } else if (raw.startsWith("\\[") && raw.endsWith("\\]")) {
      segments.push({ type: "block", content: raw.slice(2, -2).trim() });
    } else if (raw.startsWith("$$") && raw.endsWith("$$")) {
      segments.push({ type: "block", content: raw.slice(2, -2).trim() });
    } else if (raw.startsWith("$") && raw.endsWith("$") && raw.length > 1) {
      segments.push({ type: "inline", content: raw.slice(1, -1).trim() });
    } else {
      segments.push({ type: "text", content: raw });
    }
    lastIndex = regex.lastIndex;
  }

  const after = remaining.slice(lastIndex);
  if (after) segments.push({ type: "text", content: after });

  if (!segments.length && text) segments.push({ type: "text", content: text });
  return segments;
}

/** On KaTeX error, show raw TeX so the whole message does not crash. */
class MathErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: string; inline?: boolean },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError = () => ({ hasError: true });
  render() {
    if (this.state.hasError) return <span>{this.props.fallback}</span>;
    return this.props.children;
  }
}

interface MathTextProps {
  children: string;
  style?: React.CSSProperties;
}

export default function MathText({ children, style }: MathTextProps) {
  const str = typeof children === "string" ? children : String(children ?? "");
  const segments = parseMathSegments(str);

  return (
    <span style={{ whiteSpace: "pre-wrap", ...style }}>
      {segments.map((seg, i) => {
        if (seg.type === "text") {
          return <span key={i}>{seg.content}</span>;
        }
        if (seg.type === "inline") {
          const fallback = `\\(${seg.content}\\)`;
          return (
            <MathErrorBoundary key={i} fallback={fallback}>
              <InlineMath math={seg.content} />
            </MathErrorBoundary>
          );
        }
        if (seg.type === "block") {
          const fallback = `\\[${seg.content}\\]`;
          return (
            <MathErrorBoundary key={i} fallback={fallback}>
              <span style={{ display: "block", margin: "0.5em 0" }}>
                <BlockMath math={seg.content} />
              </span>
            </MathErrorBoundary>
          );
        }
        return null;
      })}
    </span>
  );
}
