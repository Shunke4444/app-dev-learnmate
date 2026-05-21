/* eslint-disable react/no-unescaped-entities */
"use client";

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowUpRight,
  Mic,
  MessageSquare,
  BookOpen,
  Sparkles,
  FileText,
  Play,
  Check,
  Lock,
  Zap,
  Globe,
  Plus,
  Minus,
  Star,
  Wifi,
  HeartHandshake,
} from "lucide-react";

/* ───────────────────────── hooks & helpers ───────────────────────── */

function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <div
      className={`lm-reveal ${className ?? ""}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ───────────────────────── mascot (SVG, eyes follow cursor) ───────────────────────── */

function HeroMascot({
  size = 360,
  state = "idle",
}: {
  size?: number;
  state?: "idle" | "listening" | "speaking";
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [eye, setEye] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (state !== "idle") return;
    function onMove(e: PointerEvent) {
      const el = svgRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy) || 1;
      const reach = Math.min(10, dist / 28);
      setEye({ x: (dx / dist) * reach, y: (dy / dist) * reach });
    }
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [state]);

  const isListening = state === "listening";

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 520 360"
      width={size}
      height={size * 0.69}
      aria-hidden
      className="select-none"
    >
      <defs>
        <radialGradient id="lmGlow" cx="50%" cy="55%" r="55%">
          <stop offset="0%" stopColor="rgba(52,224,196,0.55)" />
          <stop offset="60%" stopColor="rgba(52,224,196,0)" />
        </radialGradient>
        <filter id="lmShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
        <linearGradient id="lmBody" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#0c1110" />
          <stop offset="100%" stopColor="#020403" />
        </linearGradient>
      </defs>

      {/* aura */}
      <ellipse cx="260" cy="210" rx="240" ry="120" fill="url(#lmGlow)" />

      {/* drop shadow */}
      <ellipse cx="264" cy="208" rx="210" ry="98" fill="#000" filter="url(#lmShadow)" opacity="0.7" />

      {/* head */}
      <path
        d="M60 170c0-58 88-92 200-92s200 34 200 92v6c0 58-88 92-200 92S60 234 60 176z"
        fill="url(#lmBody)"
        stroke="rgba(52,224,196,0.18)"
        strokeWidth="1.5"
      />
      {/* glossy highlight */}
      <path
        d="M120 110c30-18 80-30 140-30s110 12 140 30c-22 10-72 22-140 22s-118-12-140-22z"
        fill="rgba(255,255,255,0.04)"
      />

      {/* eyes */}
      <g transform={`translate(${eye.x} ${eye.y})`}>
        {isListening ? (
          <>
            {/* "+ +" listening eyes */}
            <g stroke="#34E0C4" strokeWidth="14" strokeLinecap="round">
              <line x1="148" y1="170" x2="208" y2="170" />
              <line x1="178" y1="140" x2="178" y2="200" />
              <line x1="312" y1="170" x2="372" y2="170" />
              <line x1="342" y1="140" x2="342" y2="200" />
            </g>
          </>
        ) : (
          <>
            <g style={{ transformOrigin: "178px 170px", animation: "lm-blink 5.2s ease-in-out infinite" }}>
              <rect x="158" y="118" width="42" height="104" rx="21" fill="#34E0C4" />
              <rect x="166" y="128" width="14" height="34" rx="7" fill="#9CF1DF" />
            </g>
            <g style={{ transformOrigin: "342px 170px", animation: "lm-blink 5.2s ease-in-out infinite" }}>
              <rect x="322" y="118" width="42" height="104" rx="21" fill="#34E0C4" />
              <rect x="330" y="128" width="14" height="34" rx="7" fill="#9CF1DF" />
            </g>
          </>
        )}
      </g>
    </svg>
  );
}

/* ───────────────────────── waveform ───────────────────────── */

function Waveform({
  bars = 36,
  className,
  tone = "teal",
}: {
  bars?: number;
  className?: string;
  tone?: "teal" | "lime" | "purple" | "pink";
}) {
  const color =
    tone === "teal"
      ? "var(--teal)"
      : tone === "lime"
        ? "var(--lime)"
        : tone === "purple"
          ? "var(--purple)"
          : "var(--pink)";
  return (
    <div
      className={`flex items-center justify-center gap-[5px] ${className ?? ""}`}
      aria-hidden
    >
      {Array.from({ length: bars }).map((_, i) => {
        const dur = 0.9 + (i % 7) * 0.13;
        const delay = (i * 73) % 900;
        const peak = 0.45 + ((i * 17) % 55) / 100;
        return (
          <span
            key={i}
            style={{
              background: color,
              animation: `lm-bar ${dur}s ease-in-out ${delay}ms infinite`,
              transform: `scaleY(${peak})`,
              transformOrigin: "center",
            }}
            className="block h-12 w-[3px] rounded-full opacity-90"
          />
        );
      })}
    </div>
  );
}

/* ───────────────────────── sticky nav ───────────────────────── */

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        scrolled ? "py-3" : "py-5"
      }`}
    >
      <div
        className={`mx-auto flex max-w-6xl items-center justify-between rounded-2xl px-4 py-2.5 transition-all duration-500 ${
          scrolled
            ? "bg-bg/65 ring-1 ring-white/10 backdrop-blur-xl"
            : "bg-transparent ring-1 ring-transparent"
        }`}
      >
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="relative inline-flex h-8 w-12 items-center justify-center">
            <Image
              src="/mascot/idle.png"
              alt=""
              fill
              sizes="48px"
              className="object-contain"
              priority
            />
          </span>
          <span className="text-sm font-semibold tracking-tight">LearnMate</span>
          <span className="ml-1 hidden rounded-full bg-teal/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-teal ring-1 ring-teal/30 sm:inline-flex">
            Free
          </span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm text-muted md:flex">
          <a href="#features" className="transition hover:text-foreground">
            Features
          </a>
          <a href="#voice" className="transition hover:text-foreground">
            Voice
          </a>
          <a href="#screens" className="transition hover:text-foreground">
            Screens
          </a>
          <a href="#faq" className="transition hover:text-foreground">
            FAQ
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden h-9 items-center rounded-full px-3 text-sm text-muted transition hover:text-foreground sm:inline-flex"
          >
            Sign in
          </Link>
          <Link
            href="/welcome"
            className="group inline-flex h-9 items-center gap-1.5 rounded-full bg-teal pl-3.5 pr-2 text-sm font-semibold text-black transition hover:bg-[#5af3d6]"
          >
            Start free
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/15 transition group-hover:rotate-45">
              <ArrowUpRight size={14} />
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ───────────────────────── hero ───────────────────────── */

function Hero() {
  return (
    <section className="relative isolate overflow-hidden pb-16 pt-32 md:pt-36">
      {/* layered backgrounds */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 [background:radial-gradient(1200px_circle_at_18%_12%,rgba(52,224,196,0.18),transparent_60%),radial-gradient(1100px_circle_at_88%_18%,rgba(201,167,245,0.16),transparent_58%),radial-gradient(1100px_circle_at_50%_110%,rgba(247,184,210,0.12),transparent_60%)]"
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 lm-grid opacity-40" />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 lm-noise opacity-30" />

      <div className="mx-auto max-w-6xl px-5">
        <div className="grid items-center gap-10 md:grid-cols-[1.05fr_1fr]">
          <div>
            <Reveal>
              <div className="inline-flex items-center gap-2 rounded-full border border-teal/30 bg-teal/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-teal">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal/70" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-teal" />
                </span>
                Free forever · no card
              </div>
            </Reveal>

            <Reveal delay={80}>
              <h1 className="mt-6 text-balance text-[40px] font-semibold leading-[0.95] tracking-tight sm:text-[52px] lg:text-[62px]">
                <span className="lm-text-grad">Your study buddy</span>
                <br />
                <span className="lm-text-teal-grad italic">that actually listens.</span>
              </h1>
            </Reveal>

            <Reveal delay={160}>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-muted md:text-lg">
                LearnMate hears you, summarizes your notes, builds quizzes you'll
                actually pass, and edits your research — all in your browser.
                Powered by free models. Zero subscription. Yours forever.
              </p>
            </Reveal>

            <Reveal delay={240}>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/welcome"
                  className="group relative inline-flex h-12 items-center gap-2 overflow-hidden rounded-full bg-teal px-5 text-sm font-semibold text-black transition hover:bg-[#5af3d6]"
                >
                  Start studying free
                  <ArrowUpRight size={16} className="transition group-hover:rotate-45" />
                  <span className="lm-shine absolute inset-0" />
                </Link>
                <a
                  href="#voice"
                  className="group inline-flex h-12 items-center gap-2 rounded-full bg-surface/70 px-5 text-sm font-medium text-foreground ring-1 ring-white/10 backdrop-blur transition hover:bg-surface"
                >
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-teal/20 text-teal">
                    <Play size={12} fill="currentColor" />
                  </span>
                  See it talk
                </a>
              </div>
            </Reveal>

            <Reveal delay={320}>
              <dl className="mt-12 grid max-w-md grid-cols-3 gap-6 border-t border-white/5 pt-6 text-left">
                <Stat k="$0" v="forever cost" />
                <Stat k="13" v="study screens" />
                <Stat k="6" v="free AI models" />
              </dl>
            </Reveal>
          </div>

          {/* mascot column */}
          <div className="relative flex items-center justify-center">
            <div
              aria-hidden
              className="absolute -inset-10 -z-10 rounded-[40%] bg-teal/10 blur-3xl"
            />
            <div style={{ animation: "lm-float 7s ease-in-out infinite" }}>
              <HeroMascot size={380} />
            </div>

            {/* floating chips around mascot */}
            <FloatingChip
              className="left-[-2%] top-[18%]"
              tone="lime"
              icon={<Mic size={14} />}
              label="Listening…"
            />
            <FloatingChip
              className="right-[-2%] top-[10%]"
              tone="purple"
              icon={<MessageSquare size={14} />}
              label="Streaming reply"
            />
            <FloatingChip
              className="left-[6%] bottom-[10%]"
              tone="pink"
              icon={<Sparkles size={14} />}
              label="Quiz ready"
            />
            <FloatingChip
              className="right-[2%] bottom-[18%]"
              tone="teal"
              icon={<Check size={14} />}
              label="Saved offline"
            />
          </div>
        </div>

        {/* hero waveform footer */}
        <Reveal delay={420}>
          <div className="mt-14 flex items-center justify-between rounded-2xl bg-surface/50 px-5 py-4 ring-1 ring-white/5 backdrop-blur">
            <div className="flex items-center gap-3 text-xs text-muted">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-teal/15 text-teal">
                <Mic size={13} />
              </span>
              <span className="hidden sm:inline">
                "Take notes for my python class"
              </span>
              <span className="sm:hidden">Voice in, AI out</span>
            </div>
            <Waveform bars={28} tone="teal" className="opacity-90" />
            <div className="hidden text-xs text-muted sm:block">
              Web Speech · Whisper fallback
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-2xl font-semibold text-foreground md:text-3xl">{k}</dt>
      <dd className="mt-1 text-xs uppercase tracking-wider text-muted">{v}</dd>
    </div>
  );
}

function FloatingChip({
  className,
  tone,
  icon,
  label,
}: {
  className?: string;
  tone: "teal" | "lime" | "purple" | "pink";
  icon: ReactNode;
  label: string;
}) {
  const bg =
    tone === "teal"
      ? "bg-teal/20 text-teal ring-teal/30"
      : tone === "lime"
        ? "bg-lime/20 text-lime ring-lime/30"
        : tone === "purple"
          ? "bg-purple/20 text-purple ring-purple/40"
          : "bg-pink/25 text-pink ring-pink/40";
  return (
    <div
      className={`absolute hidden md:inline-flex ${className ?? ""}`}
      style={{ animation: "lm-float 6s ease-in-out infinite" }}
    >
      <div
        className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ring-1 backdrop-blur ${bg}`}
      >
        {icon}
        <span>{label}</span>
      </div>
    </div>
  );
}

/* ───────────────────────── marquee ───────────────────────── */

const SUBJECTS = [
  "Python · CS50",
  "Calculus II",
  "Organic Chemistry",
  "World History",
  "Spanish B1",
  "Linear Algebra",
  "Anatomy",
  "Microeconomics",
  "Philosophy 101",
  "Data Structures",
  "Literature",
  "Statistics",
  "Physics",
  "SAT Prep",
];

function Marquee() {
  return (
    <section aria-label="Subjects" className="relative border-y border-white/5 bg-surface/30 py-8">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-32 bg-gradient-to-r from-bg to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-32 bg-gradient-to-l from-bg to-transparent" />
      <div className="flex overflow-hidden">
        <div
          className="flex shrink-0 items-center gap-10 whitespace-nowrap pr-10 text-2xl font-semibold tracking-tight text-muted/70 md:text-3xl"
          style={{ animation: "lm-marquee 38s linear infinite" }}
        >
          {[...SUBJECTS, ...SUBJECTS].map((s, i) => (
            <span key={i} className="inline-flex items-center gap-10">
              <span>{s}</span>
              <Star size={12} className="text-teal/70" />
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── features ───────────────────────── */

type FeatureTone = "lime" | "purple" | "teal" | "pink" | "blue" | "mint";

function ToneSwatch({ tone, icon }: { tone: FeatureTone; icon: ReactNode }) {
  const m: Record<FeatureTone, string> = {
    lime: "bg-lime text-black",
    purple: "bg-purple text-black",
    teal: "bg-teal text-black",
    pink: "bg-pink text-black",
    blue: "bg-blue text-white",
    mint: "bg-[#7AE3CC] text-black",
  };
  return (
    <div className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl ${m[tone]}`}>
      {icon}
    </div>
  );
}

function FeatureCard({
  tone,
  icon,
  title,
  body,
  preview,
  size = "md",
}: {
  tone: FeatureTone;
  icon: ReactNode;
  title: string;
  body: string;
  preview?: ReactNode;
  size?: "md" | "lg" | "tall";
}) {
  const grow =
    size === "lg" ? "md:col-span-2" : size === "tall" ? "md:row-span-2" : "";
  return (
    <Reveal className={grow}>
      <div className="group relative flex h-full flex-col justify-between overflow-hidden rounded-[28px] bg-surface/70 p-6 ring-1 ring-white/5 transition hover:ring-white/10">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full opacity-30 blur-3xl transition group-hover:opacity-50"
          style={{
            background:
              tone === "lime"
                ? "var(--lime)"
                : tone === "purple"
                  ? "var(--purple)"
                  : tone === "teal"
                    ? "var(--teal)"
                    : tone === "pink"
                      ? "var(--pink)"
                      : tone === "blue"
                        ? "var(--blue)"
                        : "#7AE3CC",
          }}
        />
        <div>
          <div className="flex items-start justify-between">
            <ToneSwatch tone={tone} icon={icon} />
            <ArrowUpRight
              size={20}
              className="text-muted transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground"
            />
          </div>
          <h3 className="mt-5 text-2xl font-semibold tracking-tight">{title}</h3>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">{body}</p>
        </div>
        {preview && <div className="mt-6">{preview}</div>}
      </div>
    </Reveal>
  );
}

function TalkPreview() {
  return (
    <div className="rounded-2xl bg-black/30 p-4 ring-1 ring-white/5">
      <div className="flex items-center justify-between text-[11px] text-muted">
        <span>Talk · live</span>
        <span className="inline-flex items-center gap-1.5 text-teal">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal" />
          listening
        </span>
      </div>
      <Waveform bars={24} tone="lime" className="mt-3" />
      <div className="mt-3 text-xs text-foreground/90">
        "Explain mitochondria like I'm five"
      </div>
    </div>
  );
}

function ChatPreview() {
  return (
    <div className="space-y-2 rounded-2xl bg-black/30 p-4 ring-1 ring-white/5">
      <div className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-md bg-purple/90 px-3 py-2 text-[12px] text-black">
        Why does merge sort beat bubble sort?
      </div>
      <div className="mr-auto w-fit max-w-[80%] rounded-2xl rounded-bl-md bg-surface2 px-3 py-2 text-[12px] text-foreground/90">
        It splits the array O(log n) times, then merges in O(n) — so the total
        cost is O(n log n) vs bubble's O(n²)…
      </div>
      <div className="flex items-center gap-1 pl-1 pt-1">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted/70 [animation-delay:-0.2s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted/70 [animation-delay:-0.1s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted/70" />
      </div>
    </div>
  );
}

function QuizPreview() {
  return (
    <div className="rounded-2xl bg-black/30 p-4 ring-1 ring-white/5">
      <div className="flex items-center justify-between text-[11px] text-muted">
        <span>Python Quiz</span>
        <span>3 / 5</span>
      </div>
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/10">
        <div className="h-full w-3/5 rounded-full bg-pink" />
      </div>
      <div className="mt-3 rounded-lg bg-black/60 px-3 py-2 font-mono text-[11px] text-teal/90">
        print(3 * "abc")
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
        <span className="rounded-lg bg-green/85 px-2 py-1.5 text-black">"abcabcabc"</span>
        <span className="rounded-lg bg-surface2 px-2 py-1.5 text-muted">9</span>
        <span className="rounded-lg bg-surface2 px-2 py-1.5 text-muted">"abc3"</span>
        <span className="rounded-lg bg-surface2 px-2 py-1.5 text-muted">Error</span>
      </div>
    </div>
  );
}

function NotesPreview() {
  return (
    <div className="space-y-2 rounded-2xl bg-black/30 p-4 ring-1 ring-white/5">
      <div className="flex items-center gap-2 text-[11px] text-muted">
        <BookOpen size={12} className="text-teal" />
        Python class · auto-transcribed
      </div>
      <p className="text-xs leading-relaxed text-foreground/85">
        Decorators wrap a function with extra behavior without modifying its
        body. Use <span className="text-teal">@cache</span> for memoization…
      </p>
      <div className="flex flex-wrap gap-1.5 pt-2">
        <span className="rounded-full bg-teal/20 px-2 py-0.5 text-[10px] text-teal">Summarize</span>
        <span className="rounded-full bg-lime/20 px-2 py-0.5 text-[10px] text-lime">Redo</span>
        <span className="rounded-full bg-pink/20 px-2 py-0.5 text-[10px] text-pink">Make quiz</span>
      </div>
    </div>
  );
}

function ResearchPreview() {
  return (
    <div className="rounded-2xl bg-black/30 p-4 ring-1 ring-white/5">
      <div className="flex items-center justify-between text-[11px] text-muted">
        <span>Suggestions</span>
        <span className="rounded-full bg-blue/15 px-2 py-0.5 text-blue">30 / 100</span>
      </div>
      <div className="mt-3 space-y-2 text-[11px]">
        <div className="flex items-center justify-between rounded-lg bg-surface2 px-3 py-2">
          <span>
            <span className="line-through text-muted">independant</span>{" "}
            <span className="text-green">independent</span>
          </span>
          <span className="flex gap-1">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-green/85 text-black">
              <Check size={11} />
            </span>
            <span className="grid h-5 w-5 place-items-center rounded-full bg-red/85 text-black">
              ×
            </span>
          </span>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-surface2 px-3 py-2">
          <span>
            <span className="line-through text-muted">recieve</span>{" "}
            <span className="text-green">receive</span>
          </span>
          <span className="flex gap-1">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-green/85 text-black">
              <Check size={11} />
            </span>
            <span className="grid h-5 w-5 place-items-center rounded-full bg-red/85 text-black">
              ×
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

function PrivacyPreview() {
  return (
    <div className="rounded-2xl bg-black/30 p-4 ring-1 ring-white/5">
      <div className="flex items-center gap-2 text-[11px] text-muted">
        <Lock size={12} className="text-[#7AE3CC]" />
        Stored on this device · IndexedDB
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px] text-muted">
        <div className="rounded-lg bg-surface2 px-2 py-2">
          <div className="text-base font-semibold text-foreground">42</div>
          notes
        </div>
        <div className="rounded-lg bg-surface2 px-2 py-2">
          <div className="text-base font-semibold text-foreground">11</div>
          quizzes
        </div>
        <div className="rounded-lg bg-surface2 px-2 py-2">
          <div className="text-base font-semibold text-foreground">5</div>
          chats
        </div>
      </div>
    </div>
  );
}

function Features() {
  return (
    <section id="features" className="relative py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-5">
        <Reveal>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-teal">
            Six tools, one buddy
          </p>
        </Reveal>
        <Reveal delay={80}>
          <h2 className="mt-3 max-w-3xl text-balance text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
            <span className="lm-text-grad">Everything you need to study,</span>{" "}
            <span className="italic text-teal">nothing you'd pay for.</span>
          </h2>
        </Reveal>
        <Reveal delay={160}>
          <p className="mt-5 max-w-2xl text-muted">
            Each mode is wired to the same brain — your notes feed your quizzes,
            your quizzes feed your weak spots, and the mascot keeps you company.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-4 md:grid-cols-3">
          <FeatureCard
            tone="lime"
            icon={<Mic size={18} />}
            title="Talk with Bot"
            body="Press once. Talk. Hear it back. Real-time speech in, real-time voice out — the way you study with a friend, except this one never gets tired."
            preview={<TalkPreview />}
            size="lg"
          />
          <FeatureCard
            tone="purple"
            icon={<MessageSquare size={18} />}
            title="Chat with Bot"
            body="Streamed answers, code-aware, full history. Pin a chat to keep grinding the same topic."
            preview={<ChatPreview />}
          />
          <FeatureCard
            tone="teal"
            icon={<BookOpen size={18} />}
            title="Take Notes"
            body="Speak. We transcribe. Then summarize, rewrite, or turn it into a quiz with one tap."
            preview={<NotesPreview />}
          />
          <FeatureCard
            tone="pink"
            icon={<Sparkles size={18} />}
            title="Quiz with Bot"
            body="Five sharp MCQs from any note or topic. Tap or speak your answer. Instant feedback + rationale."
            preview={<QuizPreview />}
          />
          <FeatureCard
            tone="blue"
            icon={<FileText size={18} />}
            title="Research Assistant"
            body="Paste, upload, or scan a paper. Get a quality score, inline edits, and grammar fixes you can accept one at a time."
            preview={<ResearchPreview />}
          />
          <FeatureCard
            tone="mint"
            icon={<Lock size={18} />}
            title="Local & Private"
            body="No login required. Notes, quizzes, and chats live in your browser — close the tab, it stays yours."
            preview={<PrivacyPreview />}
          />
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── voice showcase ───────────────────────── */

function VoiceShowcase() {
  return (
    <section id="voice" className="relative overflow-hidden py-24 md:py-32">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 [background:radial-gradient(800px_circle_at_20%_30%,rgba(52,224,196,0.18),transparent_55%),radial-gradient(700px_circle_at_85%_70%,rgba(200,246,93,0.10),transparent_55%)]"
      />
      <div className="mx-auto max-w-6xl px-5">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <div>
            <Reveal>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-lime">
                Voice-first by design
              </p>
            </Reveal>
            <Reveal delay={80}>
              <h2 className="mt-3 text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
                <span className="lm-text-grad">Press once.</span>{" "}
                <span className="italic text-lime">Talk.</span>
                <br />
                <span className="lm-text-grad">Get answers spoken back.</span>
              </h2>
            </Reveal>
            <Reveal delay={160}>
              <p className="mt-5 max-w-md text-muted">
                The mascot blinks while it's idle, crosses its eyes while it
                listens, and softly pulses while it answers. Voice in your
                browser. No paid APIs. No microphone trips to the cloud you
                didn't approve.
              </p>
            </Reveal>
            <Reveal delay={240}>
              <ul className="mt-7 space-y-3 text-sm">
                {[
                  ["Live transcription", "Web Speech API · interim results · 90+ languages"],
                  ["Whisper fallback", "On-device, runs in Firefox via WebGPU/WASM"],
                  ["Mascot speaks back", "SpeechSynthesis · animated mouth on every reply"],
                ].map(([t, d]) => (
                  <li key={t} className="flex items-start gap-3">
                    <span className="mt-0.5 grid h-6 w-6 place-items-center rounded-full bg-teal/20 text-teal">
                      <Check size={13} />
                    </span>
                    <span>
                      <span className="font-medium text-foreground">{t}</span>
                      <span className="block text-xs text-muted">{d}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>

          {/* triple-state mascot panel */}
          <Reveal delay={120}>
            <div className="relative rounded-[32px] bg-surface/60 p-6 ring-1 ring-white/10 backdrop-blur md:p-8">
              <div className="grid grid-cols-3 gap-4">
                <StateCard label="Idle" tone="teal">
                  <HeroMascot size={140} state="idle" />
                </StateCard>
                <StateCard label="Listening" tone="lime">
                  <HeroMascot size={140} state="listening" />
                </StateCard>
                <StateCard label="Speaking" tone="purple">
                  <div style={{ animation: "lm-float 2.6s ease-in-out infinite" }}>
                    <HeroMascot size={140} state="idle" />
                  </div>
                </StateCard>
              </div>

              <div className="mt-6 rounded-2xl bg-black/40 p-5 ring-1 ring-white/5">
                <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-muted">
                  <span>Live waveform</span>
                  <span className="inline-flex items-center gap-1.5 text-teal">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal" />
                    Listening
                  </span>
                </div>
                <Waveform bars={42} tone="teal" className="mt-4" />
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function StateCard({
  label,
  tone,
  children,
}: {
  label: string;
  tone: "teal" | "lime" | "purple";
  children: ReactNode;
}) {
  const ring =
    tone === "teal"
      ? "ring-teal/30"
      : tone === "lime"
        ? "ring-lime/30"
        : "ring-purple/40";
  const tag =
    tone === "teal"
      ? "bg-teal/15 text-teal"
      : tone === "lime"
        ? "bg-lime/15 text-lime"
        : "bg-purple/20 text-purple";
  return (
    <div className={`flex flex-col items-center gap-3 rounded-2xl bg-black/30 p-4 ring-1 ${ring}`}>
      <div className="grid w-full place-items-center">{children}</div>
      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${tag}`}>
        {label}
      </span>
    </div>
  );
}

/* ───────────────────────── how it works ───────────────────────── */

function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Drop your free key",
      body: "Grab an OpenRouter key (no card needed), paste it into a .env. That's the entire setup.",
      icon: <Zap size={18} />,
      tone: "lime" as const,
    },
    {
      n: "02",
      title: "Pick a mode",
      body: "Talk, chat, take notes, quiz yourself, or polish research. Same buddy, six rooms.",
      icon: <MessageSquare size={18} />,
      tone: "purple" as const,
    },
    {
      n: "03",
      title: "Study, save, repeat",
      body: "Everything saves to your browser. Works offline after first load. Take it anywhere.",
      icon: <HeartHandshake size={18} />,
      tone: "pink" as const,
    },
  ];
  return (
    <section className="relative py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-5">
        <Reveal>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-purple">
            Three steps. That's it.
          </p>
        </Reveal>
        <Reveal delay={80}>
          <h2 className="mt-3 max-w-3xl text-balance text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
            <span className="lm-text-grad">From "I should study" to</span>{" "}
            <span className="italic text-purple">studying,</span>{" "}
            <span className="lm-text-grad">in under a minute.</span>
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {steps.map((s, i) => (
            <Reveal key={s.n} delay={i * 100}>
              <div className="group relative h-full overflow-hidden rounded-[28px] bg-surface/70 p-6 ring-1 ring-white/5 transition hover:ring-white/10">
                <div className="flex items-center justify-between">
                  <span className="text-5xl font-semibold tracking-tight text-white/10">
                    {s.n}
                  </span>
                  <ToneSwatch tone={s.tone} icon={s.icon} />
                </div>
                <h3 className="mt-6 text-2xl font-semibold tracking-tight">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── screens / mockups ───────────────────────── */

function PhoneShell({ children, accent }: { children: ReactNode; accent: string }) {
  return (
    <div
      className="relative h-[460px] w-[230px] shrink-0 overflow-hidden rounded-[36px] bg-[#0a0d0c] p-3 ring-1 ring-white/10"
      style={{ boxShadow: `0 30px 60px -20px ${accent}` }}
    >
      <div className="absolute left-1/2 top-2 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-black" />
      <div className="relative h-full w-full overflow-hidden rounded-[28px] bg-bg">
        {children}
      </div>
    </div>
  );
}

function ScreenHome() {
  return (
    <div className="flex h-full flex-col px-4 pt-10">
      <div className="flex items-center gap-2 text-[10px] text-muted">
        <Image src="/mascot/idle.png" alt="" width={30} height={20} />
        <span className="font-semibold text-foreground">LearnMate</span>
      </div>
      <h4 className="mt-4 text-base font-semibold leading-tight">
        How can I help you today?
      </h4>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="col-span-1 row-span-2 rounded-2xl bg-lime p-3 text-black">
          <Mic size={14} />
          <div className="mt-12 text-xs font-semibold">Talk with Bot</div>
          <div className="mt-1 text-[9px] opacity-70">Voice ↗</div>
        </div>
        <div className="rounded-2xl bg-purple p-3 text-black">
          <MessageSquare size={14} />
          <div className="mt-5 text-[11px] font-semibold">Chat with Bot</div>
        </div>
        <div className="rounded-2xl bg-pink p-3 text-black">
          <Sparkles size={14} />
          <div className="mt-5 text-[11px] font-semibold">Quiz with Bot</div>
        </div>
      </div>
      <div className="mt-3 text-[10px] uppercase tracking-wider text-muted">
        History
      </div>
      <div className="mt-2 space-y-1.5">
        {["Calculus notes", "C++ pointers", "Spanish drills"].map((t) => (
          <div key={t} className="flex items-center justify-between rounded-xl bg-surface px-2.5 py-1.5 text-[10px]">
            <span>{t}</span>
            <span className="text-muted">↗</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScreenNotes() {
  return (
    <div className="flex h-full flex-col items-center px-4 pt-12">
      <Image src="/mascot/idle.png" alt="" width={84} height={56} />
      <div className="mt-3 text-center text-xs">Currently listening…</div>
      <div className="mt-6 w-full">
        <Waveform bars={16} tone="teal" />
      </div>
      <p className="mt-6 text-center text-[10px] leading-relaxed text-muted">
        Python decorators wrap a function with extra behavior without modifying
        the body…
      </p>
      <div className="mt-auto flex items-center gap-3 pb-6">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-surface ring-1 ring-white/10">
          ⏸
        </span>
        <span className="grid h-12 w-12 place-items-center rounded-full bg-teal text-black ring-4 ring-teal/30">
          <Mic size={16} />
        </span>
        <span className="grid h-9 w-9 place-items-center rounded-full bg-surface ring-1 ring-white/10">
          ⏭
        </span>
      </div>
    </div>
  );
}

function ScreenQuiz() {
  return (
    <div className="flex h-full flex-col px-4 pt-10">
      <div className="text-[10px] text-muted">Python Class Quiz</div>
      <div className="mt-2 flex items-center gap-2 text-[10px]">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-1/5 rounded-full bg-pink" />
        </div>
        <span>1/5</span>
      </div>
      <div className="mt-4 text-xs font-semibold">
        What is the output of this code?
      </div>
      <div className="mt-2 rounded-lg bg-black/60 px-2 py-1.5 font-mono text-[10px] text-teal/90">
        print(3 * "abc")
      </div>
      <div className="mt-3 space-y-1.5 text-[10px]">
        <div className="rounded-lg bg-green/85 px-2 py-1.5 text-black">A · "abcabcabc"</div>
        <div className="rounded-lg bg-surface px-2 py-1.5">B · 9</div>
        <div className="rounded-lg bg-surface px-2 py-1.5">C · "abc3"</div>
        <div className="rounded-lg bg-surface px-2 py-1.5">D · Error</div>
      </div>
      <div className="mt-auto flex items-center justify-center pb-6">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-pink text-black">
          <Mic size={14} />
        </span>
      </div>
    </div>
  );
}

function ScreenResearch() {
  return (
    <div className="flex h-full flex-col px-4 pt-10">
      <div className="text-[10px] font-semibold">Suggestions</div>
      <div className="mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-blue/15 px-2 py-0.5 text-[9px] text-blue">
        30 / 100
      </div>
      <div className="mt-3 space-y-1.5 text-[10px]">
        {[
          ["independant", "independent"],
          ["recieve", "receive"],
          ["definately", "definitely"],
          ["occured", "occurred"],
        ].map(([bad, good]) => (
          <div key={bad} className="flex items-center justify-between rounded-lg bg-surface px-2 py-1.5">
            <span>
              <span className="line-through text-muted">{bad}</span>{" "}
              <span className="text-green">{good}</span>
            </span>
            <span className="flex gap-1">
              <span className="grid h-4 w-4 place-items-center rounded-full bg-green/85 text-black">
                ✓
              </span>
              <span className="grid h-4 w-4 place-items-center rounded-full bg-red/85 text-black">
                ✕
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScreenTalk() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-4">
      <Image src="/mascot/listening.png" alt="" width={120} height={80} />
      <div className="mt-4 text-center text-[11px] leading-relaxed text-muted">
        "Please help me<br />with my research project"
      </div>
      <div className="mt-6">
        <Waveform bars={14} tone="lime" />
      </div>
      <div className="mt-auto pb-8">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-lime text-black ring-4 ring-lime/30">
          <Mic size={16} />
        </span>
      </div>
    </div>
  );
}

function ScreensGallery() {
  const screens = [
    { key: "home", el: <ScreenHome />, accent: "rgba(52,224,196,0.35)" },
    { key: "notes", el: <ScreenNotes />, accent: "rgba(200,246,93,0.35)" },
    { key: "quiz", el: <ScreenQuiz />, accent: "rgba(247,184,210,0.35)" },
    { key: "research", el: <ScreenResearch />, accent: "rgba(59,111,224,0.35)" },
    { key: "talk", el: <ScreenTalk />, accent: "rgba(201,167,245,0.35)" },
  ];
  return (
    <section id="screens" className="relative py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-5">
        <Reveal>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-pink">
            See it in motion
          </p>
        </Reveal>
        <Reveal delay={80}>
          <h2 className="mt-3 max-w-3xl text-balance text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
            <span className="lm-text-grad">Designed like an app</span>{" "}
            <span className="italic text-pink">you'd actually open.</span>
          </h2>
        </Reveal>
      </div>

      <div className="relative mt-14">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-32 bg-gradient-to-r from-bg to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-32 bg-gradient-to-l from-bg to-transparent" />
        <div className="flex gap-6 overflow-x-auto px-5 pb-6 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {screens.map((s, i) => (
            <div
              key={s.key}
              style={{
                animation: `lm-float ${6 + (i % 3)}s ease-in-out ${i * 0.3}s infinite`,
              }}
            >
              <PhoneShell accent={s.accent}>{s.el}</PhoneShell>
            </div>
          ))}
          {/* repeat for length */}
          {screens.map((s, i) => (
            <div
              key={s.key + "-b"}
              style={{
                animation: `lm-float ${6 + ((i + 2) % 3)}s ease-in-out ${i * 0.4}s infinite`,
              }}
            >
              <PhoneShell accent={s.accent}>{s.el}</PhoneShell>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── pricing ───────────────────────── */

function Pricing() {
  return (
    <section id="pricing" className="relative py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-5">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <div>
            <Reveal>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-teal">
                Pricing
              </p>
            </Reveal>
            <Reveal delay={80}>
              <h2 className="mt-3 text-balance text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
                <span className="lm-text-grad">One plan.</span>{" "}
                <span className="italic text-teal">$0.</span>{" "}
                <span className="lm-text-grad">Built to stay that way.</span>
              </h2>
            </Reveal>
            <Reveal delay={160}>
              <p className="mt-5 max-w-md text-muted">
                LearnMate calls only free AI models (Llama, Qwen, DeepSeek,
                Gemma — all $0 tier) and uses browser-native voice. No card,
                no subscription, no trial that turns into a bill.
              </p>
            </Reveal>
            <Reveal delay={240}>
              <div className="mt-6 flex flex-wrap items-center gap-2 text-xs text-muted">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-surface/70 px-3 py-1 ring-1 ring-white/5">
                  <Globe size={12} /> Web Speech API
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-surface/70 px-3 py-1 ring-1 ring-white/5">
                  <Zap size={12} /> OpenRouter :free
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-surface/70 px-3 py-1 ring-1 ring-white/5">
                  <Wifi size={12} /> Works offline
                </span>
              </div>
            </Reveal>
          </div>

          <Reveal delay={120}>
            <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-b from-surface/90 to-surface/40 p-8 ring-1 ring-teal/20">
              <div
                aria-hidden
                className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-teal/20 blur-3xl"
              />
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-2 rounded-full bg-teal/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-teal ring-1 ring-teal/30">
                  Forever free
                </div>
                <span className="text-xs text-muted">no card</span>
              </div>
              <div className="mt-8 flex items-end gap-2">
                <span className="text-6xl font-semibold tracking-tight">$0</span>
                <span className="pb-2 text-sm text-muted">/ ever</span>
              </div>
              <p className="mt-3 max-w-sm text-sm text-muted">
                Bring your own free OpenRouter key. We never see your data —
                everything stays on your device.
              </p>
              <ul className="mt-7 grid gap-2 text-sm">
                {[
                  "Talk · Chat · Notes · Quiz · Research",
                  "Real-time voice in & out",
                  "Local storage · works offline",
                  "PWA · install on any device",
                  "All 6 free AI models, auto fallback",
                  "Future updates — included",
                ].map((line) => (
                  <li key={line} className="flex items-start gap-3">
                    <span className="mt-0.5 grid h-5 w-5 place-items-center rounded-full bg-teal/20 text-teal">
                      <Check size={12} />
                    </span>
                    {line}
                  </li>
                ))}
              </ul>
              <Link
                href="/welcome"
                className="mt-8 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-teal text-sm font-semibold text-black transition hover:bg-[#5af3d6]"
              >
                Get LearnMate <ArrowUpRight size={16} />
              </Link>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── testimonials ───────────────────────── */

function Testimonials() {
  const items = [
    {
      quote:
        "I talked through my entire bio lecture on the walk home and had a 5-question quiz waiting in my pocket.",
      who: "Ana — pre-med, year 2",
      tone: "lime" as const,
    },
    {
      quote:
        "The research grader caught typos my advisor didn't. For free. I'm slightly offended on her behalf.",
      who: "Marcus — political science",
      tone: "purple" as const,
    },
    {
      quote:
        "It feels less like a chatbot and more like a roommate who actually did the reading.",
      who: "Priya — CS sophomore",
      tone: "pink" as const,
    },
  ];
  return (
    <section className="relative py-24 md:py-28">
      <div className="mx-auto max-w-6xl px-5">
        <Reveal>
          <h2 className="max-w-3xl text-balance text-3xl font-semibold tracking-tight md:text-5xl">
            <span className="lm-text-grad">Made for students who learn out loud.</span>
          </h2>
        </Reveal>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {items.map((t, i) => {
            const ring =
              t.tone === "lime"
                ? "ring-lime/25"
                : t.tone === "purple"
                  ? "ring-purple/30"
                  : "ring-pink/30";
            const dot =
              t.tone === "lime"
                ? "bg-lime"
                : t.tone === "purple"
                  ? "bg-purple"
                  : "bg-pink";
            return (
              <Reveal key={t.who} delay={i * 80}>
                <figure
                  className={`relative h-full overflow-hidden rounded-[28px] bg-surface/60 p-6 ring-1 ${ring}`}
                >
                  <span
                    aria-hidden
                    className="absolute right-5 top-4 text-6xl font-serif text-white/10"
                  >
                    &ldquo;
                  </span>
                  <blockquote className="text-base leading-relaxed text-foreground/90">
                    {t.quote}
                  </blockquote>
                  <figcaption className="mt-5 flex items-center gap-3 text-xs text-muted">
                    <span className={`h-2 w-2 rounded-full ${dot}`} />
                    {t.who}
                  </figcaption>
                </figure>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── FAQ ───────────────────────── */

function FAQItem({ q, a }: { q: string; a: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-2xl bg-surface/60 ring-1 ring-white/5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-medium"
        aria-expanded={open}
      >
        <span>{q}</span>
        <span
          className={`grid h-7 w-7 shrink-0 place-items-center rounded-full bg-teal/15 text-teal transition ${
            open ? "rotate-180" : ""
          }`}
        >
          {open ? <Minus size={14} /> : <Plus size={14} />}
        </span>
      </button>
      <div
        className={`grid transition-all duration-300 ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="px-5 pb-5 text-sm leading-relaxed text-muted">{a}</div>
        </div>
      </div>
    </div>
  );
}

function FAQ() {
  const items = [
    {
      q: "Is LearnMate really free? Where's the catch?",
      a: "Truly free. The AI runs through OpenRouter's :free model tier and voice runs on the Web Speech API your browser already ships. We don't sell, upsell, or trial-trap you.",
    },
    {
      q: "Do I need an account?",
      a: "No. Skip login entirely — notes, quizzes, and chats save to your browser. If you want cloud sync later, you can connect a free Supabase account, optional.",
    },
    {
      q: "Where does my data go?",
      a: "By default, nowhere. Notes/quizzes live in IndexedDB on this device. Your prompts hit our small Next.js proxy only to add the API key, and we never store them.",
    },
    {
      q: "What if a free model hits a rate limit?",
      a: "We auto-fallback through four free models and back off cleanly. Worst case you see a friendly 'Bot is resting' state for a moment — your work isn't lost.",
    },
    {
      q: "Which browsers work?",
      a: "Chrome, Edge, and Safari for everything. Firefox swaps in Whisper running locally via WebGPU/WASM for transcription — slightly slower first load, otherwise identical.",
    },
    {
      q: "Can I install it like an app?",
      a: "Yes. LearnMate is a PWA — hit 'Install' from your browser and it lives in your dock or home screen, works offline after the first load.",
    },
  ];
  return (
    <section id="faq" className="relative py-24 md:py-32">
      <div className="mx-auto max-w-3xl px-5">
        <Reveal>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-teal">
            Questions you might be thinking
          </p>
        </Reveal>
        <Reveal delay={80}>
          <h2 className="mt-3 text-balance text-4xl font-semibold tracking-tight md:text-5xl">
            <span className="lm-text-grad">Quick answers, no fine print.</span>
          </h2>
        </Reveal>
        <div className="mt-10 space-y-3">
          {items.map((it, i) => (
            <Reveal key={it.q} delay={i * 40}>
              <FAQItem q={it.q} a={it.a} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── final CTA ───────────────────────── */

function FinalCTA() {
  return (
    <section className="relative overflow-hidden py-24 md:py-32">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 [background:radial-gradient(900px_circle_at_50%_120%,rgba(52,224,196,0.30),transparent_55%),radial-gradient(700px_circle_at_20%_0%,rgba(201,167,245,0.18),transparent_55%)]"
      />
      <div className="mx-auto max-w-5xl px-5 text-center">
        <Reveal>
          <div className="mx-auto" style={{ animation: "lm-float 6s ease-in-out infinite" }}>
            <HeroMascot size={220} />
          </div>
        </Reveal>
        <Reveal delay={120}>
          <h2 className="mt-6 text-balance text-5xl font-semibold leading-[0.98] tracking-tight md:text-7xl">
            <span className="lm-text-grad">Stop highlighting.</span>
            <br />
            <span className="lm-text-teal-grad italic">Start learning.</span>
          </h2>
        </Reveal>
        <Reveal delay={200}>
          <p className="mx-auto mt-6 max-w-xl text-muted">
            One free key. A talking robot. Six tools. Zero excuses.
          </p>
        </Reveal>
        <Reveal delay={280}>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/welcome"
              className="group relative inline-flex h-14 items-center gap-2 overflow-hidden rounded-full bg-teal px-7 text-base font-semibold text-black transition hover:bg-[#5af3d6]"
            >
              Open LearnMate
              <ArrowUpRight size={18} className="transition group-hover:rotate-45" />
              <span className="lm-shine absolute inset-0" />
            </Link>
            <a
              href="#features"
              className="inline-flex h-14 items-center rounded-full bg-surface/70 px-6 text-base font-medium text-foreground ring-1 ring-white/10 transition hover:bg-surface"
            >
              Browse features
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ───────────────────────── footer ───────────────────────── */

function Footer() {
  return (
    <footer className="border-t border-white/5 bg-surface/30">
      <div className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <span className="relative inline-flex h-8 w-12 items-center justify-center">
              <Image
                src="/mascot/idle.png"
                alt=""
                fill
                sizes="48px"
                className="object-contain"
              />
            </span>
            <span className="text-sm font-semibold tracking-tight">LearnMate</span>
            <span className="rounded-full bg-teal/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-teal ring-1 ring-teal/30">
              v0 · free
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted">
            <a href="#features" className="transition hover:text-foreground">Features</a>
            <a href="#voice" className="transition hover:text-foreground">Voice</a>
            <a href="#screens" className="transition hover:text-foreground">Screens</a>
            <a href="#pricing" className="transition hover:text-foreground">Pricing</a>
            <a href="#faq" className="transition hover:text-foreground">FAQ</a>
            <Link href="/welcome" className="transition hover:text-foreground">Get started</Link>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-start justify-between gap-3 border-t border-white/5 pt-6 text-[11px] text-muted md:flex-row md:items-center">
          <span>© 2026 LearnMate · Built with free AI</span>
          <span>Made for students who learn out loud.</span>
        </div>
      </div>
    </footer>
  );
}

/* ───────────────────────── page ───────────────────────── */

export default function LandingPage() {
  useEffect(() => {
    document.documentElement.classList.add("lm-no-scrollbar");
    return () => {
      document.documentElement.classList.remove("lm-no-scrollbar");
    };
  }, []);
  return (
    <div className="relative min-h-dvh overflow-hidden bg-bg text-foreground">
      <Nav />
      <main className="relative">
        <Hero />
        <Marquee />
        <Features />
        <VoiceShowcase />
        <HowItWorks />
        <ScreensGallery />
        <Testimonials />
        <Pricing />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
