import Link from "next/link";
import { ArrowUpRight, MoreHorizontal } from "lucide-react";
import { ActionCard } from "@/components/ActionCard";
import { AppShell } from "@/components/AppShell";

const history = [
  {
    color: "lime",
    title: "I need some UI inspiration for dark...",
  },
  {
    color: "purple",
    title: "Show me some color palettes for AI...",
  },
  {
    color: "pink",
    title: "What are the best mobile apps 2023...",
  },
] as const;

export default function HomePage() {
  return (
    <AppShell>
      <div className="mx-auto w-full max-w-[1100px]">
        <div className="grid gap-10 lg:grid-cols-[1.35fr_0.65fr]">
          <div>
            <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight md:text-5xl">
              How can I help <span className="text-muted">you today?</span>
            </h1>
            <p className="mt-4 max-w-[64ch] text-sm text-muted">
              Pick a mode to start. This is a UI-first prototype; AI/voice wiring comes next.
            </p>

            <div className="mt-8 grid grid-cols-2 gap-5">
              <Link href="/talk" className="block">
                <ActionCard
                  tone="lime"
                  title="Talk\nwith Bot"
                  badge="Talk with Bot"
                  icon={<ArrowUpRight className="opacity-70" size={16} />}
                />
              </Link>
              <div className="grid grid-rows-2 gap-5">
                <Link href="/chat" className="block">
                  <ActionCard
                    tone="purple"
                    title="Chat with Bot"
                    badge="Chat with Bot"
                    icon={<ArrowUpRight className="opacity-70" size={16} />}
                    compact
                  />
                </Link>
                <Link href="/quiz" className="block">
                  <ActionCard
                    tone="pink"
                    title="Quiz with Bot"
                    badge="Quiz with Bot"
                    icon={<ArrowUpRight className="opacity-70" size={16} />}
                    compact
                  />
                </Link>
              </div>
            </div>
          </div>

          <section className="rounded-[var(--radius-card)] bg-surface/45 p-5 ring-1 ring-white/5 backdrop-blur">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">History</div>
              <button className="text-xs text-muted hover:text-foreground" type="button">
                See all
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-3">
              {history.map((h, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 rounded-2xl bg-surface/65 px-4 py-3 ring-1 ring-white/5"
                >
                  <span
                    className={
                      "h-8 w-8 rounded-full ring-1 ring-white/10 " +
                      (h.color === "lime"
                        ? "bg-lime/90"
                        : h.color === "purple"
                          ? "bg-purple/90"
                          : "bg-pink/90")
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs text-foreground/90">{h.title}</div>
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/25 text-foreground/80 hover:bg-black/35"
                    aria-label="History menu"
                  >
                    <MoreHorizontal size={16} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
