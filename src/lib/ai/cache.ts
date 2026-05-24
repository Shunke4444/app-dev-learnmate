import "server-only";

// Per-user response cache for stable AI calls. Used by /api/ai/{quiz,research,vision}
// and notes summarize/rewrite. Skipped for /api/ai/chat (conversational).
//
// Lookup key: (user_id, kind, sha256(canonical_input), chain_signature).
// `model` column stores the chain signature so an env-driven model swap
// invalidates the cache. Resolved model name is stored inside the wrapped
// payload so it's never mixed into the response shape callers see.
// TTL is 30 days (DB default).

import crypto from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { modelsForJob, type Job } from "@/lib/ai/models";

export type CacheKind =
  | "quiz"
  | "research"
  | "notes_summarize"
  | "notes_rewrite"
  | "vision";

export interface CachedResponse<T = unknown> {
  data: T;
  model: string;
  hit: true;
}

export interface CacheMiss {
  hit: false;
}

export type CacheLookup<T = unknown> = CachedResponse<T> | CacheMiss;

interface CacheEnvelope {
  data: unknown;
  resolvedModel: string;
}

export function hashInput(input: unknown): string {
  return crypto.createHash("sha256").update(canonicalize(input)).digest("hex");
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value))
    return "[" + value.map((v) => canonicalize(v)).join(",") + "]";
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return (
    "{" +
    keys
      .map(
        (k) =>
          JSON.stringify(k) + ":" + canonicalize((value as Record<string, unknown>)[k]),
      )
      .join(",") +
    "}"
  );
}

// Chain signatures are stable per process; model list only changes on env reload.
const SIG_CACHE = new Map<Job, string>();
export function chainSignature(job: Job): string {
  const cached = SIG_CACHE.get(job);
  if (cached) return cached;
  const sig = crypto
    .createHash("sha256")
    .update(modelsForJob(job).join("|"))
    .digest("hex")
    .slice(0, 16);
  SIG_CACHE.set(job, sig);
  return sig;
}

type ServerClient = Awaited<ReturnType<typeof createClient>>;

async function clientAndUid(): Promise<{ sb: ServerClient; uid: string } | null> {
  try {
    const sb = await createClient();
    const { data } = await sb.auth.getUser();
    if (!data.user?.id) return null;
    return { sb, uid: data.user.id };
  } catch {
    return null;
  }
}

interface CacheRow {
  id: string;
  response: CacheEnvelope;
}

export async function readCache<T = unknown>(
  kind: CacheKind,
  job: Job,
  input: unknown,
): Promise<CacheLookup<T>> {
  const ctx = await clientAndUid();
  if (!ctx) return { hit: false };
  try {
    const { sb, uid } = ctx;
    const { data, error } = await sb
      .from("ai_cache")
      .select("id, response")
      .eq("user_id", uid)
      .eq("kind", kind)
      .eq("input_hash", hashInput(input))
      .eq("model", chainSignature(job))
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (error || !data) return { hit: false };
    const row = data as CacheRow;
    void sb
      .from("ai_cache")
      .update({ last_hit_at: new Date().toISOString() })
      .eq("id", row.id)
      .then(() => undefined, () => undefined);
    return {
      hit: true,
      data: row.response.data as T,
      model: row.response.resolvedModel,
    };
  } catch {
    return { hit: false };
  }
}

export async function writeCache(
  kind: CacheKind,
  job: Job,
  input: unknown,
  response: unknown,
  resolvedModel: string,
): Promise<void> {
  const ctx = await clientAndUid();
  if (!ctx) return;
  try {
    const envelope: CacheEnvelope = { data: response, resolvedModel };
    await ctx.sb.from("ai_cache").upsert(
      {
        user_id: ctx.uid,
        kind,
        input_hash: hashInput(input),
        model: chainSignature(job),
        response: envelope,
        last_hit_at: new Date().toISOString(),
      },
      { onConflict: "user_id,kind,input_hash,model" },
    );
  } catch {
    // never let a cache write fail the user request
  }
}
