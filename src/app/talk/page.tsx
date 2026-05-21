"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  CircleStop,
  Headphones,
  Languages,
  Sparkles,
  Volume2,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Mascot } from "@/components/Mascot";
import { VoiceFAB } from "@/components/VoiceFAB";
import { Waveform } from "@/components/Waveform";
import {
  createRecognition,
  isSupported as isSttSupported,
} from "@/lib/voice/recognition";
import { cancelSpeech, isTtsSupported, speak } from "@/lib/voice/tts";
import { useMicLevel } from "@/lib/voice/waveform";

type TranscriptLine = { role: "you" | "bot"; text: string };

const presets = [
  "Take notes for my class",
  "Quiz me on Python loops",
  "Summarize last lecture",
  "Translate to Spanish",
];

const SYSTEM =
  "You are LearnMate, a voice-first study buddy. Reply in 1–3 short sentences — " +
  "natural spoken English, no markdown, no bullet lists, no code unless explicitly asked. " +
  "If asked a follow-up, stay on topic.";

export default function TalkPage() {
  const [active, setActive] = useState(false);
  const [interim, setInterim] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [supportNote] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    if (!isSttSupported())
      return "Voice listening isn't supported in this browser. Try Chrome, Edge, or Safari.";
    if (!isTtsSupported())
      return "Text-to-speech isn't available — replies will be text-only here.";
    return null;
  });
  const [errorNote, setErrorNote] = useState<string | null>(null);

  const recRef = useRef<ReturnType<typeof createRecognition> | null>(null);
  const sendingRef = useRef(false);
  const linesRef = useRef<TranscriptLine[]>([]);
  const { level: micLevel, error: micError } = useMicLevel(active);

  useEffect(() => {
    linesRef.current = lines;
  }, [lines]);

  useEffect(() => {
    return () => {
      recRef.current?.stop();
      cancelSpeech();
    };
  }, []);

  const derivedError =
    errorNote ?? (micError ? "Mic permission denied or unavailable." : null);

  async function sendToBot(userText: string) {
    if (sendingRef.current) return;
    const clean = userText.trim();
    if (!clean) return;
    sendingRef.current = true;
    setLines((l) => [...l, { role: "you", text: clean }]);

    // Build history (last 8 turns) for context.
    const history = [...linesRef.current, { role: "you", text: clean } as TranscriptLine]
      .slice(-8)
      .map((l) => ({
        role: l.role === "you" ? ("user" as const) : ("assistant" as const),
        content: l.text,
      }));

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, system: SYSTEM }),
      });

      if (!res.ok) {
        let payload: { error?: string; message?: string } = {};
        try {
          payload = await res.json();
        } catch {
          // ignore
        }
        setErrorNote(
          payload.error === "rate_limited"
            ? "Bot is resting — free model limit hit. Try again shortly."
            : payload.error === "missing_key"
              ? "Set OPENROUTER_API_KEY in .env.local and restart."
              : payload.message ?? `Error ${res.status}`,
        );
        sendingRef.current = false;
        return;
      }

      if (!res.body) {
        setErrorNote("No response stream from server.");
        sendingRef.current = false;
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      setLines((l) => [...l, { role: "bot", text: "" }]);
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setLines((l) => {
          const next = l.slice();
          const last = next[next.length - 1];
          if (last?.role === "bot") next[next.length - 1] = { role: "bot", text: acc };
          return next;
        });
      }
      if (acc.trim()) {
        setSpeaking(true);
        speak(acc, {
          onEnd: () => setSpeaking(false),
          onError: () => setSpeaking(false),
        });
      }
    } catch (e) {
      setErrorNote((e as Error).message);
    } finally {
      sendingRef.current = false;
    }
  }

  function startListening() {
    setErrorNote(null);
    cancelSpeech();
    setSpeaking(false);

    if (!isSttSupported()) {
      setErrorNote(
        "Voice listening isn't supported in this browser. Try Chrome, Edge, or Safari.",
      );
      return;
    }

    if (!recRef.current) {
      recRef.current = createRecognition({
        continuous: false,
        onPartial: (t) => setInterim(t),
        onFinal: (t) => {
          setInterim("");
          setActive(false);
          recRef.current?.stop();
          if (t) sendToBot(t);
        },
        onError: (code) => {
          setActive(false);
          setInterim("");
          if (code === "no-speech") return;
          if (code === "not-allowed" || code === "service-not-allowed")
            setErrorNote("Mic permission denied. Allow microphone access and retry.");
          else setErrorNote(`Voice error: ${code}`);
        },
        onEnd: () => {
          setInterim("");
        },
      });
    }
    setActive(true);
    recRef.current.start();
  }

  function stopListening() {
    recRef.current?.stop();
    setActive(false);
    setInterim("");
  }

  function handleToggle() {
    if (active) stopListening();
    else startListening();
  }

  function endSession() {
    stopListening();
    cancelSpeech();
    setSpeaking(false);
  }

  const statusLabel = active
    ? "Listening"
    : speaking
      ? "Speaking"
      : "Tap to start";

  const displayed = useMemo(() => {
    const list = lines.slice();
    if (interim) list.push({ role: "you", text: interim + "…" });
    return list;
  }, [lines, interim]);

  return (
    <AppShell>
      <div className="mx-auto grid w-full max-w-[1180px] gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="lm-rise relative overflow-hidden rounded-[var(--radius-card)] bg-surface/45 p-6 ring-1 ring-white/5 backdrop-blur-xl lg:p-8">
          <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-teal/10 to-transparent" />

          <div className="relative flex flex-col items-center text-center">
            <div className="relative">
              {active && <span className="lm-pulse-ring" aria-hidden />}
              <Mascot
                state={active ? "listening" : speaking ? "speaking" : "idle"}
                size={148}
                className={active || speaking ? "lm-drift" : ""}
              />
            </div>

            <div
              className={
                "mt-6 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ring-1 " +
                (active || speaking
                  ? "bg-teal/15 text-teal ring-teal/30"
                  : "bg-surface/55 text-muted ring-white/5")
              }
            >
              <span
                className={
                  "h-1.5 w-1.5 rounded-full " +
                  (active || speaking ? "bg-teal animate-pulse" : "bg-muted")
                }
              />
              {statusLabel}
            </div>

            <h1 className="mt-5 text-2xl font-semibold tracking-tight md:text-3xl">
              {active
                ? "I'm listening…"
                : speaking
                  ? "Speaking…"
                  : "Talk with Bot"}
            </h1>
            <p className="mt-2 max-w-[44ch] text-sm text-muted">
              {active
                ? "Speak naturally. I'll transcribe and reply when you pause."
                : speaking
                  ? "Replying out loud. Tap the mic to interrupt."
                  : "Voice mode. Ask questions out loud, get spoken answers."}
            </p>

            <div className="mt-7 w-full max-w-[420px]">
              <Waveform active={active} level={active ? micLevel : undefined} />
            </div>

            <div className="mt-7 flex items-center gap-4">
              <button
                type="button"
                aria-label="Headphone mode"
                className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-surface/70 text-foreground/80 ring-1 ring-white/5 hover:bg-surface"
              >
                <Headphones size={18} />
              </button>
              <VoiceFAB active={active} onClick={handleToggle} />
              <button
                type="button"
                aria-label="Language"
                className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-surface/70 text-foreground/80 ring-1 ring-white/5 hover:bg-surface"
              >
                <Languages size={18} />
              </button>
            </div>

            <button
              type="button"
              disabled={!active && !speaking && lines.length === 0}
              onClick={endSession}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-bg/40 px-4 py-2 text-xs text-muted ring-1 ring-white/5 hover:text-foreground disabled:opacity-50"
            >
              <CircleStop size={14} />
              End session
            </button>

            {supportNote && (
              <p className="mt-4 max-w-[52ch] rounded-2xl bg-bg/35 px-3 py-2 text-[11px] text-muted ring-1 ring-white/5">
                {supportNote}
              </p>
            )}
            {derivedError && (
              <p className="mt-3 max-w-[52ch] rounded-2xl bg-red/15 px-3 py-2 text-[11px] text-foreground ring-1 ring-red/30">
                {derivedError}
              </p>
            )}
          </div>
        </section>

        <div className="flex flex-col gap-4">
          <section className="lm-rise lm-rise-1 rounded-[var(--radius-card)] bg-surface/45 p-5 ring-1 ring-white/5 backdrop-blur">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Volume2 size={15} className="text-teal" />
                Live transcript
              </div>
              <span className="text-[11px] text-muted">
                {active ? "Listening" : speaking ? "Speaking" : "Idle"}
              </span>
            </div>

            <div className="lm-scroll-hide mt-4 flex max-h-[300px] flex-col gap-2.5 overflow-y-auto pr-1">
              {displayed.length === 0 && (
                <p className="rounded-2xl bg-bg/30 px-3.5 py-3 text-xs text-muted ring-1 ring-white/5">
                  Tap the mic and ask anything — your transcript will appear here.
                </p>
              )}
              {displayed.map((t, i) => (
                <div
                  key={i}
                  className={
                    "rounded-2xl px-3.5 py-2.5 text-sm ring-1 ring-white/5 " +
                    (t.role === "you"
                      ? "ml-auto max-w-[88%] bg-surface2/70"
                      : "max-w-[88%] bg-bg/35")
                  }
                >
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                    {t.role === "you" ? "You" : "Bot"}
                  </div>
                  <div className="mt-1 whitespace-pre-wrap leading-relaxed">{t.text}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="lm-rise lm-rise-2 rounded-[var(--radius-card)] bg-surface/45 p-5 ring-1 ring-white/5 backdrop-blur">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles size={15} className="text-purple" />
              Try saying
            </div>
            <div className="mt-3 flex flex-col gap-2">
              {presets.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => sendToBot(p)}
                  className="group flex items-center justify-between rounded-2xl bg-bg/35 px-3.5 py-2.5 text-left text-xs font-medium text-foreground/85 ring-1 ring-white/5 hover:bg-bg/55"
                >
                  <span>“{p}”</span>
                  <ChevronRight
                    size={14}
                    className="text-muted transition group-hover:translate-x-0.5 group-hover:text-foreground"
                  />
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
