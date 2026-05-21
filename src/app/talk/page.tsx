import Link from "next/link";
import { Mic } from "lucide-react";
import { AppShell } from "@/components/AppShell";

export default function TalkPage() {
  return (
    <AppShell>
      <div className="mx-auto w-full max-w-[1100px]">
        <div className="rounded-[var(--radius-card)] bg-surface/45 p-6 ring-1 ring-white/5 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Talk with Bot</h1>
              <p className="mt-2 max-w-[70ch] text-sm text-muted">
                Voice mode placeholder. Next steps: hook up `SpeechRecognition` for live
                transcription, then send turns through the server AI proxy.
              </p>
            </div>
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-lime text-black ring-1 ring-white/10">
              <Mic size={18} />
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl bg-bg/35 p-4 ring-1 ring-white/5">
              <div className="text-xs font-semibold text-muted">Status</div>
              <div className="mt-2 text-sm">Not listening</div>
            </div>
            <div className="rounded-2xl bg-bg/35 p-4 ring-1 ring-white/5">
              <div className="text-xs font-semibold text-muted">Transcript</div>
              <div className="mt-2 text-sm text-muted">(coming soon)</div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              className="rounded-2xl bg-lime px-4 py-2 text-sm font-medium text-black ring-1 ring-white/10 hover:brightness-95"
              type="button"
              disabled
              aria-disabled
            >
              Start listening
            </button>
            <button
              className="rounded-2xl bg-surface/70 px-4 py-2 text-sm font-medium text-foreground ring-1 ring-white/5 hover:bg-surface"
              type="button"
              disabled
              aria-disabled
            >
              Stop
            </button>
            <Link
              href="/home"
              className="rounded-2xl bg-surface/40 px-4 py-2 text-sm font-medium text-muted ring-1 ring-white/5 hover:bg-surface/60 hover:text-foreground"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
