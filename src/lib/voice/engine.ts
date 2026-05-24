// Engine preference logic:
//
// - `auto` (default): recognition wrapper picks web-speech, falls back to
//   whisper transparently on network errors.
// - A *passive* remembered engine (via `rememberEngine`) is just diagnostic —
//   the active engine that succeeded last time. It does NOT force a choice
//   because a sticky `web-speech` re-triggered the broken cloud path every
//   load on Brave/Arc.
// - A *forced* engine (via `forceEngine`) is the explicit user choice from
//   the in-app toggle. We honor it as the actual engine on next start.

import type { EngineChoice } from "./recognition";
import { readLocalPrefs, updatePreferences } from "@/lib/db/preferences";

const FORCED_KEY = "learnmate-voice-engine-forced";

function readForced(): "web-speech" | "whisper" | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(FORCED_KEY);
    if (v === "web-speech" || v === "whisper") return v;
  } catch {
    // strict-mode localStorage disabled
  }
  return null;
}

function writeForced(v: "web-speech" | "whisper" | null): void {
  if (typeof window === "undefined") return;
  try {
    if (v === null) window.localStorage.removeItem(FORCED_KEY);
    else window.localStorage.setItem(FORCED_KEY, v);
  } catch {
    // ignore
  }
}

export function loadPreferredEngine(): EngineChoice {
  return readForced() ?? "auto";
}

export function rememberEngine(engine: "web-speech" | "whisper") {
  if (typeof window === "undefined") return;
  void updatePreferences({ voiceEngine: engine });
}

export function clearEnginePreference() {
  if (typeof window === "undefined") return;
  writeForced(null);
  void updatePreferences({ voiceEngine: "auto" });
}

export function getForcedEngine(): "web-speech" | "whisper" | null {
  return readForced();
}

export function forceEngine(engine: "web-speech" | "whisper" | null): void {
  writeForced(engine);
}

export function getCachedEngine(): "auto" | "web-speech" | "whisper" {
  if (typeof window === "undefined") return "auto";
  return readLocalPrefs().voiceEngine;
}
