"use client";

import { Mic, MicOff } from "lucide-react";

type VoiceFABProps = {
  active: boolean;
  onClick?: () => void;
  size?: "sm" | "lg";
  ariaLabel?: string;
};

export function VoiceFAB({
  active,
  onClick,
  size = "lg",
  ariaLabel,
}: VoiceFABProps) {
  const dim = size === "lg" ? "h-16 w-16" : "h-12 w-12";
  const icon = size === "lg" ? 24 : 18;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel ?? (active ? "Stop listening" : "Start listening")}
      aria-pressed={active}
      className={
        "relative inline-flex items-center justify-center rounded-full transition active:scale-95 " +
        dim +
        " " +
        (active
          ? "bg-teal text-black shadow-[0_18px_60px_-10px_rgba(52,224,196,0.6)]"
          : "bg-surface2/90 text-foreground ring-1 ring-white/10 hover:bg-surface2")
      }
    >
      {active && <span className="lm-pulse-ring" aria-hidden />}
      {active && (
        <span
          className="lm-pulse-ring"
          style={{ animationDelay: "600ms" }}
          aria-hidden
        />
      )}
      {active ? <Mic size={icon} /> : <MicOff size={icon} />}
    </button>
  );
}
