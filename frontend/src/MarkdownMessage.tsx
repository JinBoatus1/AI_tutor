import { useMemo, type ComponentProps } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

/** If the reply is wrapped in ``` / ```markdown fences, unwrap so it is not one big code block. */
function unwrapMarkdownFences(text: string): string {
  const t = text.trim();
  const m = t.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$/i);
  if (m) return m[1].trim();
  return text;
}

/** Map \\(...\\) / \\[...\\] to remark-math $ / $$ delimiters. */
function normalizeMathDelimiters(text: string): string {
  let s = text;
  s = s.replace(/\\\[\s*([\s\S]*?)\\\]/g, (_, inner: string) => `$$\n${inner.trim()}\n$$`);
  s = s.replace(/\\\(\s*([\s\S]*?)\\\)/g, (_, inner: string) => `$${inner.trim()}$`);
  return s;
}

/** Ensure a newline before ## / ### so headers parse correctly. */
function ensureHeaderNewlines(text: string): string {
  return text.replace(/([^\n])(#{1,6}\s)/g, "$1\n$2");
}

/** Split squashed GFM tables where `||` glued rows together. */
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

/**
 * Turn consecutive outline lines like "8.1 Title (pp. …)" into a GFM list so list-item clicks work.
 */
function promoteOutlineLinesToList(text: string): string {
  const isOutlineLine = (line: string) => {
    const t = line.trim();
    if (!t) return false;
    return /^\d+(?:\.\d+)*\s+\S/.test(t);
  };
  const lines = text.split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    if (isOutlineLine(lines[i])) {
      const block: string[] = [];
      while (i < lines.length && isOutlineLine(lines[i])) {
        block.push(`- ${lines[i].trim()}`);
        i++;
      }
      out.push(block.join("\n"));
    } else {
      out.push(lines[i]);
      i++;
    }
  }
  return out.join("\n");
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
  /** If set, each list item becomes clickable to insert plain text (e.g. fill the chat input). */
  onPickLine?: (plainText: string) => void;
}

/** Chat bubble: Markdown (GFM, headings, etc.) + KaTeX ($...$ / $$...$$). */
export default function MarkdownMessage({
  children,
  className,
  onPickLine,
}: MarkdownMessageProps) {
  const raw = typeof children === "string" ? children : String(children ?? "");
  const content = useMemo(() => {
    let s = normalizeAiMarkdown(raw);
    if (onPickLine) s = promoteOutlineLinesToList(s);
    return s;
  }, [raw, onPickLine]);

  const components = useMemo(() => {
    if (!onPickLine) return undefined;

    const Li = (props: ComponentProps<"li"> & { node?: unknown }) => {
      const { children: liChildren, className: liClass, node: _node, ...rest } = props;
      return (
        <li {...rest} className={["markdown-pickable-li", liClass].filter(Boolean).join(" ")}>
          <span
            className="markdown-pickable-hit"
            role="button"
            tabIndex={0}
            title="Click to insert into the question box"
            onClick={(e) => {
              const t = (e.currentTarget as HTMLElement).textContent
                ?.replace(/\s+/g, " ")
                .trim();
              if (t) onPickLine(t);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                const t = (e.currentTarget as HTMLElement).textContent
                  ?.replace(/\s+/g, " ")
                  .trim();
                if (t) onPickLine(t);
              }
            }}
          >
            {liChildren}
          </span>
        </li>
      );
    };

    return { li: Li };
  }, [onPickLine]);

  const rootClass = [
    className ?? "markdown-message",
    onPickLine ? "markdown-message--pickable" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClass}>
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
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
