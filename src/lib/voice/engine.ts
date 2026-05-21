// Remembers which speech-recognition engine worked last time so Brave / Arc
// users don't burn a Web Speech round-trip on every page load just to discover
// it's still blocked.

import type { EngineChoice } from "./recognition";

const KEY = "lm:voice-engine";

export function loadPreferredEngine(): EngineChoice {
  // Always start in auto mode. The wrapper will swap to whisper transparently
  // on network errors. Storing "web-speech" as a sticky preference caused
  // Brave/Arc users to retry the broken cloud path on every page load.
  return "auto";
}

export function rememberEngine(engine: "web-speech" | "whisper") {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, engine);
  } catch {
    // ignore
  }
}

export function clearEnginePreference() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
