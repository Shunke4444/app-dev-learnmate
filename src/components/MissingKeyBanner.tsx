import { hasApiKey } from "@/lib/env";

export function MissingKeyBanner() {
  if (hasApiKey()) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="relative z-50 w-full border-b border-amber-400/30 bg-amber-500/10 px-4 py-2.5 text-[12.5px] text-amber-100 backdrop-blur-md sm:text-sm"
    >
      <div className="mx-auto flex max-w-5xl items-center gap-3">
        <span
          aria-hidden
          className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-amber-400/20 text-amber-200 ring-1 ring-amber-400/30"
        >
          !
        </span>
        <div className="min-w-0 leading-snug">
          <strong className="font-semibold text-amber-50">
            AI features disabled.
          </strong>{" "}
          Add{" "}
          <code className="rounded bg-black/30 px-1.5 py-0.5 text-[11.5px] text-amber-50 ring-1 ring-white/10">
            OPENROUTER_API_KEY
          </code>{" "}
          to{" "}
          <code className="rounded bg-black/30 px-1.5 py-0.5 text-[11.5px] text-amber-50 ring-1 ring-white/10">
            .env.local
          </code>{" "}
          and restart{" "}
          <code className="rounded bg-black/30 px-1.5 py-0.5 text-[11.5px] text-amber-50 ring-1 ring-white/10">
            npm run dev
          </code>
          . Get a free key at{" "}
          <a
            href="https://openrouter.ai/keys"
            target="_blank"
            rel="noreferrer"
            className="font-semibold underline underline-offset-2 hover:text-amber-50"
          >
            openrouter.ai/keys
          </a>
          .
        </div>
      </div>
    </div>
  );
}
