"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ComponentProps } from "react";

type AnchorProps = ComponentProps<"a">;
type CodeProps = ComponentProps<"code"> & { inline?: boolean };

export function Markdown({ children }: { children: string }) {
  return (
    <div className="lm-md text-sm leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children, ...rest }: AnchorProps) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-teal underline-offset-2 hover:underline"
              {...rest}
            >
              {children}
            </a>
          ),
          code: ({ inline, className, children, ...rest }: CodeProps) => {
            if (inline) {
              return (
                <code
                  className="rounded bg-black/35 px-1 py-0.5 font-mono text-[0.85em] text-teal ring-1 ring-white/10"
                  {...rest}
                >
                  {children}
                </code>
              );
            }
            return (
              <code className={className} {...rest}>
                {children}
              </code>
            );
          },
          pre: ({ children, ...rest }) => (
            <pre
              className="my-2 overflow-x-auto rounded-xl bg-black/45 p-3 font-mono text-[0.85em] ring-1 ring-white/10"
              {...rest}
            >
              {children}
            </pre>
          ),
          ul: ({ children, ...rest }) => (
            <ul className="my-2 ml-5 list-disc space-y-1 marker:text-muted" {...rest}>
              {children}
            </ul>
          ),
          ol: ({ children, ...rest }) => (
            <ol className="my-2 ml-5 list-decimal space-y-1 marker:text-muted" {...rest}>
              {children}
            </ol>
          ),
          li: ({ children, ...rest }) => (
            <li className="leading-relaxed" {...rest}>
              {children}
            </li>
          ),
          p: ({ children, ...rest }) => (
            <p className="my-1.5 first:mt-0 last:mb-0" {...rest}>
              {children}
            </p>
          ),
          h1: ({ children, ...rest }) => (
            <h1 className="mb-1.5 mt-3 text-base font-semibold tracking-tight first:mt-0" {...rest}>
              {children}
            </h1>
          ),
          h2: ({ children, ...rest }) => (
            <h2 className="mb-1.5 mt-3 text-[15px] font-semibold tracking-tight first:mt-0" {...rest}>
              {children}
            </h2>
          ),
          h3: ({ children, ...rest }) => (
            <h3 className="mb-1 mt-2 text-sm font-semibold tracking-tight first:mt-0" {...rest}>
              {children}
            </h3>
          ),
          strong: ({ children, ...rest }) => (
            <strong className="font-semibold text-foreground" {...rest}>
              {children}
            </strong>
          ),
          em: ({ children, ...rest }) => (
            <em className="italic" {...rest}>
              {children}
            </em>
          ),
          blockquote: ({ children, ...rest }) => (
            <blockquote
              className="my-2 border-l-2 border-teal/60 pl-3 text-foreground/80"
              {...rest}
            >
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-3 border-white/10" />,
          table: ({ children, ...rest }) => (
            <div className="my-2 overflow-x-auto">
              <table className="min-w-full text-left text-xs ring-1 ring-white/10" {...rest}>
                {children}
              </table>
            </div>
          ),
          th: ({ children, ...rest }) => (
            <th className="border-b border-white/10 bg-black/30 px-2 py-1 font-semibold" {...rest}>
              {children}
            </th>
          ),
          td: ({ children, ...rest }) => (
            <td className="border-b border-white/5 px-2 py-1" {...rest}>
              {children}
            </td>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
