import type { ReactNode } from "react";

export function ActionCard({
  tone,
  title,
  badge,
  icon,
  compact,
}: {
  tone: "lime" | "purple" | "pink";
  title: string;
  badge: string;
  icon: ReactNode;
  compact?: boolean;
}) {
  const bg =
    tone === "lime" ? "bg-lime" : tone === "purple" ? "bg-purple" : "bg-pink";

  return (
    <div
      className={
        "relative overflow-hidden rounded-[var(--radius-card)] p-5 text-black shadow-[var(--shadow-soft)] " +
        bg +
        (compact ? " h-[116px]" : " h-[252px]")
      }
    >
      <div className="absolute right-4 top-4">{icon}</div>

      {compact ? (
        <div className="mt-6 text-sm font-semibold">{title}</div>
      ) : (
        <div className="whitespace-pre-line text-2xl font-semibold leading-[1.1]">
          {title}
        </div>
      )}

      <div className="absolute bottom-4 left-4 rounded-full bg-black/10 px-3 py-1 text-[11px] font-medium">
        {badge}
      </div>
    </div>
  );
}
