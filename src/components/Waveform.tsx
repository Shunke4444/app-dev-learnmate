type WaveformProps = {
  bars?: number;
  active?: boolean;
  className?: string;
  height?: number;
  /** Optional live 0..1 amplitude. When set, drives the bars instead of CSS animation. */
  level?: number;
};

export function Waveform({
  bars = 28,
  active = true,
  className,
  height = 56,
  level,
}: WaveformProps) {
  const arr = Array.from({ length: bars }, (_, i) => i);
  const live = typeof level === "number";
  return (
    <div
      className={
        "flex items-center justify-center gap-[5px] " + (className ?? "")
      }
      style={{ height }}
      aria-hidden
    >
      {arr.map((i) => {
        const seed = (Math.sin(i * 1.7) + 1) / 2;
        const delay = ((i % 7) * 90) + Math.round(seed * 40);
        // Static (no `level`): seed-driven bars; CSS keyframe animates while active.
        // Live (`level` set): bar height tracks mic amplitude with a per-bar shape.
        const baseH = 30 + Math.round(seed * 70);
        const liveH = active && live
          ? Math.max(8, Math.min(100, (level ?? 0) * (60 + seed * 80) + 8))
          : baseH;
        return (
          <span
            key={i}
            className="lm-wave-bar"
            style={{
              height: `${liveH}%`,
              animationDelay: `${delay}ms`,
              animationPlayState: active && !live ? "running" : "paused",
              opacity: active ? 1 : 0.4,
              transition: live ? "height 80ms linear" : undefined,
            }}
          />
        );
      })}
    </div>
  );
}
