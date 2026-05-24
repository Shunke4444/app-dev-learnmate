// Always start in `auto`: a sticky `web-speech` made Brave/Arc users retry the
// broken cloud path on every page load. Auto lets the recognition wrapper swap
// to whisper transparently on network errors.

import type { EngineChoice } from "./recognition";
import { readLocalPrefs, updatePreferences } from "@/lib/db/preferences";

export function loadPreferredEngine(): EngineChoice {
  return "auto";
}

export function rememberEngine(engine: "web-speech" | "whisper") {
  if (typeof window === "undefined") return;
  void updatePreferences({ voiceEngine: engine });
}

export function clearEnginePreference() {
  if (typeof window === "undefined") return;
  void updatePreferences({ voiceEngine: "auto" });
}

export function getCachedEngine(): "auto" | "web-speech" | "whisper" {
  if (typeof window === "undefined") return "auto";
  return readLocalPrefs().voiceEngine;
}
