"use client";

// Storage helpers for the note-audio + research-uploads buckets.
// Path convention: <user_uuid>/<random>-<safe-filename>.

import { sb, activeUserId } from "@/lib/db/_client";
import { uid as randomKey } from "@/lib/util/id";

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // matches bucket file_size_limit

export type Bucket = "note-audio" | "research-uploads";

export interface UploadResult {
  bucket: Bucket;
  path: string;
  mime: string;
  sizeBytes: number;
}

function safeFilename(name: string): string {
  const parts = name.split(".");
  const ext = parts.length > 1 ? "." + parts.pop() : "";
  const base = parts.join(".").replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 60);
  return (base || "file") + ext;
}

export class UploadError extends Error {
  constructor(message: string, readonly code: "too_large" | "no_auth" | "upstream") {
    super(message);
  }
}

export async function uploadFile(
  bucket: Bucket,
  file: File,
): Promise<UploadResult> {
  const uid = activeUserId();
  if (!uid) {
    throw new UploadError(
      "Sign in to upload files — guests can only use local memory.",
      "no_auth",
    );
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new UploadError(
      `File is too large. Max ${(MAX_UPLOAD_BYTES / 1024 / 1024) | 0}MB.`,
      "too_large",
    );
  }
  const path = `${uid}/${randomKey()}-${safeFilename(file.name)}`;
  const { error } = await sb()
    .storage.from(bucket)
    .upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (error) {
    throw new UploadError(error.message, "upstream");
  }
  return {
    bucket,
    path,
    mime: file.type || "application/octet-stream",
    sizeBytes: file.size,
  };
}

export async function createSignedUrl(
  bucket: Bucket,
  path: string,
  expiresInSeconds = 60 * 60,
): Promise<string | null> {
  if (!activeUserId()) return null;
  try {
    const { data, error } = await sb()
      .storage.from(bucket)
      .createSignedUrl(path, expiresInSeconds);
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}

export async function removeFile(
  bucket: Bucket,
  path: string,
): Promise<void> {
  if (!activeUserId()) return;
  try {
    await sb().storage.from(bucket).remove([path]);
  } catch {
    // ignore
  }
}

// ---------- Higher-level helpers tied to feature tables ----------

export async function saveNoteAudio(
  noteId: string,
  file: File,
  durationMs?: number,
): Promise<UploadResult> {
  const uid = activeUserId();
  if (!uid) throw new UploadError("Sign in to upload audio.", "no_auth");
  const upload = await uploadFile("note-audio", file);
  try {
    await sb()
      .from("note_attachments")
      .insert({
        note_id: noteId,
        user_id: uid,
        storage_path: upload.path,
        mime: upload.mime,
        size_bytes: upload.sizeBytes,
        duration_ms: durationMs ?? null,
        transcript_status: "pending",
      });
  } catch {
    // Roll back the orphan blob if metadata insert failed.
    await removeFile("note-audio", upload.path);
    throw new UploadError("Couldn't save attachment metadata.", "upstream");
  }
  return upload;
}

export async function setNoteAttachmentTranscriptStatus(
  noteId: string,
  storagePath: string,
  status: "pending" | "done" | "failed" | "skipped",
): Promise<void> {
  if (!activeUserId()) return;
  try {
    await sb()
      .from("note_attachments")
      .update({ transcript_status: status })
      .eq("note_id", noteId)
      .eq("storage_path", storagePath);
  } catch {
    // ignore
  }
}

export async function saveResearchUpload(
  docId: string,
  file: File,
  parsedText?: string,
): Promise<UploadResult> {
  const uid = activeUserId();
  if (!uid) throw new UploadError("Sign in to upload files.", "no_auth");
  const upload = await uploadFile("research-uploads", file);
  try {
    await sb()
      .from("research_attachments")
      .insert({
        doc_id: docId,
        user_id: uid,
        storage_path: upload.path,
        mime: upload.mime,
        size_bytes: upload.sizeBytes,
        parsed_text: parsedText ?? null,
      });
  } catch {
    await removeFile("research-uploads", upload.path);
    throw new UploadError("Couldn't save attachment metadata.", "upstream");
  }
  return upload;
}
