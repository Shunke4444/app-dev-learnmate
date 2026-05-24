"use client";

// research_suggestions — persist accept/reject across reloads.

import { sb, activeUserId } from "@/lib/db/_client";
import type { ResearchSuggestion } from "@/lib/ai/schemas";

export type SuggestionStatus = "open" | "accepted" | "rejected";

export interface PersistedSuggestion extends ResearchSuggestion {
  id: string;
  status: SuggestionStatus;
  spanStart: number | null;
  spanEnd: number | null;
}

type Row = {
  id: string;
  type: ResearchSuggestion["type"];
  original: string;
  replacement: string;
  explanation: string | null;
  status: SuggestionStatus;
  span_start: number | null;
  span_end: number | null;
};

function rowToSuggestion(r: Row): PersistedSuggestion {
  return {
    id: r.id,
    type: r.type,
    original: r.original,
    replacement: r.replacement,
    explanation: r.explanation ?? "",
    status: r.status,
    spanStart: r.span_start,
    spanEnd: r.span_end,
  };
}

function localFallback(
  suggestions: ResearchSuggestion[],
): PersistedSuggestion[] {
  const stamp = Date.now();
  return suggestions.map((s, i) => ({
    ...s,
    id: `local:${stamp}:${i}`,
    status: "open" as const,
    spanStart: null,
    spanEnd: null,
  }));
}

export async function insertResearchSuggestions(
  docId: string,
  suggestions: ResearchSuggestion[],
): Promise<PersistedSuggestion[]> {
  const uid = activeUserId();
  if (!uid || suggestions.length === 0) return localFallback(suggestions);
  try {
    // Replace prior open suggestions for this doc.
    await sb()
      .from("research_suggestions")
      .delete()
      .eq("doc_id", docId)
      .eq("status", "open");

    const rows = suggestions.map((s) => ({
      doc_id: docId,
      user_id: uid,
      type: s.type,
      original: s.original,
      replacement: s.replacement,
      explanation: s.explanation,
      status: "open" as const,
    }));
    const { data, error } = await sb()
      .from("research_suggestions")
      .insert(rows)
      .select("id, type, original, replacement, explanation, status, span_start, span_end");
    if (error) throw error;
    return ((data ?? []) as Row[]).map(rowToSuggestion);
  } catch {
    return localFallback(suggestions);
  }
}

export async function listResearchSuggestions(
  docId: string,
): Promise<PersistedSuggestion[]> {
  if (!activeUserId()) return [];
  try {
    const { data, error } = await sb()
      .from("research_suggestions")
      .select("id, type, original, replacement, explanation, status, span_start, span_end")
      .eq("doc_id", docId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return ((data ?? []) as Row[]).map(rowToSuggestion);
  } catch {
    return [];
  }
}

export async function setSuggestionStatus(
  id: string,
  status: SuggestionStatus,
): Promise<void> {
  if (!activeUserId()) return;
  if (id.startsWith("local:")) return;
  try {
    await sb()
      .from("research_suggestions")
      .update({
        status,
        resolved_at: status === "open" ? null : new Date().toISOString(),
      })
      .eq("id", id);
  } catch {
    // ignore
  }
}
