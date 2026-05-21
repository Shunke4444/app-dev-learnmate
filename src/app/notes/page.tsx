import Link from "next/link";
import { BookOpen, Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";

const items = [
  { title: "Python Class", when: "Today" },
  { title: "Math Class", when: "Yesterday" },
  { title: "Programming Class — C++", when: "Saved" },
] as const;

export default function NotesPage() {
  return (
    <AppShell>
      <div className="mx-auto w-full max-w-[1100px]">
        <div className="flex items-center gap-3">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-blue text-white ring-1 ring-white/10">
            <BookOpen size={18} />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight">Notes</h1>
            <p className="mt-1 text-sm text-muted">
              Placeholder library. Next: store sessions in IndexedDB and add voice capture.
            </p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <button
              className="inline-flex items-center gap-2 rounded-2xl bg-surface/70 px-4 py-2 text-sm font-medium text-foreground ring-1 ring-white/5 hover:bg-surface"
              type="button"
              disabled
              aria-disabled
            >
              <Plus size={16} />
              New note
            </button>
            <Link
              href="/home"
              className="rounded-2xl bg-surface/40 px-4 py-2 text-sm font-medium text-muted ring-1 ring-white/5 hover:bg-surface/60 hover:text-foreground"
            >
              Home
            </Link>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {items.map((it) => (
            <div
              key={it.title}
              className="rounded-[var(--radius-card)] bg-surface/45 p-5 ring-1 ring-white/5 backdrop-blur"
            >
              <div className="text-xs font-semibold text-muted">{it.when}</div>
              <div className="mt-2 text-base font-semibold tracking-tight">
                {it.title}
              </div>
              <div className="mt-3 text-sm text-muted">
                Open to view transcript, summarize, rewrite, save, or generate a quiz.
              </div>
              <button
                className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-bg/35 px-4 py-2 text-sm font-medium text-muted ring-1 ring-white/5 hover:bg-bg/45 hover:text-foreground"
                type="button"
                disabled
                aria-disabled
              >
                Open
              </button>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
