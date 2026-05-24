"use client";

// Shared Supabase browser-client singleton + auth helpers.
// All client-side DB modules import from here so we don't create a separate
// `createBrowserClient` instance per module (each instance maintains its own
// auth listener + storage adapter).

import { createClient } from "@/lib/supabase/client";
import { getCurrentUserId } from "@/lib/auth/store";
import { hasSupabaseConfig } from "@/lib/auth/config";

let _sb: ReturnType<typeof createClient> | null = null;
export function sb(): ReturnType<typeof createClient> {
  if (!_sb) _sb = createClient();
  return _sb;
}

export function activeUserId(): string | null {
  if (!hasSupabaseConfig()) return null;
  return getCurrentUserId();
}

export function tsToMs(s: string | null | undefined): number {
  if (!s) return 0;
  const n = Date.parse(s);
  return Number.isFinite(n) ? n : 0;
}
