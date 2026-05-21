import type { ReactNode } from "react";

export function PillButton({
  children,
  variant,
  type,
  onClick,
  disabled,
  icon,
}: {
  children: ReactNode;
  variant: "surface" | "google" | "facebook" | "primary" | "outline";
  type?: "button" | "submit";
  onClick?: () => void;
  disabled?: boolean;
  icon?: ReactNode;
}) {
  const base =
    "inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/70 disabled:opacity-60 disabled:pointer-events-none active:scale-[0.99]";

  const cls =
    variant === "surface"
      ? "bg-surface/80 text-foreground ring-1 ring-white/5 hover:bg-surface"
      : variant === "google"
        ? "bg-[#7B3A33] text-white/90 hover:bg-[#8A433B] ring-1 ring-white/5"
        : variant === "facebook"
          ? "bg-[#263C67] text-white/90 hover:bg-[#2B4476] ring-1 ring-white/5"
          : variant === "primary"
            ? "bg-teal text-black hover:brightness-95 ring-1 ring-white/10 shadow-[0_14px_50px_-12px_rgba(52,224,196,0.55)]"
            : "bg-transparent text-foreground ring-1 ring-white/15 hover:bg-white/5";

  return (
    <button
      type={type ?? "button"}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${cls}`}
    >
      {icon}
      {children}
    </button>
  );
}
