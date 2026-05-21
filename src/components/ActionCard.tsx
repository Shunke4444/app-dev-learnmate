import type { ReactNode } from "react";

type Tone = "lime" | "purple" | "pink" | "teal";

export function ActionCard({
  tone,
  title,
  badge,
  icon,
  compact,
  description,
}: {
  tone: Tone;
  title: string;
  badge: string;
  icon: ReactNode;
  compact?: boolean;
  description?: string;
}) {
  const bg =
    tone === "lime"
      ? "bg-lime"
      : tone === "purple"
        ? "bg-purple"
        : tone === "pink"
          ? "bg-pink"
          : "bg-teal";

  return (
    <div
      className={
        "group relative overflow-hidden rounded-[var(--radius-card)] p-5 text-black shadow-[var(--shadow-soft)] lm-card-hover " +
        bg +
        (compact ? " h-[120px]" : " h-[260px]")
      }
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/30 blur-2xl opacity-40 transition group-hover:opacity-60"
      />
      <div className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/15 backdrop-blur-sm">
        {icon}
      </div>

      {compact ? (
        <div className="mt-4 text-sm font-semibold leading-tight">
          {title}
        </div>
      ) : (
        <div className="whitespace-pre-line text-[28px] font-semibold leading-[1.05] tracking-tight">
          {title}
        </div>
      )}

      {description && !compact && (
        <div className="mt-3 max-w-[22ch] text-[12px] font-medium text-black/70">
          {description}
        </div>
      )}

      <div className="absolute bottom-4 left-4 rounded-full bg-black/15 px-3 py-1 text-[11px] font-semibold backdrop-blur-sm">
        {badge}
      </div>
    </div>
  );
}
