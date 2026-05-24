"use client";

// /home data — user_stats + home_history views, with Dexie-derived fallback for guests.

import { sb, activeUserId, tsToMs } from "@/lib/db/_client";
import { db } from "@/lib/db/dexie";

export interface UserStats {
  chats: number;
  messages: number;
  notes: number;
  quizzes: number;
  attempts: number;
  research: number;
  streakDays: number;
}

export type HistoryKind = "chat" | "note" | "quiz" | "research";

export interface HistoryItem {
  kind: HistoryKind;
  refId: string;
  title: string;
  at: number;
}

const EMPTY_STATS: UserStats = {
  chats: 0,
  messages: 0,
  notes: 0,
  quizzes: 0,
  attempts: 0,
  research: 0,
  streakDays: 0,
};

async function statsFromDexie(): Promise<UserStats> {
  if (typeof window === "undefined") return EMPTY_STATS;
  try {
    const [chatRows, msgCount, noteRows, quizRows, attemptRows, researchRows] =
      await Promise.all([
        db().chats.toArray(),
        db().messages.count(),
        db().noteSessions.toArray(),
        db().quizzes.toArray(),
        db().quizAttempts.toArray(),
        db().researchDocs.toArray(),
      ]);

    const days = new Set<string>();
    const push = (ts: number) => {
      const d = new Date(ts);
      days.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    };
    chatRows.forEach((r) => push(r.createdAt));
    noteRows.forEach((r) => push(r.createdAt));
    quizRows.forEach((r) => push(r.createdAt));
    attemptRows.forEach((r) => push(r.completedAt));
    researchRows.forEach((r) => push(r.createdAt));

    const today = new Date();
    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (days.has(key)) streak++;
      else if (i === 0) continue;
      else break;
    }

    return {
      chats: chatRows.length,
      messages: msgCount,
      notes: noteRows.length,
      quizzes: quizRows.length,
      attempts: attemptRows.length,
      research: researchRows.length,
      streakDays: streak,
    };
  } catch {
    return EMPTY_STATS;
  }
}

export async function getUserStats(): Promise<UserStats> {
  const uid = activeUserId();
  if (!uid) return statsFromDexie();
  try {
    const { data, error } = await sb()
      .from("user_stats")
      .select(
        "chats_count, messages_count, notes_count, quizzes_count, attempts_count, research_count, streak_days",
      )
      .eq("user_id", uid)
      .maybeSingle();
    if (error) throw error;
    if (!data) return EMPTY_STATS;
    const r = data as {
      chats_count: number;
      messages_count: number;
      notes_count: number;
      quizzes_count: number;
      attempts_count: number;
      research_count: number;
      streak_days: number;
    };
    return {
      chats: r.chats_count ?? 0,
      messages: r.messages_count ?? 0,
      notes: r.notes_count ?? 0,
      quizzes: r.quizzes_count ?? 0,
      attempts: r.attempts_count ?? 0,
      research: r.research_count ?? 0,
      streakDays: r.streak_days ?? 0,
    };
  } catch {
    return EMPTY_STATS;
  }
}

async function historyFromDexie(limit: number): Promise<HistoryItem[]> {
  if (typeof window === "undefined") return [];
  try {
    const [chats, notes, quizzes, research] = await Promise.all([
      db().chats.toArray(),
      db().noteSessions.toArray(),
      db().quizzes.toArray(),
      db().researchDocs.toArray(),
    ]);
    const merged: HistoryItem[] = [
      ...chats.map((c) => ({
        kind: "chat" as const,
        refId: String(c.id),
        title: c.title,
        at: c.updatedAt,
      })),
      ...notes.map((n) => ({
        kind: "note" as const,
        refId: String(n.id),
        title: n.title,
        at: n.updatedAt,
      })),
      ...quizzes.map((q) => ({
        kind: "quiz" as const,
        refId: String(q.id),
        title: q.topic,
        at: q.createdAt,
      })),
      ...research.map((r) => ({
        kind: "research" as const,
        refId: String(r.id),
        title: r.title,
        at: r.updatedAt,
      })),
    ];
    merged.sort((a, b) => b.at - a.at);
    return merged.slice(0, limit);
  } catch {
    return [];
  }
}

export async function listHomeHistory(limit = 8): Promise<HistoryItem[]> {
  const uid = activeUserId();
  if (!uid) return historyFromDexie(limit);
  try {
    const { data, error } = await sb()
      .from("home_history")
      .select("kind, ref_id, title, at")
      .order("at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return ((data ?? []) as Array<{
      kind: HistoryKind;
      ref_id: string;
      title: string;
      at: string;
    }>).map((r) => ({
      kind: r.kind,
      refId: r.ref_id,
      title: r.title,
      at: tsToMs(r.at),
    }));
  } catch {
    return [];
  }
}
