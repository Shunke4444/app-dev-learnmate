"use client";

import { useState } from "react";
import { AppShell } from "@/components/AppShell";

const q = {
  title: "Python Class Quiz",
  prompt: "What is the output of this code?",
  code: "print(3 * \"abc\")",
  options: ["abcabcabc", "3abc", "Error", "None"],
  answer: 0,
} as const;

export default function QuizPage() {
  const [picked, setPicked] = useState<number | null>(null);

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-[1100px]">
        <div className="rounded-[var(--radius-card)] bg-surface/45 p-6 ring-1 ring-white/5 backdrop-blur">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-semibold tracking-tight">{q.title}</h1>
              <p className="mt-2 text-sm text-muted">
                Placeholder quiz UI. Next: generate questions with strict JSON schema.
              </p>
            </div>
            <div className="hidden sm:block w-[220px]">
              <div className="h-2 rounded-full bg-bg/35 ring-1 ring-white/5">
                <div className="h-full w-[20%] rounded-full bg-green" />
              </div>
              <div className="mt-2 text-right text-xs text-muted">1/5</div>
            </div>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
            <div className="rounded-2xl bg-bg/35 p-5 ring-1 ring-white/5">
              <div className="text-sm font-semibold">{q.prompt}</div>
              <pre className="mt-4 overflow-auto rounded-2xl bg-black/35 p-4 text-sm ring-1 ring-white/5">
                <code>{q.code}</code>
              </pre>
            </div>

            <div className="flex flex-col gap-3">
              {q.options.map((opt, idx) => {
                const correct = idx === q.answer;
                const selected = picked === idx;
                const showResult = picked !== null;

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setPicked(idx)}
                    className={
                      "flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm ring-1 transition " +
                      (showResult
                        ? correct
                          ? "bg-green/90 text-black ring-white/10"
                          : selected
                            ? "bg-red/30 text-foreground ring-white/10"
                            : "bg-surface/40 text-foreground ring-white/5 hover:bg-surface/55"
                        : "bg-surface/40 text-foreground ring-white/5 hover:bg-surface/55")
                    }
                  >
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/25 text-xs font-semibold">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span className="min-w-0 truncate">{opt}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
