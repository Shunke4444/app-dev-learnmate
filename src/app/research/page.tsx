"use client";

import { useMemo, useState } from "react";
import { Paperclip, Send, Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";

type Suggestion = {
  type: "Spelling" | "Grammar";
  original: string;
  replacement: string;
};

const seed: Suggestion[] = [
  { type: "Spelling", original: "independant", replacement: "independent" },
  { type: "Grammar", original: "a cows", replacement: "cows" },
  { type: "Spelling", original: "to less", replacement: "to lose" },
  { type: "Grammar", original: "been", replacement: "been" },
  { type: "Spelling", original: "among", replacement: "among" },
];

export default function ResearchPage() {
  const [text, setText] = useState("");
  const [accepted, setAccepted] = useState<Record<number, boolean | null>>({});

  const score = useMemo(() => {
    const decided = Object.values(accepted).filter((v) => v != null).length;
    const base = 70;
    return Math.max(0, Math.min(100, base + decided * 3));
  }, [accepted]);

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-[1100px]">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-[var(--radius-card)] bg-surface/45 p-6 ring-1 ring-white/5 backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Research Project</h1>
                <p className="mt-2 text-sm text-muted">
                  Paste or upload content, then run an AI assist pass for suggestions.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-bg/35 px-3 py-1.5 text-xs ring-1 ring-white/5">
                <span className="text-muted">Score</span>
                <span className="font-semibold text-foreground">{score}/100</span>
              </div>
            </div>

            <div className="mt-5 rounded-2xl bg-bg/35 ring-1 ring-white/5">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="min-h-[360px] w-full resize-y bg-transparent px-4 py-4 text-sm leading-relaxed text-foreground placeholder:text-muted/80 outline-none"
                placeholder="Type or paste your project here..."
              />
              <div className="flex items-center justify-between gap-3 border-t border-white/5 px-3 py-3">
                <button
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-surface/60 text-foreground ring-1 ring-white/5 hover:bg-surface"
                  type="button"
                  aria-label="Attach"
                  disabled
                  aria-disabled
                >
                  <Paperclip size={18} />
                </button>
                <button
                  className="inline-flex items-center gap-2 rounded-2xl bg-teal px-4 py-2 text-sm font-medium text-black ring-1 ring-white/10 hover:brightness-95"
                  type="button"
                  disabled
                  aria-disabled
                >
                  <Sparkles size={16} />
                  AI Assist
                  <Send size={16} className="opacity-80" />
                </button>
              </div>
            </div>
          </section>

          <aside className="rounded-[var(--radius-card)] bg-surface/45 p-6 ring-1 ring-white/5 backdrop-blur">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Suggestions</div>
              <div className="text-xs text-muted">30/100</div>
            </div>

            <div className="mt-4 flex flex-col gap-3">
              {seed.map((s, idx) => {
                const decision = accepted[idx] ?? null;
                return (
                  <div key={idx} className="rounded-2xl bg-bg/35 p-4 ring-1 ring-white/5">
                    <div className="text-[11px] font-semibold text-muted">{s.type} mistake</div>
                    <div className="mt-2 text-sm">
                      Fix <span className="text-red">{s.original}</span> to{" "}
                      <span className="text-green">{s.replacement}</span>
                    </div>

                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setAccepted((a) => ({ ...a, [idx]: true }))}
                        className={
                          "inline-flex h-9 flex-1 items-center justify-center rounded-2xl text-sm font-medium ring-1 transition " +
                          (decision === true
                            ? "bg-green/90 text-black ring-white/10"
                            : "bg-surface/60 text-foreground ring-white/5 hover:bg-surface")
                        }
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        onClick={() => setAccepted((a) => ({ ...a, [idx]: false }))}
                        className={
                          "inline-flex h-9 flex-1 items-center justify-center rounded-2xl text-sm font-medium ring-1 transition " +
                          (decision === false
                            ? "bg-red/40 text-foreground ring-white/10"
                            : "bg-surface/60 text-foreground ring-white/5 hover:bg-surface")
                        }
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
