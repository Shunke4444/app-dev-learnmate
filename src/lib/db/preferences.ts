"use client";

// user_preferences CRUD. Replaces localStorage settings for signed-in users.
// Guests still use localStorage (no DB row to write).

import { sb, activeUserId } from "@/lib/db/_client";

export type VoiceEngine = "auto" | "web-speech" | "whisper";
export type ThemePref = "dark" | "light" | "system";

export interface UserPreferences {
  sidebarCollapsed: boolean;
  voiceEngine: VoiceEngine;
  ttsVoice: string | null;
  ttsRate: number;
  ttsPitch: number;
  theme: ThemePref;
  locale: string;
  onboardedAt: number | null;
  lastSeenAt: number | null;
}

const DEFAULTS: UserPreferences = {
  sidebarCollapsed: false,
  voiceEngine: "auto",
  ttsVoice: null,
  ttsRate: 1.0,
  ttsPitch: 1.0,
  theme: "dark",
  locale: "en-US",
  onboardedAt: null,
  lastSeenAt: null,
};

const LS_KEYS = {
  sidebar: "lm:sidebar-collapsed",
  voiceEngine: "lm:voice-engine",
  ttsVoice: "lm:tts-voice",
  ttsRate: "lm:tts-rate",
  ttsPitch: "lm:tts-pitch",
  theme: "lm:theme",
  locale: "lm:locale",
  onboarded: "lm:onboarded-at",
};

function numWithDefault(raw: string | null, fallback: number): number {
  if (raw == null) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function readLocal(): UserPreferences {
  if (typeof window === "undefined") return DEFAULTS;
  const ls = window.localStorage;
  try {
    const onboardedRaw = ls.getItem(LS_KEYS.onboarded);
    return {
      sidebarCollapsed: ls.getItem(LS_KEYS.sidebar) === "1",
      voiceEngine: (ls.getItem(LS_KEYS.voiceEngine) as VoiceEngine) || "auto",
      ttsVoice: ls.getItem(LS_KEYS.ttsVoice),
      ttsRate: numWithDefault(ls.getItem(LS_KEYS.ttsRate), 1.0),
      ttsPitch: numWithDefault(ls.getItem(LS_KEYS.ttsPitch), 1.0),
      theme: (ls.getItem(LS_KEYS.theme) as ThemePref) || "dark",
      locale: ls.getItem(LS_KEYS.locale) || "en-US",
      onboardedAt: onboardedRaw ? numWithDefault(onboardedRaw, 0) || null : null,
      lastSeenAt: null,
    };
  } catch {
    return DEFAULTS;
  }
}

function writeLocal(patch: Partial<UserPreferences>) {
  if (typeof window === "undefined") return;
  const ls = window.localStorage;
  try {
    if (patch.sidebarCollapsed !== undefined)
      ls.setItem(LS_KEYS.sidebar, patch.sidebarCollapsed ? "1" : "0");
    if (patch.voiceEngine !== undefined)
      ls.setItem(LS_KEYS.voiceEngine, patch.voiceEngine);
    if (patch.ttsVoice !== undefined && patch.ttsVoice !== null)
      ls.setItem(LS_KEYS.ttsVoice, patch.ttsVoice);
    if (patch.ttsRate !== undefined)
      ls.setItem(LS_KEYS.ttsRate, String(patch.ttsRate));
    if (patch.ttsPitch !== undefined)
      ls.setItem(LS_KEYS.ttsPitch, String(patch.ttsPitch));
    if (patch.theme !== undefined) ls.setItem(LS_KEYS.theme, patch.theme);
    if (patch.locale !== undefined) ls.setItem(LS_KEYS.locale, patch.locale);
    if (patch.onboardedAt !== undefined && patch.onboardedAt !== null)
      ls.setItem(LS_KEYS.onboarded, String(patch.onboardedAt));
  } catch {
    // privacy mode — ignore
  }
}

type Row = {
  sidebar_collapsed: boolean;
  voice_engine: VoiceEngine;
  tts_voice: string | null;
  tts_rate: number | string;
  tts_pitch: number | string;
  theme: ThemePref;
  locale: string;
  onboarded_at: string | null;
  last_seen_at: string | null;
};

function rowToPrefs(r: Row): UserPreferences {
  return {
    sidebarCollapsed: r.sidebar_collapsed,
    voiceEngine: r.voice_engine,
    ttsVoice: r.tts_voice,
    ttsRate: Number(r.tts_rate),
    ttsPitch: Number(r.tts_pitch),
    theme: r.theme,
    locale: r.locale,
    onboardedAt: r.onboarded_at ? Date.parse(r.onboarded_at) : null,
    lastSeenAt: r.last_seen_at ? Date.parse(r.last_seen_at) : null,
  };
}

const PREF_COLS =
  "sidebar_collapsed, voice_engine, tts_voice, tts_rate, tts_pitch, theme, locale, onboarded_at, last_seen_at";

export function readLocalPrefs(): UserPreferences {
  return readLocal();
}

// Module-level cache so route changes (AppShell remounts) don't re-fetch on
// every navigation. Cleared via clearCachedPrefs() on sign-out / sign-in.
let _cached: { uid: string; prefs: UserPreferences } | null = null;
let _inflight: Promise<UserPreferences> | null = null;

export function clearCachedPrefs(): void {
  _cached = null;
  _inflight = null;
}

export async function loadPreferences(): Promise<UserPreferences> {
  const uid = activeUserId();
  if (!uid) return readLocal();
  if (_cached && _cached.uid === uid) return _cached.prefs;
  if (_inflight) return _inflight;

  _inflight = (async () => {
    try {
      // Upsert-on-conflict + select in a single round-trip. The trigger seeds
      // the row at signup; this also covers pre-trigger accounts (1 RTT total).
      const { data, error } = await sb()
        .from("user_preferences")
        .upsert(
          { user_id: uid },
          { onConflict: "user_id", ignoreDuplicates: false },
        )
        .select(PREF_COLS)
        .single();
      if (error) throw error;
      const prefs = rowToPrefs(data as Row);
      writeLocal(prefs);
      _cached = { uid, prefs };
      return prefs;
    } catch {
      return readLocal();
    } finally {
      _inflight = null;
    }
  })();
  return _inflight;
}

export async function updatePreferences(
  patch: Partial<UserPreferences>,
): Promise<void> {
  writeLocal(patch);
  const uid = activeUserId();
  if (!uid) return;
  if (_cached && _cached.uid === uid) {
    _cached = { uid, prefs: { ..._cached.prefs, ...patch } };
  }
  const row: Record<string, unknown> = {};
  if (patch.sidebarCollapsed !== undefined)
    row.sidebar_collapsed = patch.sidebarCollapsed;
  if (patch.voiceEngine !== undefined) row.voice_engine = patch.voiceEngine;
  if (patch.ttsVoice !== undefined) row.tts_voice = patch.ttsVoice;
  if (patch.ttsRate !== undefined) row.tts_rate = patch.ttsRate;
  if (patch.ttsPitch !== undefined) row.tts_pitch = patch.ttsPitch;
  if (patch.theme !== undefined) row.theme = patch.theme;
  if (patch.locale !== undefined) row.locale = patch.locale;
  if (patch.onboardedAt !== undefined)
    row.onboarded_at = patch.onboardedAt
      ? new Date(patch.onboardedAt).toISOString()
      : null;
  if (patch.lastSeenAt !== undefined)
    row.last_seen_at = patch.lastSeenAt
      ? new Date(patch.lastSeenAt).toISOString()
      : null;
  if (Object.keys(row).length === 0) return;
  try {
    await sb()
      .from("user_preferences")
      .upsert({ user_id: uid, ...row }, { onConflict: "user_id" });
  } catch {
    // best effort — localStorage is authoritative for first paint
  }
}

// One-shot migration: push current localStorage settings into the DB on first
// signed-in load (e.g., user signs up after using guest mode).
export async function migrateLocalPrefsToDb(): Promise<void> {
  if (!activeUserId()) return;
  const local = readLocal();
  await updatePreferences(local);
}
