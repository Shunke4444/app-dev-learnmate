"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Loader2, Mic, Paperclip, Send, Sparkles, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Mascot } from "@/components/Mascot";
import { Markdown } from "@/components/Markdown";
import {
  appendMessage,
  getOrCreateChat,
  listMessages,
  maybeRenameChat,
  pruneEmptyMessages,
  type Chat,
  type Id,
} from "@/lib/db/sync";
import {
  attachToMessage,
  parseFile,
  type ParsedAttachment,
} from "@/lib/attachments/parse";

type Msg = {
  id?: Id;
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
};

const GREETING: Msg = {
  role: "assistant",
  content:
    "Hey! I'm LearnMate. Ask me anything — explain a concept, quiz you, or summarize a topic.",
};

const starters = [
  "Explain recursion with an analogy",
  "Make me a 5-question quiz on cells",
  "Summarize the Pythagorean theorem",
  "Help me outline my essay intro",
];

// Strip attachment blocks out of a stored user message so the bubble shows the
// natural question + a chip per file, instead of dumping raw PDF text inline.
function splitUserContent(text: string): {
  body: string;
  chips: { name: string; meta: string }[];
} {
  const re = /\n*--- attachment: (.+?) \(([^)]+)\) ---\n[\s\S]*?\n--- end attachment ---\n*/g;
  const chips: { name: string; meta: string }[] = [];
  const body = text
    .replace(re, (_, name: string, meta: string) => {
      chips.push({ name, meta });
      return "";
    })
    .trim();
  return { body, chips };
}

type ErrorState =
  | { kind: "none" }
  | { kind: "rate_limited" }
  | { kind: "missing_key" }
  | { kind: "generic"; message: string };

export default function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<ErrorState>({ kind: "none" });
  const [attachments, setAttachments] = useState<ParsedAttachment[]>([]);
  const [attaching, setAttaching] = useState(false);
  const chatRef = useRef<Chat | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Hydrate from Dexie on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const chat = await getOrCreateChat("chat");
        if (cancelled) return;
        chatRef.current = chat;
        await pruneEmptyMessages(chat.id!);
        const stored = await listMessages(chat.id!);
        if (cancelled) return;
        if (stored.length > 0) {
          setMessages(
            stored.map((m) => ({ id: m.id, role: m.role, content: m.text })),
          );
        }
      } catch (err) {
        // IndexedDB unavailable (private mode, etc.) — keep in-memory only.
        console.warn("Dexie hydrate failed:", err);
      }
    })();
    return () => {
      cancelled = true;
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setAttaching(true);
    setError({ kind: "none" });
    try {
      const parsed: ParsedAttachment[] = [];
      for (const f of Array.from(files)) {
        try {
          parsed.push(await parseFile(f));
        } catch (e) {
          setError({
            kind: "generic",
            message: `Couldn't read "${f.name}": ${(e as Error).message}`,
          });
        }
      }
      if (parsed.length) setAttachments((cur) => [...cur, ...parsed]);
    } finally {
      setAttaching(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeAttachment(idx: number) {
    setAttachments((cur) => cur.filter((_, i) => i !== idx));
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if ((!trimmed && attachments.length === 0) || streaming) return;
    setError({ kind: "none" });

    const composed = attachToMessage(trimmed || "Read the attached file(s).", attachments);
    const userMsg: Msg = { role: "user", content: composed };
    const placeholder: Msg = { role: "assistant", content: "", pending: true };

    // Optimistic UI.
    setMessages((m) => [...m, userMsg, placeholder]);
    setDraft("");
    setStreaming(true);

    const chat = chatRef.current;
    const isFirstUserMessage = !messages.some((m) => m.role === "user");
    if (chat?.id != null) {
      try {
        await appendMessage(chat.id, "user", composed);
        if (isFirstUserMessage) {
          void maybeRenameChat(chat.id, trimmed || composed);
        }
      } catch (err) {
        console.warn("Dexie write failed:", err);
      }
    }
    // Clear attachments after they're folded into the outgoing turn.
    setAttachments([]);

    // Build the conversation history sent to the model (drop greeting if it's the only thing).
    const history = [...messages, userMsg]
      .filter((m) => !(m.role === "assistant" && m.content === GREETING.content))
      .filter((m) => m.content.trim().length > 0)
      .map((m) => ({ role: m.role, content: m.content }));

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
        signal: controller.signal,
      });

      if (!res.ok) {
        let payload: { error?: string; message?: string } = {};
        try {
          payload = await res.json();
        } catch {
          // non-JSON body
        }
        const kind: ErrorState["kind"] =
          payload.error === "rate_limited" || res.status === 429
            ? "rate_limited"
            : payload.error === "missing_key" || res.status === 503
              ? "missing_key"
              : "generic";
        setError(
          kind === "generic"
            ? { kind, message: payload.message ?? `Error ${res.status}` }
            : { kind },
        );
        // Drop the failed placeholder.
        setMessages((m) => m.slice(0, -1));
        return;
      }

      if (!res.body) throw new Error("no response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const chunks: string[] = [];

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        chunks.push(decoder.decode(value, { stream: true }));
        const acc = chunks.join("");
        setMessages((m) => {
          const next = m.slice();
          const last = next[next.length - 1];
          if (last && last.role === "assistant") {
            next[next.length - 1] = { ...last, content: acc, pending: true };
          }
          return next;
        });
      }
      const acc = chunks.join("");

      // Persist assistant reply only if we got content.
      let assistantMsgId: Id | undefined;
      if (chat?.id != null && acc.trim().length > 0) {
        try {
          assistantMsgId = await appendMessage(chat.id, "assistant", acc);
        } catch (err) {
          console.warn("Message persist failed:", err);
        }
      }

      // Mark final.
      setMessages((m) => {
        const next = m.slice();
        const last = next[next.length - 1];
        if (last && last.role === "assistant") {
          next[next.length - 1] = { ...last, content: acc, pending: false, id: assistantMsgId };
        }
        return next;
      });
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") {
        setMessages((m) => m.slice(0, -1));
        return;
      }
      setError({ kind: "generic", message: (err as Error).message });
      setMessages((m) => m.slice(0, -1));
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  const showStarters = messages.length === 1 && messages[0]?.content === GREETING.content;

  return (
    <AppShell>
      <div className="mx-auto flex h-[calc(100dvh-205px)] w-full min-w-0 max-w-[1180px] flex-col gap-3 sm:gap-4 lg:h-[calc(100dvh-160px)]">
        <div className="lm-rise flex min-w-0 items-center gap-3 rounded-[var(--radius-card)] bg-surface/45 p-3 ring-1 ring-white/5 backdrop-blur sm:p-4">
          <div className="relative shrink-0">
            <Mascot state={streaming ? "speaking" : "idle"} size={40} />
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green ring-2 ring-bg" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">Chat with Bot</div>
            <div className="truncate text-[11px] text-muted">
              {streaming ? "Thinking…" : "Online · responds instantly"}
            </div>
          </div>
          <button
            type="button"
            className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full bg-bg/40 px-2.5 py-1.5 text-[11px] font-semibold text-foreground/80 ring-1 ring-white/5 hover:bg-bg/60"
          >
            <Sparkles size={13} className="text-purple" />
            <span className="hidden sm:inline">Bot · v1</span>
            <span className="sm:hidden">v1</span>
          </button>
        </div>

        <div className="lm-rise lm-rise-1 min-w-0 flex-1 overflow-hidden rounded-[var(--radius-card)] bg-surface/45 ring-1 ring-white/5 backdrop-blur">
          <div className="lm-scroll-hide flex h-full flex-col gap-4 overflow-y-auto p-3 sm:p-5 lg:p-7">
            {showStarters && (
              <div className="mt-1 flex flex-col items-center text-center sm:mt-2">
                <Mascot state="idle" size={64} className="lm-drift sm:hidden" />
                <Mascot state="idle" size={88} className="lm-drift hidden sm:block" />
                <h2 className="mt-4 text-base font-semibold tracking-tight sm:mt-5 sm:text-xl md:text-2xl">
                  What would you like to do next?
                </h2>
                <p className="mt-1.5 max-w-[44ch] text-xs text-muted sm:mt-2 sm:text-sm">
                  Pick a starter or type a question.
                </p>

                <div className="mt-4 grid w-full max-w-[640px] grid-cols-1 gap-2 sm:mt-5 md:grid-cols-2">
                  {starters.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="break-words rounded-2xl bg-bg/35 px-3 py-2.5 text-left text-xs font-medium text-foreground/90 ring-1 ring-white/5 hover:bg-bg/55 sm:px-4 sm:py-3"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => {
              const isUser = m.role === "user";
              return (
                <div
                  key={m.id ?? `tmp-${i}`}
                  className={
                    "flex items-end gap-2 " + (isUser ? "ml-auto flex-row-reverse" : "")
                  }
                >
                  {!isUser && (
                    <div className="shrink-0">
                      <Mascot state={m.pending ? "speaking" : "idle"} size={32} />
                    </div>
                  )}
                  {isUser && (
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-teal/90 text-[11px] font-bold text-black">
                      U
                    </div>
                  )}
                  <div
                    className={
                      "max-w-[80%] break-words rounded-2xl px-3 py-2.5 text-sm leading-relaxed ring-1 ring-white/5 sm:px-4 sm:py-3 " +
                      (isUser
                        ? "whitespace-pre-wrap rounded-br-md bg-teal text-black"
                        : "rounded-bl-md bg-bg/45 text-foreground")
                    }
                  >
                    {isUser ? (
                      (() => {
                        const { body, chips } = splitUserContent(m.content);
                        return (
                          <>
                            {chips.length > 0 && (
                              <div className="mb-1.5 flex flex-wrap gap-1">
                                {chips.map((c, ci) => (
                                  <span
                                    key={ci}
                                    className="inline-flex items-center gap-1 rounded-full bg-black/15 px-2 py-0.5 text-[10px] font-semibold ring-1 ring-black/20"
                                  >
                                    <FileText size={10} />
                                    <span className="max-w-[160px] truncate">{c.name}</span>
                                  </span>
                                ))}
                              </div>
                            )}
                            {body ||
                              (chips.length > 0 ? (
                                <span className="italic text-black/70">[attachments]</span>
                              ) : null)}
                          </>
                        );
                      })()
                    ) : m.content ? (
                      <Markdown>{m.content}</Markdown>
                    ) : m.pending ? (
                      "…"
                    ) : (
                      ""
                    )}
                    {!isUser && m.pending && m.content ? (
                      <span className="ml-0.5 inline-block h-3 w-1.5 translate-y-0.5 animate-pulse rounded-sm bg-teal/80" />
                    ) : null}
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>
        </div>

        {error.kind !== "none" && (
          <div className="lm-rise flex min-w-0 items-start gap-2 rounded-2xl bg-red/15 px-3 py-2.5 text-xs text-foreground ring-1 ring-red/30 sm:text-sm">
            <Mascot state="idle" size={24} />
            <div className="min-w-0 flex-1">
              {error.kind === "rate_limited" && (
                <>
                  <strong>Bot is resting.</strong> Free model limit hit — try again in a moment.
                </>
              )}
              {error.kind === "missing_key" && (
                <>
                  <strong>Set your key.</strong> Add{" "}
                  <code className="rounded bg-bg/60 px-1">OPENROUTER_API_KEY</code> to{" "}
                  <code className="rounded bg-bg/60 px-1">.env.local</code>, then restart{" "}
                  <code className="rounded bg-bg/60 px-1">npm run dev</code>.
                </>
              )}
              {error.kind === "generic" && (
                <>
                  <strong>Something went wrong.</strong>{" "}
                  <span className="text-muted">{error.message}</span>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => setError({ kind: "none" })}
              className="shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold text-foreground/80 hover:bg-bg/40"
            >
              Dismiss
            </button>
          </div>
        )}

        {attachments.length > 0 && (
          <div className="lm-rise flex min-w-0 flex-wrap gap-1.5">
            {attachments.map((a, i) => (
              <span
                key={`${a.name}-${i}`}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-bg/45 px-2.5 py-1 text-[11px] text-foreground/90 ring-1 ring-white/5"
              >
                <FileText size={11} className="text-teal" />
                <span className="max-w-[180px] truncate">{a.name}</span>
                <span className="text-[10px] text-muted">
                  {a.kind}
                  {a.truncated ? " · trunc." : ""}
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${a.name}`}
                  onClick={() => removeAttachment(i)}
                  className="rounded p-0.5 text-muted hover:bg-white/10 hover:text-foreground"
                >
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          accept=".txt,.md,.markdown,.csv,.tsv,.json,.xml,.yaml,.yml,.html,.htm,.log,.ini,.conf,.sql,.py,.js,.ts,.tsx,.jsx,.css,.sh,.pdf,application/pdf,text/*"
          onChange={(e) => handleFiles(e.target.files)}
        />

        <form
          className="lm-rise lm-rise-2 flex min-w-0 items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send(draft);
          }}
        >
          <div className="flex min-w-0 flex-1 items-center gap-0.5 rounded-3xl bg-surface/55 px-1.5 py-1.5 ring-1 ring-white/5 backdrop-blur sm:gap-1 sm:px-2 sm:py-2">
            <button
              type="button"
              aria-label="Attach"
              onClick={() => fileInputRef.current?.click()}
              disabled={attaching || streaming}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-muted hover:bg-white/5 hover:text-foreground disabled:opacity-50 sm:h-10 sm:w-10"
            >
              {attaching ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <Paperclip size={17} />
              )}
            </button>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={streaming}
              className="h-10 min-w-0 flex-1 bg-transparent px-1.5 text-sm text-foreground placeholder:text-muted/80 outline-none disabled:opacity-60 sm:h-11 sm:px-2"
              placeholder={streaming ? "Bot is responding…" : "Ask anything…"}
              type="text"
            />
            <button
              type="button"
              aria-label="Voice"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-muted hover:bg-white/5 hover:text-foreground sm:h-10 sm:w-10"
            >
              <Mic size={17} />
            </button>
          </div>
          {streaming ? (
            <button
              type="button"
              onClick={stop}
              aria-label="Stop"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red/90 text-white ring-1 ring-white/10 transition hover:brightness-95 active:scale-95 sm:h-12 sm:w-12"
            >
              <span className="block h-3 w-3 rounded-sm bg-white" />
            </button>
          ) : (
            <button
              type="submit"
              aria-label="Send"
              disabled={!draft.trim()}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-teal text-black ring-1 ring-white/10 transition hover:brightness-95 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 sm:h-12 sm:w-12"
            >
              <Send size={17} />
            </button>
          )}
        </form>
      </div>
    </AppShell>
  );
}
