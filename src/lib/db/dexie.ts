import Dexie, { type Table } from "dexie";

export type ChatMode = "talk" | "chat";

export interface Chat {
  id?: number;
  mode: ChatMode;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface Message {
  id?: number;
  chatId: number;
  role: "user" | "assistant";
  text: string;
  createdAt: number;
}

export interface NoteSession {
  id?: number;
  title: string;
  subject: string;
  status: "live" | "done" | "saved";
  transcript: string;
  summary?: string;
  rewrite?: string;
  createdAt: number;
  updatedAt: number;
}

export interface QuizQuestionRow {
  prompt: string;
  code?: string | null;
  options: string[];
  answer: number;
  rationale: string;
}

export interface Quiz {
  id?: number;
  topic: string;
  sourceNoteId?: number;
  questions: QuizQuestionRow[];
  createdAt: number;
}

export interface QuizAttempt {
  id?: number;
  quizId: number;
  answers: number[];
  score: number;
  total: number;
  completedAt: number;
}

export interface ResearchDoc {
  id?: number;
  title: string;
  text: string;
  score?: number;
  summary?: string;
  createdAt: number;
  updatedAt: number;
}

class LearnMateDB extends Dexie {
  chats!: Table<Chat, number>;
  messages!: Table<Message, number>;
  noteSessions!: Table<NoteSession, number>;
  quizzes!: Table<Quiz, number>;
  quizAttempts!: Table<QuizAttempt, number>;
  researchDocs!: Table<ResearchDoc, number>;

  constructor() {
    super("learnmate");
    this.version(1).stores({
      chats: "++id, mode, createdAt, updatedAt",
      messages: "++id, chatId, createdAt",
    });
    this.version(2).stores({
      chats: "++id, mode, createdAt, updatedAt",
      messages: "++id, chatId, createdAt",
      noteSessions: "++id, subject, status, createdAt, updatedAt",
      quizzes: "++id, topic, sourceNoteId, createdAt",
      quizAttempts: "++id, quizId, completedAt",
      researchDocs: "++id, createdAt, updatedAt",
    });
  }
}

// Lazy singleton — Dexie only works in the browser.
let _db: LearnMateDB | null = null;
export function db(): LearnMateDB {
  if (typeof window === "undefined") {
    throw new Error("Dexie can only be used in the browser");
  }
  if (!_db) _db = new LearnMateDB();
  return _db;
}

// ----- Chats -----

export async function getOrCreateChat(mode: ChatMode): Promise<Chat> {
  const existing = await db().chats.where("mode").equals(mode).reverse().sortBy("updatedAt");
  if (existing[0]) return existing[0];
  const now = Date.now();
  const id = await db().chats.add({
    mode,
    title: mode === "chat" ? "Chat with Bot" : "Talk with Bot",
    createdAt: now,
    updatedAt: now,
  });
  return (await db().chats.get(id))!;
}

export async function listMessages(chatId: number): Promise<Message[]> {
  return db().messages.where("chatId").equals(chatId).sortBy("createdAt");
}

export async function appendMessage(
  chatId: number,
  role: Message["role"],
  text: string,
): Promise<number> {
  const id = await db().messages.add({
    chatId,
    role,
    text,
    createdAt: Date.now(),
  });
  await db().chats.update(chatId, { updatedAt: Date.now() });
  return id;
}

export async function updateMessageText(messageId: number, text: string): Promise<void> {
  await db().messages.update(messageId, { text });
}

export async function pruneEmptyMessages(chatId: number): Promise<void> {
  const all = await db().messages.where("chatId").equals(chatId).toArray();
  const dead = all.filter((m) => !m.text || m.text.trim().length === 0).map((m) => m.id!);
  if (dead.length > 0) await db().messages.bulkDelete(dead);
}

// ----- Note sessions -----

export async function createNoteSession(input: {
  title: string;
  subject?: string;
}): Promise<NoteSession> {
  const now = Date.now();
  const id = await db().noteSessions.add({
    title: input.title,
    subject: input.subject ?? "General",
    status: "live",
    transcript: "",
    createdAt: now,
    updatedAt: now,
  });
  return (await db().noteSessions.get(id))!;
}

export async function updateNoteSession(
  id: number,
  patch: Partial<NoteSession>,
): Promise<void> {
  await db().noteSessions.update(id, { ...patch, updatedAt: Date.now() });
}

export async function listNoteSessions(): Promise<NoteSession[]> {
  return db().noteSessions.orderBy("updatedAt").reverse().toArray();
}

export async function getNoteSession(id: number): Promise<NoteSession | undefined> {
  return db().noteSessions.get(id);
}

// ----- Quizzes -----

export async function saveQuiz(input: {
  topic: string;
  sourceNoteId?: number;
  questions: QuizQuestionRow[];
}): Promise<Quiz> {
  const id = await db().quizzes.add({
    topic: input.topic,
    sourceNoteId: input.sourceNoteId,
    questions: input.questions,
    createdAt: Date.now(),
  });
  return (await db().quizzes.get(id))!;
}

export async function saveQuizAttempt(input: {
  quizId: number;
  answers: number[];
  score: number;
  total: number;
}): Promise<number> {
  return db().quizAttempts.add({
    quizId: input.quizId,
    answers: input.answers,
    score: input.score,
    total: input.total,
    completedAt: Date.now(),
  });
}

// ----- Research docs -----

export async function saveResearchDoc(input: {
  title: string;
  text: string;
  score?: number;
  summary?: string;
}): Promise<ResearchDoc> {
  const now = Date.now();
  const id = await db().researchDocs.add({
    title: input.title,
    text: input.text,
    score: input.score,
    summary: input.summary,
    createdAt: now,
    updatedAt: now,
  });
  return (await db().researchDocs.get(id))!;
}
