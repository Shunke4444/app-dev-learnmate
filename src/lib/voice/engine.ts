// Remembers which speech-recognition engine worked last time so Brave / Arc
// users don't burn a Web Speech round-trip on every page load just to discover
// it's still blocked.

import type { EngineChoice } from "./recognition";

const KEY = "lm:voice-engine";

export function loadPreferredEngine(): EngineChoice {
  if (typeof window === "undefined") return "auto";
  try {
    const v = window.localStorage.getItem(KEY);
    if (v === "web-speech" || v === "whisper" || v === "auto") return v;
  } catch {
    // localStorage can throw in strict privacy modes — fall through.
  }
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
