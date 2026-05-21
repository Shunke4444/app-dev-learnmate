import Image from "next/image";

export type MascotState = "idle" | "listening" | "speaking";

const stateToSrc: Record<MascotState, string> = {
  idle: "/mascot/idle.png",
  listening: "/mascot/listening.png",
  speaking: "/mascot/idle.png",
};

export function Mascot({
  state,
  size,
  className,
}: {
  state: MascotState;
  size: number;
  className?: string;
}) {
  const src = stateToSrc[state];

  return (
    <div
      className={
        "relative" +
        (state === "speaking" ? " animate-[pulse_1.2s_ease-in-out_infinite]" : "") +
        (className ? " " + className : "")
      }
      style={{ width: size, height: size }}
    >
      <Image
        src={src}
        alt="LearnMate mascot"
        fill
        priority
        sizes={`${size}px`}
        className="object-contain"
      />
    </div>
  );
}

export function MascotMini() {
  return (
    <div className="relative h-5 w-8">
      <Image
        // Use an existing asset; we don't currently ship a dedicated mini logo.
        src="/mascot/idle.png"
        alt="LearnMate"
        fill
        sizes="32px"
        priority
        className="object-contain"
      />
    </div>
  );
}
