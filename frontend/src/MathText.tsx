import { InlineMath, BlockMath } from "react-katex";
import "katex/dist/katex.min.css";

type Segment = { type: "text" | "inline" | "block"; content: string };

/**
 * 将文本按 LaTeX 分段：支持 \(...\) 行内公式、\[...\] 或 $$...$$ 块级公式
 */
function parseMathSegments(text: string): Segment[] {
  const segments: Segment[] = [];
  let remaining = text;

  // 匹配 \(...\) 或 \[...\] 或 $$...$$
  const regex = /(\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]|\$\$[\s\S]*?\$\$)/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;

  while ((m = regex.exec(remaining)) !== null) {
    const before = remaining.slice(lastIndex, m.index);
    if (before) segments.push({ type: "text", content: before });

    const raw = m[1];
    if (raw.startsWith("\\(") && raw.endsWith("\\)")) {
      segments.push({ type: "inline", content: raw.slice(2, -2).trim() });
    } else if (raw.startsWith("\\[") && raw.endsWith("\\]")) {
      segments.push({ type: "block", content: raw.slice(2, -2).trim() });
    } else if (raw.startsWith("$$") && raw.endsWith("$$")) {
      segments.push({ type: "block", content: raw.slice(2, -2).trim() });
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
          try {
            return <InlineMath key={i} math={seg.content} />;
          } catch {
            return <span key={i}>{`\\(${seg.content}\\)`}</span>;
          }
        }
        if (seg.type === "block") {
          try {
            return (
              <span key={i} style={{ display: "block", margin: "0.5em 0" }}>
                <BlockMath math={seg.content} />
              </span>
            );
          } catch {
            return (
              <span key={i} style={{ display: "block" }}>{`\\[${seg.content}\\]`}</span>
            );
          }
        }
        return null;
      })}
    </span>
  );
}
