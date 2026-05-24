"use client";

// Unified data layer. Routes reads/writes to Supabase for signed-in users and
// to Dexie (IndexedDB) for guests / users without Supabase configured.
// Same shape as src/lib/db/dexie.ts so consumers can import from here instead.

import { sb, activeUserId, tsToMs } from "@/lib/db/_client";
import * as dex from "@/lib/db/dexie";

// Re-export shared shapes. We widen `id` to allow string UUIDs from Supabase.
export type ChatMode = dex.ChatMode;
export type Id = string | number;

export interface Chat {
  id: Id;
  mode: ChatMode;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface Message {
  id: Id;
  chatId: Id;
  role: "user" | "assistant";
  text: string;
  createdAt: number;
}

export interface NoteSession {
  id: Id;
  title: string;
  subject: string;
  status: "live" | "done" | "saved";
  transcript: string;
  summary?: string;
  rewrite?: string;
  createdAt: number;
  updatedAt: number;
}

export type QuizQuestionRow = dex.QuizQuestionRow;

export interface Quiz {
  id: Id;
  topic: string;
  sourceNoteId?: Id;
  questions: QuizQuestionRow[];
  createdAt: number;
}

export interface ResearchDoc {
  id: Id;
  title: string;
  text: string;
  score?: number;
  summary?: string;
  createdAt: number;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Row mappers (Postgres snake_case -> app camelCase).
// ---------------------------------------------------------------------------
type ChatRow = {
  id: string;
  mode: ChatMode;
  title: string;
  created_at: string;
  updated_at: string;
};
function mapChat(r: ChatRow): Chat {
  return {
    id: r.id,
    mode: r.mode,
    title: r.title,
    createdAt: tsToMs(r.created_at),
    updatedAt: tsToMs(r.updated_at),
  };
}

type MessageRow = {
  id: string;
  chat_id: string;
  role: "user" | "assistant";
  text: string;
  created_at: string;
};
function mapMessage(r: MessageRow): Message {
  return {
    id: r.id,
    chatId: r.chat_id,
    role: r.role,
    text: r.text,
    createdAt: tsToMs(r.created_at),
  };
}

type NoteRow = {
  id: string;
  title: string;
  subject: string;
  status: "live" | "done" | "saved";
  transcript: string;
  summary: string | null;
  rewrite: string | null;
  created_at: string;
  updated_at: string;
};
function mapNote(r: NoteRow): NoteSession {
  return {
    id: r.id,
    title: r.title,
    subject: r.subject,
    status: r.status,
    transcript: r.transcript ?? "",
    summary: r.summary ?? undefined,
    rewrite: r.rewrite ?? undefined,
    createdAt: tsToMs(r.created_at),
    updatedAt: tsToMs(r.updated_at),
  };
}

type QuizRow = {
  id: string;
  topic: string;
  source_note_id: string | null;
  questions: QuizQuestionRow[];
  created_at: string;
};
function mapQuiz(r: QuizRow): Quiz {
  return {
    id: r.id,
    topic: r.topic,
    sourceNoteId: r.source_note_id ?? undefined,
    questions: r.questions,
    createdAt: tsToMs(r.created_at),
  };
}

// ---------------------------------------------------------------------------
// Chats
// ---------------------------------------------------------------------------
export async function getOrCreateChat(mode: ChatMode): Promise<Chat> {
  const uid = activeUserId();
  if (!uid) {
    const c = await dex.getOrCreateChat(mode);
    return { ...c, id: c.id! };
  }

  const { data: existing, error: selErr } = await sb()
    .from("chats")
    .select("id, mode, title, created_at, updated_at")
    .eq("user_id", uid)
    .eq("mode", mode)
    .maybeSingle();
  if (selErr) throw selErr;
  if (existing) return mapChat(existing as ChatRow);

  const { data: created, error: insErr } = await sb()
    .from("chats")
    .insert({
      user_id: uid,
      mode,
      title: mode === "chat" ? "Chat with Bot" : "Talk with Bot",
    })
    .select("id, mode, title, created_at, updated_at")
    .single();
  if (insErr) throw insErr;
  return mapChat(created as ChatRow);
}

export async function listMessages(chatId: Id): Promise<Message[]> {
  const uid = activeUserId();
  if (!uid) {
    const rows = await dex.listMessages(chatId as number);
    return rows.map((m) => ({
      id: m.id!,
      chatId: m.chatId,
      role: m.role,
      text: m.text,
      createdAt: m.createdAt,
    }));
  }

  const { data, error } = await sb()
    .from("messages")
    .select("id, chat_id, role, text, created_at")
    .eq("chat_id", chatId as string)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as MessageRow[]).map(mapMessage);
}

export async function appendMessage(
  chatId: Id,
  role: Message["role"],
  text: string,
): Promise<Id> {
  const uid = activeUserId();
  if (!uid) {
    return dex.appendMessage(chatId as number, role, text);
  }

  const nowIso = new Date().toISOString();
  const { data, error } = await sb()
    .from("messages")
    .insert({
      chat_id: chatId as string,
      user_id: uid,
      role,
      text,
    })
    .select("id")
    .single();
  if (error) throw error;
  // Bump parent chat updated_at — best-effort, RLS will permit (user owns it).
  await sb()
    .from("chats")
    .update({ updated_at: nowIso })
    .eq("id", chatId as string);
  return (data as { id: string }).id;
}

export async function pruneEmptyMessages(chatId: Id): Promise<void> {
  const uid = activeUserId();
  if (!uid) return dex.pruneEmptyMessages(chatId as number);
  await sb()
    .from("messages")
    .delete()
    .eq("chat_id", chatId as string)
    .eq("text", "");
}

// Trim a candidate title from a message body — first sentence-ish, max ~80 chars.
function deriveTitle(raw: string): string {
  const stripped = raw
    .replace(/\n*--- attachment:[\s\S]*?--- end attachment ---\n*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!stripped) return "";
  const head = stripped.length > 80 ? stripped.slice(0, 77).trimEnd() + "…" : stripped;
  return head;
}

export async function maybeRenameChat(chatId: Id, fromMessage: string): Promise<void> {
  const title = deriveTitle(fromMessage);
  if (!title) return;
  const uid = activeUserId();
  if (!uid) {
    try {
      await dex.db().chats.update(chatId as number, { title });
    } catch {
      // ignore — Dexie unavailable
    }
    return;
  }
  // Only overwrite the default placeholder, never a user-derived title.
  await sb()
    .from("chats")
    .update({ title })
    .eq("id", chatId as string)
    .in("title", ["Chat with Bot", "Talk with Bot"]);
}

// ---------------------------------------------------------------------------
// Note sessions
// ---------------------------------------------------------------------------
export async function createNoteSession(input: {
  title: string;
  subject?: string;
}): Promise<NoteSession> {
  const uid = activeUserId();
  if (!uid) {
    const s = await dex.createNoteSession(input);
    return mapDexNote(s);
  }

  const { data, error } = await sb()
    .from("note_sessions")
    .insert({
      user_id: uid,
      title: input.title,
      subject: input.subject ?? "General",
    })
    .select(
      "id, title, subject, status, transcript, summary, rewrite, created_at, updated_at",
    )
    .single();
  if (error) throw error;
  return mapNote(data as NoteRow);
}

export async function updateNoteSession(
  id: Id,
  patch: Partial<NoteSession>,
): Promise<void> {
  const uid = activeUserId();
  if (!uid) {
    const dexPatch: Partial<dex.NoteSession> = {};
    if (patch.title !== undefined) dexPatch.title = patch.title;
    if (patch.subject !== undefined) dexPatch.subject = patch.subject;
    if (patch.status !== undefined) dexPatch.status = patch.status;
    if (patch.transcript !== undefined) dexPatch.transcript = patch.transcript;
    if (patch.summary !== undefined) dexPatch.summary = patch.summary;
    if (patch.rewrite !== undefined) dexPatch.rewrite = patch.rewrite;
    return dex.updateNoteSession(id as number, dexPatch);
  }

  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.subject !== undefined) row.subject = patch.subject;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.transcript !== undefined) row.transcript = patch.transcript;
  if (patch.summary !== undefined) row.summary = patch.summary;
  if (patch.rewrite !== undefined) row.rewrite = patch.rewrite;

  const { error } = await sb()
    .from("note_sessions")
    .update(row)
    .eq("id", id as string);
  if (error) throw error;
}

export async function listNoteSessions(): Promise<NoteSession[]> {
  const uid = activeUserId();
  if (!uid) {
    const rows = await dex.listNoteSessions();
    return rows.map(mapDexNote);
  }

  const { data, error } = await sb()
    .from("note_sessions")
    .select(
      "id, title, subject, status, transcript, summary, rewrite, created_at, updated_at",
    )
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as NoteRow[]).map(mapNote);
}

export async function getNoteSession(id: Id): Promise<NoteSession | undefined> {
  const uid = activeUserId();
  if (!uid) {
    const s = await dex.getNoteSession(id as number);
    return s ? mapDexNote(s) : undefined;
  }
  const { data, error } = await sb()
    .from("note_sessions")
    .select(
      "id, title, subject, status, transcript, summary, rewrite, created_at, updated_at",
    )
    .eq("id", id as string)
    .maybeSingle();
  if (error) throw error;
  return data ? mapNote(data as NoteRow) : undefined;
}

export async function deleteNoteSession(id: Id): Promise<void> {
  const uid = activeUserId();
  if (!uid) return dex.deleteNoteSession(id as number);

  // 1. Remove storage blobs first — FK cascade will drop note_attachments rows,
  //    but blobs in the note-audio bucket would otherwise orphan.
  const { data: attachments } = await sb()
    .from("note_attachments")
    .select("storage_path")
    .eq("note_id", id as string);
  const paths = ((attachments ?? []) as { storage_path: string }[])
    .map((a) => a.storage_path)
    .filter(Boolean);
  if (paths.length > 0) {
    try {
      await sb().storage.from("note-audio").remove(paths);
    } catch {
      // best-effort — the row delete still proceeds
    }
  }

  // 2. ON DELETE SET NULL cascades quizzes.source_note_id; we also remove the
  //    orphan quizzes explicitly so attempts aren't stranded.
  const { data: orphanQuizzes } = await sb()
    .from("quizzes")
    .select("id")
    .eq("source_note_id", id as string);
  const orphanIds = ((orphanQuizzes ?? []) as { id: string }[]).map((q) => q.id);
  if (orphanIds.length > 0) {
    await sb().from("quizzes").delete().in("id", orphanIds);
  }
  const { error } = await sb()
    .from("note_sessions")
    .delete()
    .eq("id", id as string);
  if (error) throw error;
}

function mapDexNote(s: dex.NoteSession): NoteSession {
  return {
    id: s.id!,
    title: s.title,
    subject: s.subject,
    status: s.status,
    transcript: s.transcript,
    summary: s.summary,
    rewrite: s.rewrite,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Quizzes
// ---------------------------------------------------------------------------
export async function saveQuiz(input: {
  topic: string;
  sourceNoteId?: Id;
  questions: QuizQuestionRow[];
}): Promise<Quiz> {
  const uid = activeUserId();
  if (!uid) {
    const q = await dex.saveQuiz({
      topic: input.topic,
      sourceNoteId: input.sourceNoteId as number | undefined,
      questions: input.questions,
    });
    return {
      id: q.id!,
      topic: q.topic,
      sourceNoteId: q.sourceNoteId,
      questions: q.questions,
      createdAt: q.createdAt,
    };
  }

  const { data, error } = await sb()
    .from("quizzes")
    .insert({
      user_id: uid,
      topic: input.topic,
      source_note_id: (input.sourceNoteId as string | undefined) ?? null,
      questions: input.questions,
    })
    .select("id, topic, source_note_id, questions, created_at")
    .single();
  if (error) throw error;
  return mapQuiz(data as QuizRow);
}

export async function saveQuizAttempt(input: {
  quizId: Id;
  answers: number[];
  score: number;
  total: number;
}): Promise<Id> {
  const uid = activeUserId();
  if (!uid) {
    return dex.saveQuizAttempt({
      quizId: input.quizId as number,
      answers: input.answers,
      score: input.score,
      total: input.total,
    });
  }
  const { data, error } = await sb()
    .from("quiz_attempts")
    .insert({
      user_id: uid,
      quiz_id: input.quizId as string,
      answers: input.answers,
      score: input.score,
      total: input.total,
    })
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

// ---------------------------------------------------------------------------
// Research docs
// ---------------------------------------------------------------------------
export async function saveResearchDoc(input: {
  title: string;
  text: string;
  score?: number;
  summary?: string;
}): Promise<ResearchDoc> {
  const uid = activeUserId();
  if (!uid) {
    const d = await dex.saveResearchDoc(input);
    return {
      id: d.id!,
      title: d.title,
      text: d.text,
      score: d.score,
      summary: d.summary,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    };
  }
  const { data, error } = await sb()
    .from("research_docs")
    .insert({
      user_id: uid,
      title: input.title,
      text: input.text,
      score: input.score ?? null,
      summary: input.summary ?? null,
    })
    .select("id, title, text, score, summary, created_at, updated_at")
    .single();
  if (error) throw error;
  const row = data as {
    id: string;
    title: string;
    text: string;
    score: number | null;
    summary: string | null;
    created_at: string;
    updated_at: string;
  };
  return {
    id: row.id,
    title: row.title,
    text: row.text,
    score: row.score ?? undefined,
    summary: row.summary ?? undefined,
    createdAt: tsToMs(row.created_at),
    updatedAt: tsToMs(row.updated_at),
  };
}
