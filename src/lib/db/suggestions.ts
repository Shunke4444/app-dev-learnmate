"use client";

// prompt_suggestions — list globals + per-user labels for /talk, /quiz, /notes.

import { sb, activeUserId } from "@/lib/db/_client";

export type SuggestionKind = "talk" | "quiz" | "notes";

export interface PromptSuggestion {
  id: string;
  label: string;
  pinned: boolean;
  global: boolean;
}

export const FALLBACKS: Record<SuggestionKind, string[]> = {
  talk: [
    "Take notes for my class",
    "Quiz me on Python loops",
    "Summarize last lecture",
    "Translate to Spanish",
  ],
  quiz: [
    "Python loops & comprehensions",
    "Photosynthesis basics",
    "World War II causes",
    "Mitosis vs meiosis",
    "Pythagorean theorem",
  ],
  notes: ["Python class", "Calculus lecture", "History reading"],
};

function authed(): boolean {
  return activeUserId() !== null;
}

function fallbackRows(kind: SuggestionKind): PromptSuggestion[] {
  return FALLBACKS[kind].map((label, i) => ({
    id: `fallback:${kind}:${i}`,
    label,
    pinned: false,
    global: true,
  }));
}

export async function listPromptSuggestions(
  kind: SuggestionKind,
): Promise<PromptSuggestion[]> {
  if (!authed()) return fallbackRows(kind);
  try {
    const { data, error } = await sb()
      .from("prompt_suggestions")
      .select("id, label, pinned, user_id, position, created_at")
      .eq("kind", kind)
      .order("pinned", { ascending: false })
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw error;
    const rows = (data ?? []) as Array<{
      id: string;
      label: string;
      pinned: boolean;
      user_id: string | null;
    }>;
    if (rows.length === 0) return fallbackRows(kind);
    return rows.map((r) => ({
      id: r.id,
      label: r.label,
      pinned: r.pinned,
      global: r.user_id === null,
    }));
  } catch {
    return fallbackRows(kind);
  }
}

export async function addPromptSuggestion(
  kind: SuggestionKind,
  label: string,
): Promise<void> {
  const uid = activeUserId();
  if (!uid) return;
  const trimmed = label.trim();
  if (!trimmed) return;
  try {
    await sb()
      .from("prompt_suggestions")
      .insert({ user_id: uid, kind, label: trimmed });
  } catch {
    // ignore
  }
}

export async function pinPromptSuggestion(
  id: string,
  pinned: boolean,
): Promise<void> {
  if (!authed()) return;
  try {
    await sb().from("prompt_suggestions").update({ pinned }).eq("id", id);
  } catch {
    // ignore
  }
}

export async function deletePromptSuggestion(id: string): Promise<void> {
  if (!authed()) return;
  try {
    await sb().from("prompt_suggestions").delete().eq("id", id);
  } catch {
    // ignore
  }
}
