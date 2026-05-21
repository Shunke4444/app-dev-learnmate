import type { ReactNode } from "react";

export function PillButton({
  children,
  variant,
  type,
  onClick,
  disabled,
}: {
  children: ReactNode;
  variant: "surface" | "google" | "facebook";
  type?: "button" | "submit";
  onClick?: () => void;
  disabled?: boolean;
}) {
  const base =
    "inline-flex h-12 w-full items-center justify-center rounded-2xl text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/70 disabled:opacity-60 disabled:pointer-events-none";

  const cls =
    variant === "surface"
      ? "bg-surface/80 text-foreground ring-1 ring-white/5 hover:bg-surface"
      : variant === "google"
        ? "bg-[#7B3A33] text-white/90 hover:bg-[#8A433B]"
        : "bg-[#263C67] text-white/90 hover:bg-[#2B4476]";

  return (
    <button
      type={type ?? "button"}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${cls}`}
    >
      {children}
    </button>
  );
}
