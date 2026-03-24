import React from "react";
import { InlineMath, BlockMath } from "react-katex";
import "katex/dist/katex.min.css";

type Segment = { type: "text" | "inline" | "block"; content: string };

function parseMathSegments(text: string): Segment[] {
  const segments: Segment[] = [];
  const regex =
    /(\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]|\$\$[\s\S]*?\$\$|\$(?!\$)([^$]*?)\$(?!\$))/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;

  while ((m = regex.exec(text)) !== null) {
    const before = text.slice(lastIndex, m.index);
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

  const after = text.slice(lastIndex);
  if (after) segments.push({ type: "text", content: after });
  if (!segments.length && text) segments.push({ type: "text", content: text });
  return segments;
}

/**
 * Render a plain-text string with basic markdown:
 *   **bold**  →  <strong>
 *   *italic*  →  <em>
 *   \n        →  <br/>
 */
function renderMarkdown(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // split by **...** first, then *...* inside the non-bold parts
  const boldRe = /\*\*(.+?)\*\*/g;
  let last = 0;
  let bm: RegExpExecArray | null;

  while ((bm = boldRe.exec(text)) !== null) {
    if (bm.index > last) {
      nodes.push(...renderItalic(text.slice(last, bm.index), nodes.length));
    }
    nodes.push(<strong key={`b${bm.index}`}>{renderItalic(bm[1], 0)}</strong>);
    last = boldRe.lastIndex;
  }
  if (last < text.length) {
    nodes.push(...renderItalic(text.slice(last), nodes.length));
  }
  return nodes;
}

function renderItalic(text: string, keyBase: number): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // match *text* but not ** (already consumed)
  const italicRe = /(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g;
  let last = 0;
  let im: RegExpExecArray | null;

  while ((im = italicRe.exec(text)) !== null) {
    if (im.index > last) {
      nodes.push(
        <React.Fragment key={`t${keyBase}_${im.index}`}>
          {text.slice(last, im.index)}
        </React.Fragment>
      );
    }
    nodes.push(<em key={`i${keyBase}_${im.index}`}>{im[1]}</em>);
    last = italicRe.lastIndex;
  }
  if (last < text.length) {
    nodes.push(
      <React.Fragment key={`t${keyBase}_${last}`}>
        {text.slice(last)}
      </React.Fragment>
    );
  }
  return nodes;
}

class MathErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: string },
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
          return <span key={i}>{renderMarkdown(seg.content)}</span>;
        }
        if (seg.type === "inline") {
          return (
            <MathErrorBoundary key={i} fallback={`\\(${seg.content}\\)`}>
              <InlineMath math={seg.content} />
            </MathErrorBoundary>
          );
        }
        if (seg.type === "block") {
          return (
            <MathErrorBoundary key={i} fallback={`\\[${seg.content}\\]`}>
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
