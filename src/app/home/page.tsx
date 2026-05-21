import Link from "next/link";
import {
  ArrowUpRight,
  Book,
  Clock,
  FileText,
  MessageSquare,
  Mic,
  MoreHorizontal,
  Sparkles,
} from "lucide-react";
import { ActionCard } from "@/components/ActionCard";
import { AppShell } from "@/components/AppShell";

const history = [
  {
    color: "lime",
    title: "I need some UI inspiration for dark…",
    when: "2h ago",
  },
  {
    color: "purple",
    title: "Show me some color palettes for AI…",
    when: "Yesterday",
  },
  {
    color: "pink",
    title: "What are the best mobile apps 2025…",
    when: "Mon",
  },
] as const;

const stats = [
  { label: "Sessions", value: "24", accent: "text-teal" },
  { label: "Notes saved", value: "12", accent: "text-lime" },
  { label: "Quizzes taken", value: "8", accent: "text-purple" },
  { label: "Streak", value: "5d", accent: "text-pink" },
];

const suggestions = [
  { icon: Mic, label: "Record a class", href: "/talk", tone: "bg-lime/15 text-lime" },
  { icon: Book, label: "Open notes library", href: "/notes", tone: "bg-blue/20 text-foreground" },
  { icon: Sparkles, label: "Quick quiz", href: "/quiz", tone: "bg-pink/15 text-pink" },
  { icon: FileText, label: "Polish writing", href: "/research", tone: "bg-purple/15 text-purple" },
];

export default function HomePage() {
  return (
    <AppShell>
      <div className="mx-auto w-full max-w-[1180px]">
        <div className="lm-rise flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
              Good afternoon
            </div>
            <h1 className="mt-3 text-3xl font-semibold leading-[1.1] tracking-tight md:text-[44px]">
              How can I help <span className="lm-text-teal-grad">you today?</span>
            </h1>
          </div>
          <Link
            href="/talk"
            className="hidden items-center gap-2 rounded-2xl bg-teal px-4 py-2.5 text-sm font-semibold text-black shadow-[0_14px_50px_-12px_rgba(52,224,196,0.55)] hover:brightness-95 md:inline-flex"
          >
            <Mic size={16} />
            Start a session
          </Link>
        </div>

        <div className="lm-rise lm-rise-1 mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-2xl bg-surface/45 p-4 ring-1 ring-white/5 backdrop-blur"
            >
              <div className={"text-2xl font-semibold tracking-tight " + s.accent}>
                {s.value}
              </div>
              <div className="mt-1 text-[11px] uppercase tracking-wider text-muted">
                {s.label}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
          <div>
            <div className="lm-rise lm-rise-2 grid grid-cols-2 gap-4">
              <Link href="/talk" className="block">
                <ActionCard
                  tone="lime"
                  title={"Talk\nwith Bot"}
                  badge="Voice mode"
                  description="Capture lectures, ask questions out loud."
                  icon={<ArrowUpRight size={18} className="opacity-80" />}
                />
              </Link>
              <div className="grid grid-rows-2 gap-4">
                <Link href="/chat" className="block">
                  <ActionCard
                    tone="purple"
                    title="Chat with Bot"
                    badge="Text chat"
                    icon={<ArrowUpRight size={16} className="opacity-80" />}
                    compact
                  />
                </Link>
                <Link href="/quiz" className="block">
                  <ActionCard
                    tone="pink"
                    title="Quiz with Bot"
                    badge="Test recall"
                    icon={<ArrowUpRight size={16} className="opacity-80" />}
                    compact
                  />
                </Link>
              </div>
            </div>

            <div className="lm-rise lm-rise-3 mt-6">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Quick actions</div>
                <Link
                  href="/notes"
                  className="text-xs text-muted hover:text-foreground"
                >
                  Explore more
                </Link>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
                {suggestions.map((s) => (
                  <Link
                    key={s.label}
                    href={s.href}
                    className="group flex items-center gap-3 rounded-2xl bg-surface/45 p-3 ring-1 ring-white/5 transition hover:bg-surface/65"
                  >
                    <span
                      className={
                        "inline-flex h-9 w-9 items-center justify-center rounded-xl " +
                        s.tone
                      }
                    >
                      <s.icon size={16} />
                    </span>
                    <span className="text-xs font-semibold text-foreground/90">
                      {s.label}
                    </span>
                    <ArrowUpRight
                      size={14}
                      className="ml-auto text-muted transition group-hover:text-foreground"
                    />
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <section className="lm-rise lm-rise-2 rounded-[var(--radius-card)] bg-surface/45 p-5 ring-1 ring-white/5 backdrop-blur">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Clock size={15} className="text-muted" />
                History
              </div>
              <button className="text-xs text-muted hover:text-foreground" type="button">
                See all
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-2.5">
              {history.map((h, idx) => (
                <div
                  key={idx}
                  className="group flex items-center gap-3 rounded-2xl bg-surface/65 px-3.5 py-3 ring-1 ring-white/5 transition hover:bg-surface/85"
                >
                  <span
                    className={
                      "h-9 w-9 shrink-0 rounded-full ring-1 ring-white/10 " +
                      (h.color === "lime"
                        ? "bg-lime/90"
                        : h.color === "purple"
                          ? "bg-purple/90"
                          : "bg-pink/90")
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium text-foreground/95">
                      {h.title}
                    </div>
                    <div className="mt-0.5 text-[10px] text-muted">{h.when}</div>
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/25 text-foreground/80 transition group-hover:bg-black/40"
                    aria-label="History menu"
                  >
                    <MoreHorizontal size={15} />
                  </button>
                </div>
              ))}
            </div>

            <Link
              href="/chat"
              className="mt-5 flex items-center justify-center gap-2 rounded-2xl bg-bg/40 px-4 py-2.5 text-xs font-semibold text-foreground/85 ring-1 ring-white/5 hover:bg-bg/55"
            >
              <MessageSquare size={14} />
              New conversation
            </Link>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
