import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

/**
 * 若整段被包在 ``` / ```markdown 里，拆出正文（否则会整段当代码块显示）
 */
function unwrapMarkdownFences(text: string): string {
  const t = text.trim();
  const m = t.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$/i);
  if (m) return m[1].trim();
  return text;
}

/**
 * 将 \(...\) / \[...\] 转为 remark-math 识别的 $ / $$
 */
function normalizeMathDelimiters(text: string): string {
  let s = text;
  s = s.replace(/\\\[\s*([\s\S]*?)\\\]/g, (_, inner: string) => `$$\n${inner.trim()}\n$$`);
  s = s.replace(/\\\(\s*([\s\S]*?)\\\)/g, (_, inner: string) => `$${inner.trim()}$`);
  return s;
}

/**
 * 标题前若无换行则补上，便于解析 ## / ###
 */
function ensureHeaderNewlines(text: string): string {
  return text.replace(/([^\n])(#{1,6}\s)/g, "$1\n$2");
}

/**
 * AI 常把 GFM 表格多行挤成一行：| a | b || --- | --- | 拆成多行
 */
function splitSquashedTableRows(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      if (line.includes("|") && line.includes("||")) {
        return line.replace(/\|\|/g, "|\n|");
      }
      return line;
    })
    .join("\n");
}

function normalizeAiMarkdown(raw: string): string {
  let s = unwrapMarkdownFences(raw);
  s = normalizeMathDelimiters(s);
  s = splitSquashedTableRows(s);
  s = ensureHeaderNewlines(s);
  return s;
}

export interface MarkdownMessageProps {
  children: string;
  className?: string;
}

/**
 * 聊天气泡：Markdown（GFM 表格、粗体、标题等）+ KaTeX（$...$ / $$...$$）
 */
export default function MarkdownMessage({ children, className }: MarkdownMessageProps) {
  const raw = typeof children === "string" ? children : String(children ?? "");
  const content = useMemo(() => normalizeAiMarkdown(raw), [raw]);

  return (
    <div className={className ?? "markdown-message"}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: true }]]}
        rehypePlugins={[
          [
            rehypeKatex,
            {
              strict: false,
              throwOnError: false,
              trust: true,
            },
          ],
        ]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
