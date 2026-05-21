"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  CircleStop,
  Clock,
  Eraser,
  Headphones,
  Loader2,
  Mic,
  Plus,
  Save,
  Search,
  Sparkles,
  Wand2,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Waveform } from "@/components/Waveform";
import {
  createRecognition,
  isSupported as isSttSupported,
} from "@/lib/voice/recognition";
import { useMicLevel } from "@/lib/voice/waveform";
import {
  createNoteSession,
  listNoteSessions,
  updateNoteSession,
  type NoteSession,
} from "@/lib/db/dexie";

type AiAction = "summarize" | "redo" | null;

type ErrorState =
  | { kind: "none" }
  | { kind: "rate_limited" }
  | { kind: "missing_key" }
  | { kind: "generic"; message: string };

const SUMMARIZE_SYSTEM =
  "You are a study assistant. Summarize the user's lecture notes into a clean, bullet-style study sheet. " +
  "Use Markdown: short headings, tight bullet points, bold key terms. No filler.";

const REDO_SYSTEM =
  "You are a study assistant. Rewrite the user's raw transcript into clean, well-structured notes. " +
  "Use Markdown: headings, bullet points, fix grammar/typos, keep ALL the information.";

function groupBucket(now: number, ts: number) {
  const d = new Date(ts);
  const today = new Date(now);
  if (d.toDateString() === today.toDateString()) return "Today";
  const yest = new Date(today);
  yest.setDate(yest.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return "Yesterday";
  const diff = (today.getTime() - d.getTime()) / 86_400_000;
  if (diff < 7) return "This week";
  return "Earlier";
}

export default function NotesPage() {
  const [sessions, setSessions] = useState<NoteSession[]>([]);
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<NoteSession | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [interim, setInterim] = useState("");
  const [supportNote, setSupportNote] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    if (!isSttSupported())
      return "Voice capture isn't supported in this browser. Try Chrome, Edge, or Safari — or type your notes manually.";
    return null;
  });
  const [errorNote, setErrorNote] = useState<string | null>(null);
  const [aiAction, setAiAction] = useState<AiAction>(null);
  const [error, setError] = useState<ErrorState>({ kind: "none" });

  const recRef = useRef<ReturnType<typeof createRecognition> | null>(null);
  const liveTranscriptRef = useRef("");
  const { level: micLevel } = useMicLevel(capturing);

  useEffect(() => {
    refreshSessions();
    return () => {
      recRef.current?.stop();
    };
  }, []);

  async function refreshSessions() {
    try {
      const all = await listNoteSessions();
      setSessions(all);
    } catch (e) {
      console.warn("Dexie list failed:", e);
    }
  }

  async function newSession() {
    setError({ kind: "none" });
    setErrorNote(null);
    const title = window.prompt("Name this note session", "New Lecture");
    if (!title) return;
    const subject =
      window.prompt("Subject (e.g. Python, Biology, History)", "General") || "General";
    try {
      const s = await createNoteSession({ title, subject });
      setActive(s);
      liveTranscriptRef.current = "";
      setSessions((cur) => [s, ...cur]);
    } catch (e) {
      setErrorNote(`Couldn't create session: ${(e as Error).message}`);
    }
  }

  function startCapture() {
    if (!active) return;
    if (!isSttSupported()) {
      setSupportNote("Voice listening isn't supported here.");
      return;
    }
    if (!recRef.current) {
      recRef.current = createRecognition({
        continuous: true,
        onPartial: (t) => setInterim(t),
        onFinal: async (t) => {
          if (!t) return;
          setInterim("");
          const next = (liveTranscriptRef.current + " " + t).trim();
          liveTranscriptRef.current = next;
          setActive((s) => (s ? { ...s, transcript: next } : s));
          if (active?.id != null) {
            try {
              await updateNoteSession(active.id, { transcript: next });
            } catch (e) {
              console.warn("Dexie write failed:", e);
            }
          }
        },
        onError: (code) => {
          if (code === "no-speech") return;
          if (code === "not-allowed" || code === "service-not-allowed")
            setErrorNote("Mic permission denied. Allow microphone access and retry.");
          else setErrorNote(`Voice error: ${code}`);
          setCapturing(false);
        },
        onEnd: () => setInterim(""),
      });
    }
    liveTranscriptRef.current = active.transcript ?? "";
    setCapturing(true);
    recRef.current.start();
  }

  function stopCapture() {
    recRef.current?.stop();
    setCapturing(false);
    setInterim("");
  }

  async function saveSession() {
    if (!active?.id) return;
    try {
      await updateNoteSession(active.id, {
        transcript: liveTranscriptRef.current || active.transcript,
        status: "saved",
      });
      const fresh = await listNoteSessions();
      setSessions(fresh);
      setActive((s) => (s ? { ...s, status: "saved" } : s));
    } catch (e) {
      setErrorNote(`Couldn't save: ${(e as Error).message}`);
    }
  }

  async function runAi(action: Exclude<AiAction, null>) {
    if (!active?.id) return;
    const transcript = liveTranscriptRef.current || active.transcript;
    if (!transcript.trim()) {
      setErrorNote("Capture some notes first.");
      return;
    }
    setAiAction(action);
    setError({ kind: "none" });
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: action === "summarize" ? SUMMARIZE_SYSTEM : REDO_SYSTEM,
          messages: [
            {
              role: "user",
              content:
                (action === "summarize"
                  ? "Summarize these lecture notes:\n\n"
                  : "Rewrite these raw notes into clean, structured Markdown notes:\n\n") +
                transcript,
            },
          ],
        }),
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
      if (!res.body) {
        setError({ kind: "generic", message: "No stream body." });
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setActive((s) =>
          s ? { ...s, [action === "summarize" ? "summary" : "rewrite"]: acc } : s,
        );
      }
      if (active.id != null) {
        await updateNoteSession(active.id, {
          [action === "summarize" ? "summary" : "rewrite"]: acc,
        });
      }
    } catch (e) {
      setError({ kind: "generic", message: (e as Error).message });
    } finally {
      setAiAction(null);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.subject.toLowerCase().includes(q) ||
        s.transcript.toLowerCase().includes(q),
    );
  }, [search, sessions]);

  const grouped = useMemo(() => {
    const buckets = new Map<string, NoteSession[]>();
    const now = Date.now();
    for (const s of filtered) {
      const key = s.status === "saved" ? "Saved" : groupBucket(now, s.updatedAt);
      const arr = buckets.get(key) ?? [];
      arr.push(s);
      buckets.set(key, arr);
    }
    return Array.from(buckets.entries());
  }, [filtered]);

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-[1180px]">
        <div className="lm-rise flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-blue text-white ring-1 ring-white/10 shadow-[0_12px_40px_-12px_rgba(59,111,224,0.6)]">
              <BookOpen size={19} />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Notes</h1>
              <p className="mt-1 text-sm text-muted">
                Live transcripts, AI summaries, saved sessions — all stored locally.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={newSession}
            className="inline-flex items-center gap-2 rounded-2xl bg-teal px-4 py-2.5 text-sm font-semibold text-black ring-1 ring-white/10 hover:brightness-95"
          >
            <Plus size={16} />
            New note
          </button>
        </div>

        {active && (
          <ActiveSessionPanel
            session={active}
            interim={interim}
            capturing={capturing}
            micLevel={micLevel}
            onStart={startCapture}
            onStop={stopCapture}
            onSave={saveSession}
            onSummarize={() => runAi("summarize")}
            onRedo={() => runAi("redo")}
            aiAction={aiAction}
            error={error}
            errorNote={errorNote}
            supportNote={supportNote}
            onClose={() => {
              stopCapture();
              setActive(null);
              setErrorNote(null);
              refreshSessions();
            }}
          />
        )}

        {!active && (
          <section className="lm-rise lm-rise-1 mt-6 overflow-hidden rounded-[var(--radius-card)] bg-surface/45 p-5 ring-1 ring-white/5 backdrop-blur-xl lg:p-6">
            <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-bg/35 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted ring-1 ring-white/5">
                  <span className="h-1.5 w-1.5 rounded-full bg-muted" />
                  Ready
                </div>
                <h2 className="mt-3 text-xl font-semibold tracking-tight md:text-2xl">
                  Capture a lecture
                </h2>
                <p className="mt-2 max-w-[52ch] text-sm text-muted">
                  Press <strong>New note</strong> to name a session, then start recording.
                  I&apos;ll transcribe live, and offer to summarize or rewrite when you&apos;re done.
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={newSession}
                    className="inline-flex items-center gap-2 rounded-2xl bg-lime px-4 py-2.5 text-sm font-semibold text-black ring-1 ring-white/10 hover:brightness-95"
                  >
                    <Mic size={16} />
                    Take notes for my class
                  </button>
                  <button
                    type="button"
                    disabled
                    className="inline-flex items-center gap-2 rounded-2xl bg-surface/70 px-4 py-2.5 text-sm font-medium text-foreground ring-1 ring-white/5 opacity-50"
                    title="Coming soon"
                  >
                    <Headphones size={15} />
                    Upload audio
                  </button>
                </div>
                {supportNote && (
                  <p className="mt-4 rounded-2xl bg-bg/35 px-3 py-2 text-[11px] text-muted ring-1 ring-white/5">
                    {supportNote}
                  </p>
                )}
              </div>

              <div className="relative overflow-hidden rounded-2xl bg-bg/40 p-5 ring-1 ring-white/5">
                <div
                  aria-hidden
                  className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-teal/15 blur-3xl"
                />
                <div className="flex items-center justify-between text-[11px] text-muted">
                  <span>Idle</span>
                  <span>0 sessions today</span>
                </div>
                <div className="mt-3">
                  <Waveform active={false} bars={36} height={84} />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    disabled
                    className="rounded-xl bg-surface/60 py-2 text-[11px] font-semibold ring-1 ring-white/5 opacity-50"
                  >
                    Summarize
                  </button>
                  <button
                    type="button"
                    disabled
                    className="rounded-xl bg-surface/60 py-2 text-[11px] font-semibold ring-1 ring-white/5 opacity-50"
                  >
                    Make quiz
                  </button>
                  <button
                    type="button"
                    disabled
                    className="rounded-xl bg-surface/60 py-2 text-[11px] font-semibold ring-1 ring-white/5 opacity-50"
                  >
                    Rewrite
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        <div className="lm-rise lm-rise-2 mt-7 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Library</h3>
          <div className="flex items-center gap-2 rounded-2xl bg-surface/45 px-3 py-2 ring-1 ring-white/5">
            <Search size={14} className="text-muted" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes"
              className="w-[200px] bg-transparent text-xs text-foreground placeholder:text-muted/80 outline-none"
            />
          </div>
        </div>

        {grouped.length === 0 && (
          <div className="lm-rise lm-rise-3 mt-4 rounded-2xl bg-surface/35 px-5 py-8 text-center text-sm text-muted ring-1 ring-white/5">
            No notes yet. Start a session above.
          </div>
        )}

        {grouped.map(([bucket, list]) => (
          <div key={bucket} className="mt-5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              {bucket}
            </div>
            <div className="lm-rise lm-rise-3 mt-2 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {list.map((it) => (
                <article
                  key={it.id}
                  className="group relative flex flex-col overflow-hidden rounded-[var(--radius-card)] bg-surface/45 p-5 ring-1 ring-white/5 backdrop-blur lm-card-hover"
                >
                  <div
                    aria-hidden
                    className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-teal/15 blur-3xl opacity-60"
                  />
                  <div className="relative flex items-center gap-2 text-[11px] text-muted">
                    <Clock size={12} />
                    {new Date(it.updatedAt).toLocaleString()}
                    <span className="ml-auto rounded-full bg-bg/35 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-white/5">
                      {it.subject}
                    </span>
                  </div>
                  <h3 className="relative mt-3 text-lg font-semibold tracking-tight">
                    {it.title}
                  </h3>
                  <p className="relative mt-2 line-clamp-3 text-sm text-muted">
                    {it.transcript.trim() ? it.transcript : "No transcript yet."}
                  </p>
                  <div className="relative mt-4 flex items-center gap-2 text-[11px] text-muted">
                    <span>{it.transcript.trim().split(/\s+/).filter(Boolean).length} words</span>
                    {it.summary && (
                      <>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1">
                          <Sparkles size={11} className="text-teal" /> Summary
                        </span>
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setActive(it)}
                    className="relative mt-5 inline-flex items-center justify-center rounded-2xl bg-bg/45 px-4 py-2.5 text-xs font-semibold text-foreground/90 ring-1 ring-white/5 transition group-hover:bg-bg/65"
                  >
                    Open
                  </button>
                </article>
              ))}
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}

// -------------------- Active session --------------------

function ActiveSessionPanel(props: {
  session: NoteSession;
  interim: string;
  capturing: boolean;
  micLevel: number;
  onStart: () => void;
  onStop: () => void;
  onSave: () => void;
  onSummarize: () => void;
  onRedo: () => void;
  aiAction: AiAction;
  error: ErrorState;
  errorNote: string | null;
  supportNote: string | null;
  onClose: () => void;
}) {
  const s = props.session;
  const live = s.transcript + (props.interim ? `\n${props.interim}…` : "");
  const wordCount = (s.transcript.trim().split(/\s+/).filter(Boolean)).length;

  return (
    <section className="lm-rise lm-rise-1 mt-6 overflow-hidden rounded-[var(--radius-card)] bg-surface/45 p-5 ring-1 ring-white/5 backdrop-blur-xl lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div
            className={
              "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider ring-1 " +
              (props.capturing
                ? "bg-teal/15 text-teal ring-teal/30"
                : "bg-bg/35 text-muted ring-white/5")
            }
          >
            <span
              className={
                "h-1.5 w-1.5 rounded-full " +
                (props.capturing ? "bg-teal animate-pulse" : "bg-muted")
              }
            />
            {props.capturing ? "Capturing" : s.status === "saved" ? "Saved" : "Paused"}
          </div>
          <h2 className="mt-3 text-xl font-semibold tracking-tight md:text-2xl">{s.title}</h2>
          <p className="mt-1 text-xs text-muted">
            {s.subject} · {wordCount} words
          </p>
        </div>
        <button
          type="button"
          onClick={props.onClose}
          className="inline-flex items-center gap-2 rounded-full bg-bg/35 px-3 py-1.5 text-[11px] font-semibold text-muted ring-1 ring-white/5 hover:text-foreground"
        >
          Close session
        </button>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-2xl bg-bg/35 p-4 ring-1 ring-white/5">
          <div className="flex items-center justify-between text-[11px] text-muted">
            <span>Transcript</span>
            <span>{props.capturing ? "Live" : "Stopped"}</span>
          </div>
          <Waveform
            active={props.capturing}
            level={props.capturing ? props.micLevel : undefined}
            bars={36}
            height={64}
            className="mt-3"
          />
          <div className="lm-scroll-hide mt-3 max-h-[280px] overflow-y-auto whitespace-pre-wrap rounded-xl bg-black/20 px-3 py-3 text-sm leading-relaxed text-foreground/90 ring-1 ring-white/5">
            {live.trim() || (
              <span className="text-muted">
                Press <strong>Record</strong> and start speaking. Live transcript appears here.
              </span>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {props.capturing ? (
              <button
                type="button"
                onClick={props.onStop}
                className="inline-flex items-center gap-2 rounded-2xl bg-red px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/10 hover:brightness-95"
              >
                <CircleStop size={15} />
                Stop
              </button>
            ) : (
              <button
                type="button"
                onClick={props.onStart}
                className="inline-flex items-center gap-2 rounded-2xl bg-lime px-4 py-2.5 text-sm font-semibold text-black ring-1 ring-white/10 hover:brightness-95"
              >
                <Mic size={15} />
                Record
              </button>
            )}
            <button
              type="button"
              onClick={props.onSave}
              className="inline-flex items-center gap-2 rounded-2xl bg-blue px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/10 hover:brightness-95"
            >
              <Save size={15} />
              Save
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={props.onSummarize}
              disabled={props.aiAction !== null}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-teal px-3 py-2.5 text-sm font-semibold text-black ring-1 ring-white/10 hover:brightness-95 disabled:opacity-50"
            >
              {props.aiAction === "summarize" ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Sparkles size={14} />
              )}
              Summarize
            </button>
            <button
              type="button"
              onClick={props.onRedo}
              disabled={props.aiAction !== null}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-lime px-3 py-2.5 text-sm font-semibold text-black ring-1 ring-white/10 hover:brightness-95 disabled:opacity-50"
            >
              {props.aiAction === "redo" ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Wand2 size={14} />
              )}
              Rewrite
            </button>
          </div>

          {props.error.kind !== "none" && (
            <div className="rounded-2xl bg-red/15 px-3 py-2.5 text-xs text-foreground ring-1 ring-red/30">
              {props.error.kind === "rate_limited" && (
                <>
                  <strong>Bot is resting.</strong> Free model limit hit — try again in a moment.
                </>
              )}
              {props.error.kind === "missing_key" && (
                <>
                  <strong>Set your key.</strong> Add <code>OPENROUTER_API_KEY</code> to{" "}
                  <code>.env.local</code>.
                </>
              )}
              {props.error.kind === "generic" && (
                <>
                  <strong>Error.</strong>{" "}
                  <span className="text-muted">{props.error.message}</span>
                </>
              )}
            </div>
          )}
          {props.errorNote && (
            <div className="rounded-2xl bg-red/15 px-3 py-2.5 text-xs text-foreground ring-1 ring-red/30">
              {props.errorNote}
            </div>
          )}
          {props.supportNote && !props.errorNote && (
            <div className="rounded-2xl bg-bg/35 px-3 py-2.5 text-[11px] text-muted ring-1 ring-white/5">
              {props.supportNote}
            </div>
          )}

          <div className="rounded-2xl bg-bg/35 p-3 ring-1 ring-white/5">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                Summary
              </div>
              {s.summary && (
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(s.summary ?? "");
                  }}
                  className="text-[10px] text-muted hover:text-foreground"
                >
                  Copy
                </button>
              )}
            </div>
            <div className="mt-2 max-h-[150px] overflow-y-auto whitespace-pre-wrap rounded-xl bg-black/20 px-3 py-2 text-xs leading-relaxed text-foreground/90 ring-1 ring-white/5">
              {s.summary || <span className="text-muted">No summary yet.</span>}
            </div>
          </div>

          <div className="rounded-2xl bg-bg/35 p-3 ring-1 ring-white/5">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                Rewrite
              </div>
              {s.rewrite && (
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(s.rewrite ?? "");
                  }}
                  className="text-[10px] text-muted hover:text-foreground"
                >
                  Copy
                </button>
              )}
            </div>
            <div className="mt-2 max-h-[150px] overflow-y-auto whitespace-pre-wrap rounded-xl bg-black/20 px-3 py-2 text-xs leading-relaxed text-foreground/90 ring-1 ring-white/5">
              {s.rewrite || <span className="text-muted">No rewrite yet.</span>}
            </div>
          </div>

          <button
            type="button"
            onClick={async () => {
              const conf = window.confirm("Clear this transcript? AI outputs stay.");
              if (!conf) return;
              if (s.id != null) {
                await updateNoteSession(s.id, { transcript: "" });
              }
            }}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-surface/55 px-3 py-2 text-xs font-semibold text-foreground/80 ring-1 ring-white/5 hover:bg-surface"
          >
            <Eraser size={13} />
            Clear transcript
          </button>
        </div>
      </div>
    </section>
  );
}
