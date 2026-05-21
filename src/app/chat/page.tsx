"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { AppShell } from "@/components/AppShell";

type Msg = { role: "user" | "bot"; content: string };

export default function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "bot",
      content:
        "Hi. I’m LearnMate. This is a UI placeholder. Next: wire the chat input to the server AI proxy.",
    },
  ]);
  const [draft, setDraft] = useState("");

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-[1100px] flex-1 flex-col">
        <div className="flex-1 rounded-[var(--radius-card)] bg-surface/45 p-6 ring-1 ring-white/5 backdrop-blur">
          <h1 className="text-2xl font-semibold tracking-tight">Chat with Bot</h1>
          <p className="mt-2 text-sm text-muted">
            Text chat placeholder. Messages are not persisted yet.
          </p>

          <div className="mt-6 flex flex-col gap-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={
                  "max-w-[75ch] rounded-2xl px-4 py-3 text-sm ring-1 ring-white/5 " +
                  (m.role === "user"
                    ? "ml-auto bg-surface2/80"
                    : "bg-bg/35 text-foreground")
                }
              >
                <div className="text-[11px] font-semibold text-muted">
                  {m.role === "user" ? "You" : "Bot"}
                </div>
                <div className="mt-1 whitespace-pre-wrap leading-relaxed">
                  {m.content}
                </div>
              </div>
            ))}
          </div>
        </div>

        <form
          className="sticky bottom-0 mt-4 flex gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = draft.trim();
            if (!trimmed) return;
            setMessages((m) => [...m, { role: "user", content: trimmed }]);
            setDraft("");
          }}
        >
          <div className="flex-1 rounded-2xl bg-surface/45 ring-1 ring-white/5 backdrop-blur">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="h-12 w-full bg-transparent px-4 text-sm text-foreground placeholder:text-muted/80 outline-none"
              placeholder="Ask anything..."
              type="text"
            />
          </div>
          <button
            className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-purple text-black ring-1 ring-white/10 hover:brightness-95"
            type="submit"
            aria-label="Send"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </AppShell>
  );
}
