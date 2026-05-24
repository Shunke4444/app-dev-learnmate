"use client";

import { useMemo, useRef, useState } from "react";
import {
  Check,
  FileText,
  Loader2,
  Paperclip,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import type { ResearchPayload, ResearchSuggestion } from "@/lib/ai/schemas";
import { saveResearchDoc } from "@/lib/db/sync";
import {
  insertResearchSuggestions,
  setSuggestionStatus,
} from "@/lib/db/research-suggestions";
import { parseFile, type ParsedAttachment } from "@/lib/attachments/parse";
import { saveResearchUpload, UploadError } from "@/lib/storage/uploads";

import { uid } from "@/lib/util/id";

type PendingAttachment = {
  id: string;
  file: File;
  parsed: ParsedAttachment;
  uploaded: boolean;
};

type Decision = "open" | "accepted" | "rejected";

type SuggestionRow = ResearchSuggestion & { id: string; status: Decision };

type ErrorState =
  | { kind: "none" }
  | { kind: "rate_limited" }
  | { kind: "missing_key" }
  | { kind: "generic"; message: string };

const typeTone: Record<ResearchSuggestion["type"], string> = {
  spelling: "bg-pink/15 text-pink ring-pink/25",
  grammar: "bg-purple/15 text-purple ring-purple/25",
  clarity: "bg-teal/15 text-teal ring-teal/25",
  style: "bg-lime/15 text-lime ring-lime/25",
};

export default function ResearchPage() {
  const [text, setText] = useState("");
  const [score, setScore] = useState<number | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [items, setItems] = useState<SuggestionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ErrorState>({ kind: "none" });
  const [tab, setTab] = useState<"editor" | "suggestions">("editor");
  const [docId, setDocId] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [attaching, setAttaching] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setAttaching(true);
    setError({ kind: "none" });
    try {
      for (const f of Array.from(files)) {
        try {
          const parsed = await parseFile(f);
          const entry: PendingAttachment = {
            id: uid(),
            file: f,
            parsed,
            uploaded: false,
          };
          setAttachments((cur) => [...cur, entry]);

          // Append parsed text into the draft so AI Assist can see it.
          if (parsed.text && parsed.kind !== "unsupported") {
            setText((cur) => {
              const block =
                `\n\n--- ${parsed.name} (${parsed.kind}${parsed.truncated ? ", truncated" : ""}) ---\n` +
                parsed.text +
                `\n--- end ${parsed.name} ---\n`;
              return cur ? cur + block : block.trimStart();
            });
          }

          // If we already have a docId (analyze ran), persist this blob now.
          if (docId) {
            try {
              await saveResearchUpload(docId, f, parsed.text);
              setAttachments((cur) =>
                cur.map((a) => (a.id === entry.id ? { ...a, uploaded: true } : a)),
              );
            } catch (e) {
              if (e instanceof UploadError && e.code !== "no_auth") {
                setError({
                  kind: "generic",
                  message: `Couldn't upload "${f.name}": ${e.message}`,
                });
              }
            }
          }
        } catch (e) {
          setError({
            kind: "generic",
            message: `Couldn't read "${f.name}": ${(e as Error).message}`,
          });
        }
      }
    } finally {
      setAttaching(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeAttachment(id: string) {
    setAttachments((cur) => cur.filter((a) => a.id !== id));
  }

  // After analyze creates a docId, flush any attachments that didn't have one yet.
  async function flushPendingUploads(id: string) {
    const pending = attachments.filter((a) => !a.uploaded);
    if (pending.length === 0) return;
    for (const a of pending) {
      try {
        await saveResearchUpload(id, a.file, a.parsed.text);
        setAttachments((cur) =>
          cur.map((x) => (x.id === a.id ? { ...x, uploaded: true } : x)),
        );
      } catch (e) {
        if (e instanceof UploadError && e.code !== "no_auth") {
          console.warn("research upload failed:", e);
        }
      }
    }
  }

  const wordCount = useMemo(
    () => (text.trim() ? text.trim().split(/\s+/).length : 0),
    [text],
  );
  const open = items.filter((s) => s.status === "open").length;

  async function analyze() {
    if (loading) return;
    const draft = text.trim();
    if (draft.length < 10) {
      setError({ kind: "generic", message: "Draft is too short — paste at least a sentence." });
      return;
    }
    setLoading(true);
    setError({ kind: "none" });

    try {
      const res = await fetch("/api/ai/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: draft }),
      });

      if (!res.ok) {
        let payload: { error?: string; message?: string } = {};
        try {
          payload = await res.json();
        } catch {
          // ignore
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
        return;
      }

      const data = (await res.json()) as ResearchPayload;
      setScore(data.score);
      setSummary(data.summary || null);

      // Persist the doc (or update if we already created one this session),
      // then store the new suggestions linked to it.
      let id = docId;
      try {
        const title = draft.split(/\s+/).slice(0, 6).join(" ").slice(0, 80) || "Research draft";
        const doc = await saveResearchDoc({
          title,
          text: draft,
          score: data.score,
          summary: data.summary || undefined,
        });
        id = String(doc.id);
        setDocId(id);
        await flushPendingUploads(id);
      } catch {
        // guest mode or write failure — fall through to local-only ids
      }

      let persisted: SuggestionRow[];
      if (id) {
        const rows = await insertResearchSuggestions(id, data.suggestions);
        persisted = rows.map((r) => ({
          type: r.type,
          original: r.original,
          replacement: r.replacement,
          explanation: r.explanation,
          id: r.id,
          status: r.status,
        }));
      } else {
        persisted = data.suggestions.map((s) => ({
          ...s,
          id: uid(),
          status: "open" as const,
        }));
      }
      setItems(persisted);
    } catch (e) {
      setError({ kind: "generic", message: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  function applyEdit(row: SuggestionRow) {
    // Replace the first verbatim match. If no match, mark accepted anyway.
    const idx = text.indexOf(row.original);
    if (idx !== -1) {
      const next = text.slice(0, idx) + row.replacement + text.slice(idx + row.original.length);
      setText(next);
    }
    setItems((arr) =>
      arr.map((s) => (s.id === row.id ? { ...s, status: "accepted" } : s)),
    );
    void setSuggestionStatus(row.id, "accepted");
  }

  function rejectEdit(row: SuggestionRow) {
    setItems((arr) =>
      arr.map((s) => (s.id === row.id ? { ...s, status: "rejected" } : s)),
    );
    void setSuggestionStatus(row.id, "rejected");
  }

  function reset() {
    setItems([]);
    setScore(null);
    setSummary(null);
    setError({ kind: "none" });
  }

  const editorPanel = (
    <section className="relative overflow-hidden rounded-[var(--radius-card)] bg-surface/45 p-5 ring-1 ring-white/5 backdrop-blur-xl lg:p-7">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-teal/12 blur-3xl"
      />

      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-teal text-black ring-1 ring-white/10 shadow-[0_12px_40px_-12px_rgba(52,224,196,0.55)]">
            <FileText size={18} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              Research Project
            </h1>
            <p className="mt-1 max-w-[60ch] text-sm text-muted">
              Paste your draft, then run an AI pass for spelling, grammar, clarity, and style.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-bg/35 px-3 py-1.5 text-xs ring-1 ring-white/5">
            <span className="text-muted">Score</span>
            <span className="font-semibold text-foreground">
              {score == null ? "—" : `${score}/100`}
            </span>
          </div>
        </div>
      </div>

      {summary && (
        <div className="relative mt-5 rounded-2xl bg-bg/30 px-4 py-3 text-xs leading-relaxed text-foreground/85 ring-1 ring-white/5">
          <span className="font-semibold text-foreground">Summary · </span>
          {summary}
        </div>
      )}

      {attachments.length > 0 && (
        <div className="relative mt-5 flex flex-wrap gap-2">
          {attachments.map((a) => (
            <span
              key={a.id}
              className="inline-flex items-center gap-2 rounded-full bg-bg/50 px-3 py-1.5 text-[11px] ring-1 ring-white/5"
            >
              <Paperclip size={12} className="text-teal" />
              <span className="max-w-[180px] truncate font-medium text-foreground/90">
                {a.parsed.name}
              </span>
              <span className="text-muted">
                {a.parsed.kind}
                {a.parsed.truncated ? " · truncated" : ""}
                {a.uploaded ? " · saved" : ""}
              </span>
              <button
                type="button"
                aria-label={`Remove ${a.parsed.name}`}
                onClick={() => removeAttachment(a.id)}
                className="ml-1 text-muted hover:text-foreground"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative mt-6 rounded-2xl bg-bg/40 ring-1 ring-white/5">
        <div className="flex items-center gap-2 border-b border-white/5 px-3 py-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            Draft
          </span>
          <span className="ml-auto text-[11px] text-muted">{wordCount} words</span>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="min-h-[320px] w-full resize-y bg-transparent px-4 py-4 text-sm leading-relaxed text-foreground placeholder:text-muted/80 outline-none lg:min-h-[420px]"
          placeholder="Type or paste your project here…"
        />
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 px-3 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.txt,.md,.csv,.json,.html,.xml,application/pdf,text/*,image/*"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={attaching}
              className="inline-flex items-center gap-2 rounded-2xl bg-surface/60 px-3.5 py-2 text-xs font-semibold text-foreground ring-1 ring-white/5 hover:bg-surface disabled:opacity-50"
            >
              {attaching ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Paperclip size={14} />
              )}
              Attach file
            </button>
            <button
              type="button"
              onClick={reset}
              disabled={items.length === 0 && score == null}
              className="inline-flex items-center gap-2 rounded-2xl bg-surface/60 px-3.5 py-2 text-xs font-semibold text-foreground ring-1 ring-white/5 hover:bg-surface disabled:opacity-50"
            >
              <Upload size={14} />
              Reset
            </button>
          </div>
          <button
            type="button"
            onClick={analyze}
            disabled={loading || text.trim().length < 10}
            className="inline-flex items-center gap-2 rounded-2xl bg-teal px-4 py-2.5 text-sm font-semibold text-black ring-1 ring-white/10 hover:brightness-95 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Analyzing…
              </>
            ) : (
              <>
                <Sparkles size={15} />
                AI Assist
              </>
            )}
          </button>
        </div>
      </div>

      {error.kind !== "none" && (
        <div className="relative mt-4 rounded-2xl bg-red/15 px-3 py-2.5 text-xs text-foreground ring-1 ring-red/30">
          {error.kind === "rate_limited" && (
            <>
              <strong>Bot is resting.</strong> Free model limit hit — try again in a moment.
            </>
          )}
          {error.kind === "missing_key" && (
            <>
              <strong>Set your key.</strong> Add <code>OPENROUTER_API_KEY</code> to{" "}
              <code>.env.local</code>, then restart <code>npm run dev</code>.
            </>
          )}
          {error.kind === "generic" && (
            <>
              <strong>Couldn&apos;t analyze.</strong>{" "}
              <span className="text-muted">{error.message}</span>
            </>
          )}
        </div>
      )}
    </section>
  );

  const suggestionsPanel = (
    <aside className="rounded-[var(--radius-card)] bg-surface/45 p-5 ring-1 ring-white/5 backdrop-blur-xl lg:p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles size={15} className="text-teal" />
          Suggestions
        </div>
        <div className="text-[11px] text-muted">
          {open} open · {items.length} total
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {items.length === 0 && (
          <div className="rounded-2xl bg-bg/30 px-3.5 py-3 text-xs text-muted ring-1 ring-white/5">
            Paste a draft and hit <strong>AI Assist</strong> — suggested edits will appear here.
          </div>
        )}

        {items.map((s) => {
          const handled = s.status !== "open";
          return (
            <div
              key={s.id}
              className={
                "rounded-2xl bg-bg/40 p-4 ring-1 ring-white/5 transition " +
                (handled ? "opacity-70" : "")
              }
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 " +
                    typeTone[s.type]
                  }
                >
                  {s.type}
                </span>
                {handled && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                    {s.status === "accepted" ? "Accepted" : "Rejected"}
                  </span>
                )}
              </div>

              <div className="mt-3 text-sm leading-relaxed">
                Replace{" "}
                <span className="rounded bg-red/15 px-1.5 py-0.5 text-red line-through decoration-red/60">
                  {s.original}
                </span>{" "}
                with{" "}
                <span className="rounded bg-green/15 px-1.5 py-0.5 font-semibold text-green">
                  {s.replacement}
                </span>
              </div>
              <p className="mt-2 text-[11px] italic text-muted">{s.explanation}</p>

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => applyEdit(s)}
                  disabled={handled}
                  className={
                    "inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-2xl text-xs font-semibold ring-1 transition disabled:opacity-60 " +
                    (s.status === "accepted"
                      ? "bg-green/90 text-black ring-white/15"
                      : "bg-surface/60 text-foreground ring-white/5 hover:bg-surface")
                  }
                >
                  <Check size={13} />
                  Accept
                </button>
                <button
                  type="button"
                  onClick={() => rejectEdit(s)}
                  disabled={handled}
                  className={
                    "inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-2xl text-xs font-semibold ring-1 transition disabled:opacity-60 " +
                    (s.status === "rejected"
                      ? "bg-red/35 text-foreground ring-red/30"
                      : "bg-surface/60 text-foreground ring-white/5 hover:bg-surface")
                  }
                >
                  <X size={13} />
                  Reject
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-[1180px]">
        <div className="mb-4 flex gap-2 lg:hidden">
          {(["editor", "suggestions"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={
                "flex-1 rounded-full px-3 py-2 text-xs font-semibold transition ring-1 " +
                (tab === t
                  ? "bg-foreground text-bg ring-foreground"
                  : "bg-surface/55 text-muted ring-white/5 hover:text-foreground")
              }
            >
              {t === "editor" ? "Editor" : `Suggestions · ${open}`}
            </button>
          ))}
        </div>

        <div className="hidden lg:grid lg:grid-cols-[1.15fr_0.85fr] lg:gap-6">
          <div className="lm-rise">{editorPanel}</div>
          <div className="lm-rise lm-rise-1">{suggestionsPanel}</div>
        </div>

        <div className="lg:hidden">
          <div className="lm-rise">{tab === "editor" ? editorPanel : suggestionsPanel}</div>
        </div>
      </div>
    </AppShell>
  );
}
