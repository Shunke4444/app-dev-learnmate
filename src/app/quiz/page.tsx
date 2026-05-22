"use client";

import { useMemo, useState } from "react";
import { Check, ChevronRight, Loader2, Sparkles, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import type { QuizPayload } from "@/lib/ai/schemas";
import { saveQuiz, saveQuizAttempt, type Id } from "@/lib/db/sync";

type Stage = "setup" | "playing" | "done";

type ErrorState =
  | { kind: "none" }
  | { kind: "rate_limited" }
  | { kind: "missing_key" }
  | { kind: "chain_exhausted" }
  | { kind: "generic"; message: string };

const TOPIC_SUGGESTIONS = [
  "Python loops & comprehensions",
  "Photosynthesis basics",
  "World War II causes",
  "Mitosis vs meiosis",
  "Pythagorean theorem",
];

export default function QuizPage() {
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(5);
  const [stage, setStage] = useState<Stage>("setup");
  const [loading, setLoading] = useState(false);
  const [quiz, setQuiz] = useState<QuizPayload | null>(null);
  const [quizId, setQuizId] = useState<Id | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [error, setError] = useState<ErrorState>({ kind: "none" });

  const current = quiz?.questions[step];
  const total = quiz?.questions.length ?? 0;
  const progress = total > 0 ? Math.round(((step + (picked !== null ? 1 : 0)) / total) * 100) : 0;

  const score = useMemo(() => {
    if (!quiz) return 0;
    return answers.reduce((acc, a, i) => acc + (a === quiz.questions[i]?.answer ? 1 : 0), 0);
  }, [answers, quiz]);

  async function generate(activeTopic: string) {
    if (!activeTopic.trim() || loading) return;
    setError({ kind: "none" });
    setLoading(true);
    setQuiz(null);
    setQuizId(null);
    setAnswers([]);
    setStep(0);
    setPicked(null);

    try {
      const res = await fetch("/api/ai/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: activeTopic.trim(), count }),
      });

      if (!res.ok) {
        let payload: { error?: string; message?: string } = {};
        try {
          payload = await res.json();
        } catch {
          // ignore
        }
        if (payload.error === "chain_exhausted") {
          setError({ kind: "chain_exhausted" });
        } else if (payload.error === "rate_limited" || res.status === 429) {
          setError({ kind: "rate_limited" });
        } else if (payload.error === "missing_key") {
          setError({ kind: "missing_key" });
        } else {
          setError({
            kind: "generic",
            message: payload.message ?? `Error ${res.status}`,
          });
        }
        return;
      }

      const data = (await res.json()) as QuizPayload;
      setQuiz(data);
      setStage("playing");

      try {
        const saved = await saveQuiz({ topic: activeTopic.trim(), questions: data.questions });
        setQuizId(saved.id ?? null);
      } catch (err) {
        console.warn("Dexie save failed:", err);
      }
    } catch (e) {
      setError({ kind: "generic", message: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  function chooseOption(idx: number) {
    if (picked !== null) return;
    setPicked(idx);
    setAnswers((a) => [...a, idx]);
  }

  async function next() {
    if (!quiz) return;
    if (step + 1 >= quiz.questions.length) {
      setStage("done");
      if (quizId != null) {
        try {
          await saveQuizAttempt({
            quizId,
            answers: [...answers],
            score,
            total: quiz.questions.length,
          });
        } catch (err) {
          console.warn("Dexie save failed:", err);
        }
      }
      return;
    }
    setStep((s) => s + 1);
    setPicked(null);
  }

  function reset() {
    setStage("setup");
    setQuiz(null);
    setQuizId(null);
    setAnswers([]);
    setStep(0);
    setPicked(null);
    setError({ kind: "none" });
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-[1180px]">
        {stage === "setup" && (
          <SetupPanel
            topic={topic}
            setTopic={setTopic}
            count={count}
            setCount={setCount}
            loading={loading}
            error={error}
            onGenerate={() => generate(topic)}
            onSuggestion={(s) => {
              setTopic(s);
              generate(s);
            }}
          />
        )}

        {stage === "playing" && quiz && current && (
          <PlayPanel
            topic={topic}
            step={step}
            total={total}
            progress={progress}
            question={current}
            picked={picked}
            onPick={chooseOption}
            onNext={next}
            onReset={reset}
          />
        )}

        {stage === "done" && quiz && (
          <DonePanel
            quiz={quiz}
            answers={answers}
            score={score}
            onRestart={() => generate(topic)}
            onNewQuiz={reset}
          />
        )}
      </div>
    </AppShell>
  );
}

// -------------------- Setup --------------------

function SetupPanel(props: {
  topic: string;
  setTopic: (v: string) => void;
  count: number;
  setCount: (n: number) => void;
  loading: boolean;
  error: ErrorState;
  onGenerate: () => void;
  onSuggestion: (s: string) => void;
}) {
  return (
    <section className="lm-rise relative overflow-hidden rounded-[var(--radius-card)] bg-surface/45 p-6 ring-1 ring-white/5 backdrop-blur-xl lg:p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-20 -top-20 h-60 w-60 rounded-full bg-pink/15 blur-3xl"
      />

      <div className="relative">
        <div className="inline-flex items-center gap-2 rounded-full bg-bg/35 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ring-1 ring-white/5">
          <Sparkles size={12} className="text-pink" />
          Quiz generator
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight md:text-3xl">
          What should we quiz you on?
        </h1>
        <p className="mt-2 max-w-[60ch] text-sm text-muted">
          Pick a topic and I&apos;ll generate fresh multiple-choice questions with rationale.
        </p>

        <form
          className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center"
          onSubmit={(e) => {
            e.preventDefault();
            props.onGenerate();
          }}
        >
          <input
            value={props.topic}
            onChange={(e) => props.setTopic(e.target.value)}
            placeholder='e.g. "Python loops" or "American Civil War"'
            className="h-12 min-w-0 flex-1 rounded-2xl bg-bg/45 px-4 text-sm text-foreground ring-1 ring-white/5 placeholder:text-muted/70 outline-none focus:ring-teal/40"
          />
          <select
            value={props.count}
            onChange={(e) => props.setCount(Number(e.target.value))}
            className="h-12 rounded-2xl bg-bg/45 px-3 text-sm text-foreground ring-1 ring-white/5 outline-none"
            aria-label="Question count"
          >
            {[3, 5, 7, 10].map((n) => (
              <option key={n} value={n}>
                {n} questions
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={!props.topic.trim() || props.loading}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-teal px-5 text-sm font-semibold text-black ring-1 ring-white/10 transition hover:brightness-95 disabled:opacity-50"
          >
            {props.loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Building…
              </>
            ) : (
              <>
                Generate quiz
                <ChevronRight size={16} />
              </>
            )}
          </button>
        </form>

        <div className="mt-6">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            Or try
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {TOPIC_SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => props.onSuggestion(s)}
                disabled={props.loading}
                className="rounded-full bg-surface/55 px-3.5 py-1.5 text-xs font-medium text-foreground/85 ring-1 ring-white/5 hover:bg-surface disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {props.error.kind !== "none" && (
          <div className="mt-6 rounded-2xl bg-red/15 px-3 py-2.5 text-xs text-foreground ring-1 ring-red/30">
            {props.error.kind === "rate_limited" && (
              <>
                <strong>Bot is resting.</strong> Free model limit hit — try again in a moment.
              </>
            )}
            {props.error.kind === "chain_exhausted" && (
              <>
                <strong>All free models are busy.</strong>{" "}
                <span className="text-muted">Wait ~30 seconds and try again.</span>
                <button
                  type="button"
                  onClick={() => props.onGenerate()}
                  className="ml-2 rounded-xl bg-bg/45 px-2 py-1 text-[11px] font-semibold ring-1 ring-white/5 hover:bg-bg/65"
                >
                  Try again
                </button>
              </>
            )}
            {props.error.kind === "missing_key" && (
              <>
                <strong>Set your key.</strong> Add <code>OPENROUTER_API_KEY</code> to{" "}
                <code>.env.local</code>, then restart <code>npm run dev</code>.
              </>
            )}
            {props.error.kind === "generic" && (
              <>
                <strong>Couldn&apos;t build that quiz.</strong>{" "}
                <span className="text-muted">{props.error.message}</span>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

// -------------------- Play --------------------

function PlayPanel(props: {
  topic: string;
  step: number;
  total: number;
  progress: number;
  question: QuizPayload["questions"][number];
  picked: number | null;
  onPick: (i: number) => void;
  onNext: () => void;
  onReset: () => void;
}) {
  const { question: q, picked } = props;
  const isLast = props.step + 1 >= props.total;
  const showResult = picked !== null;

  return (
    <div className="lm-rise grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative overflow-hidden rounded-[var(--radius-card)] bg-surface/45 p-6 ring-1 ring-white/5 backdrop-blur-xl lg:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-20 -top-20 h-60 w-60 rounded-full bg-pink/15 blur-3xl"
        />

        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-bg/35 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ring-1 ring-white/5">
            <Sparkles size={12} className="text-pink" />
            {props.topic}
          </div>
          <div className="text-xs font-semibold text-muted">
            Question {props.step + 1} <span className="text-foreground/70">of {props.total}</span>
          </div>
        </div>

        <div className="relative mt-5 h-2 overflow-hidden rounded-full bg-bg/35 ring-1 ring-white/5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-teal via-lime to-pink transition-all"
            style={{ width: `${props.progress}%` }}
          />
        </div>

        <div className="relative mt-7 rounded-2xl bg-bg/45 p-5 ring-1 ring-white/5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            Prompt
          </div>
          <div className="mt-2 whitespace-pre-wrap text-base font-semibold leading-snug">
            {q.prompt}
          </div>
          {q.code && (
            <pre className="mt-4 overflow-auto rounded-2xl bg-black/45 p-4 text-sm leading-relaxed ring-1 ring-white/5">
              <code className="text-foreground/95">{q.code}</code>
            </pre>
          )}
        </div>

        {showResult && (
          <div
            className={
              "relative mt-5 rounded-2xl p-4 text-sm ring-1 " +
              (picked === q.answer
                ? "bg-green/15 ring-green/30 text-foreground"
                : "bg-red/15 ring-red/30 text-foreground")
            }
          >
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider">
              {picked === q.answer ? (
                <span className="inline-flex items-center gap-1 text-green">
                  <Check size={12} /> Correct
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-red">
                  <X size={12} /> Not quite — answer: {String.fromCharCode(65 + q.answer)}
                </span>
              )}
            </div>
            <p className="mt-1.5 leading-relaxed text-foreground/90">{q.rationale}</p>
          </div>
        )}
      </section>

      <aside className="flex flex-col gap-4">
        <div className="lm-rise lm-rise-1 flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface/45 p-5 ring-1 ring-white/5 backdrop-blur lg:p-6">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Choose an answer</div>
            <div className="text-[11px] text-muted">Tap to select</div>
          </div>

          {q.options.map((opt, idx) => {
            const correct = idx === q.answer;
            const selected = picked === idx;

            let cls = "bg-surface/55 text-foreground ring-white/5 hover:bg-surface/75";
            if (showResult) {
              if (correct)
                cls =
                  "bg-green/90 text-black ring-white/20 shadow-[0_12px_40px_-14px_rgba(91,215,91,0.7)]";
              else if (selected) cls = "bg-red/30 text-foreground ring-red/40";
              else cls = "bg-surface/40 text-muted ring-white/5";
            }

            return (
              <button
                key={idx}
                type="button"
                onClick={() => props.onPick(idx)}
                disabled={showResult}
                aria-pressed={selected}
                className={
                  "group flex items-center gap-3 rounded-2xl px-4 py-3.5 text-left text-sm font-medium ring-1 transition " +
                  cls
                }
              >
                <span
                  className={
                    "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-1 " +
                    (showResult && correct
                      ? "bg-black/20 text-black ring-black/10"
                      : selected
                        ? "bg-bg/50 text-foreground ring-white/10"
                        : "bg-black/25 text-foreground/85 ring-white/5")
                  }
                >
                  {String.fromCharCode(65 + idx)}
                </span>
                <span className="min-w-0 break-words">{opt}</span>
                {showResult && correct && <Check size={16} className="ml-auto" />}
                {showResult && selected && !correct && <X size={16} className="ml-auto text-red" />}
                {!showResult && (
                  <ChevronRight
                    size={15}
                    className="ml-auto text-muted transition group-hover:translate-x-0.5 group-hover:text-foreground"
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="lm-rise lm-rise-2 flex gap-2">
          <button
            type="button"
            onClick={props.onReset}
            className="flex-1 rounded-2xl bg-surface/55 px-4 py-3 text-sm font-semibold text-foreground ring-1 ring-white/5 hover:bg-surface/75"
          >
            Quit
          </button>
          <button
            type="button"
            disabled={picked === null}
            onClick={props.onNext}
            className="flex-[1.6] rounded-2xl bg-teal px-4 py-3 text-sm font-semibold text-black ring-1 ring-white/10 transition hover:brightness-95 disabled:opacity-50"
          >
            {isLast ? "Finish quiz" : "Next question"}
          </button>
        </div>
      </aside>
    </div>
  );
}

// -------------------- Done --------------------

function DonePanel(props: {
  quiz: QuizPayload;
  answers: number[];
  score: number;
  onRestart: () => void;
  onNewQuiz: () => void;
}) {
  const pct = Math.round((props.score / props.quiz.questions.length) * 100);
  return (
    <section className="lm-rise relative overflow-hidden rounded-[var(--radius-card)] bg-surface/45 p-6 ring-1 ring-white/5 backdrop-blur-xl lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            Quiz complete
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-[40px]">
            {props.score} <span className="text-muted">/ {props.quiz.questions.length}</span>
          </h1>
          <p className="mt-1 text-sm text-muted">{pct}% correct</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={props.onRestart}
            className="rounded-2xl bg-surface/55 px-4 py-2.5 text-sm font-semibold text-foreground ring-1 ring-white/5 hover:bg-surface/75"
          >
            Retake
          </button>
          <button
            type="button"
            onClick={props.onNewQuiz}
            className="rounded-2xl bg-teal px-4 py-2.5 text-sm font-semibold text-black ring-1 ring-white/10 hover:brightness-95"
          >
            New quiz
          </button>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {props.quiz.questions.map((q, i) => {
          const a = props.answers[i];
          const correct = a === q.answer;
          return (
            <div
              key={i}
              className={
                "rounded-2xl p-4 text-sm ring-1 " +
                (correct ? "bg-green/10 ring-green/30" : "bg-red/10 ring-red/30")
              }
            >
              <div className="flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wider">
                <span>Q{i + 1}</span>
                <span className={correct ? "text-green" : "text-red"}>
                  {correct ? "Correct" : "Missed"}
                </span>
              </div>
              <div className="mt-2 font-medium">{q.prompt}</div>
              <div className="mt-2 text-xs text-muted">
                Correct answer:{" "}
                <span className="font-semibold text-foreground/85">
                  {String.fromCharCode(65 + q.answer)} · {q.options[q.answer]}
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-foreground/80">{q.rationale}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
