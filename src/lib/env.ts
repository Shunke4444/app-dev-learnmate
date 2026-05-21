// Typed, validated env surface for LearnMate.
// Only OPENROUTER_API_KEY is required; everything else is optional with safe defaults.
// Never import this from a "use client" component — it reads process.env server-side.

import "server-only";

type EnvShape = {
  hasApiKey: boolean;
  model: string | null;
  fallbacks: string[];
  appUrl: string;
  supabase: { url: string; anonKey: string } | null;
};

function parseFallbacks(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function readEnv(): EnvShape {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supaKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  return {
    hasApiKey: Boolean(apiKey),
    model: process.env.OPENROUTER_MODEL?.trim() || null,
    fallbacks: parseFallbacks(process.env.OPENROUTER_FALLBACKS),
    appUrl: process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:4444",
    supabase: supaUrl && supaKey ? { url: supaUrl, anonKey: supaKey } : null,
  };
}

export function hasApiKey(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}
