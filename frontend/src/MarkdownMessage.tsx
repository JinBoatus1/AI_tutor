import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

/**
 * 将原先 MathText 支持的 LaTeX 定界符转为 remark-math 可识别的形式，
 * 以便与 react-markdown 共用同一套数学渲染（rehype-katex）。
 */
function normalizeMathDelimiters(text: string): string {
  let s = text;
  // 块级：\[...\] -> $$...$$
  s = s.replace(/\\\[\s*([\s\S]*?)\\\]/g, (_, inner: string) => `$$\n${inner.trim()}\n$$`);
  // 行内：\(...\) -> $...$
  s = s.replace(/\\\(\s*([\s\S]*?)\\\)/g, (_, inner: string) => `$${inner.trim()}$`);
  return s;
}

export interface MarkdownMessageProps {
  children: string;
  className?: string;
}

/**
 * 聊天气泡内 Markdown（**粗体**、# 标题、列表、代码块、GFM 表格等）+ KaTeX 公式。
 */
export default function MarkdownMessage({ children, className }: MarkdownMessageProps) {
  const raw = typeof children === "string" ? children : String(children ?? "");
  const content = normalizeMathDelimiters(raw);

  return (
    <div className={className ?? "markdown-message"}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { strict: false, throwOnError: false }]]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
