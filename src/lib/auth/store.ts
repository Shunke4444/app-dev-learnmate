"use client";

import { create } from "zustand";
import type { Session, User as SbUser } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseConfig } from "@/lib/auth/config";

export type AuthProvider = "guest" | "email" | "google" | "facebook";

export interface User {
  id: string;
  name: string;
  email: string | null;
  provider: AuthProvider;
  createdAt: number;
}

interface AuthState {
  user: User | null;
  hydrated: boolean;
  initializing: boolean;
  signInWithEmail: (
    email: string,
    password: string,
  ) => Promise<{ error?: string }>;
  signUpWithEmail: (
    email: string,
    password: string,
    name?: string,
  ) => Promise<{ error?: string }>;
  signInWithGoogle: () => Promise<{ error?: string }>;
  continueAsGuest: () => User;
  signOut: () => Promise<void>;
  updateProfile: (
    patch: Partial<Pick<User, "name" | "email">>,
  ) => Promise<void>;
  initialize: () => Promise<void>;
  _setHydrated: () => void;
}

import { uid } from "@/lib/util/id";
import { clearCachedPrefs } from "@/lib/db/preferences";

const GUEST_KEY = "learnmate-guest";

function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "User";
  const cleaned = local.replace(/[._-]+/g, " ").trim();
  if (!cleaned) return "User";
  return cleaned
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0]!.toUpperCase() + p.slice(1))
    .join(" ");
}

function loadGuest(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(GUEST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as User;
    if (parsed && parsed.id && parsed.provider === "guest") return parsed;
    return null;
  } catch {
    return null;
  }
}

function saveGuest(u: User | null): void {
  if (typeof window === "undefined") return;
  try {
    if (u) window.localStorage.setItem(GUEST_KEY, JSON.stringify(u));
    else window.localStorage.removeItem(GUEST_KEY);
  } catch {
    // ignore — strict privacy mode
  }
}

function userFromSb(sb: SbUser, provider: AuthProvider = "email"): User {
  const meta = (sb.user_metadata ?? {}) as Record<string, unknown>;
  const fullName =
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    (sb.email ? nameFromEmail(sb.email) : "User");
  const detectedProvider: AuthProvider =
    sb.app_metadata?.provider === "google"
      ? "google"
      : sb.app_metadata?.provider === "facebook"
        ? "facebook"
        : provider;
  return {
    id: sb.id,
    name: fullName,
    email: sb.email ?? null,
    provider: detectedProvider,
    createdAt: sb.created_at
      ? new Date(sb.created_at).getTime()
      : Date.now(),
  };
}

// Lazily-created singleton. Guarded so server-side imports don't crash.
let _client: ReturnType<typeof createClient> | null = null;
function client() {
  if (!_client) _client = createClient();
  return _client;
}

export const useAuth = create<AuthState>()((set, get) => ({
  user: null,
  hydrated: false,
  initializing: false,

  initialize: async () => {
    if (get().hydrated || get().initializing) return;
    set({ initializing: true });

    if (!hasSupabaseConfig()) {
      // No Supabase configured — fall back to local-only guest sessions.
      const guest = loadGuest();
      set({ user: guest, hydrated: true, initializing: false });
      return;
    }

    try {
      const sb = client();
      const { data } = await sb.auth.getSession();
      const session: Session | null = data.session;
      if (session?.user) {
        set({ user: userFromSb(session.user), hydrated: true });
      } else {
        const guest = loadGuest();
        set({ user: guest, hydrated: true });
      }

      sb.auth.onAuthStateChange((event, sess) => {
        if (event === "SIGNED_OUT") {
          // Don't auto-restore guest on explicit sign-out.
          set({ user: null });
          return;
        }
        if (sess?.user) {
          saveGuest(null); // Promote past any leftover guest record.
          set({ user: userFromSb(sess.user) });
        }
      });
    } finally {
      set({ initializing: false });
    }
  },

  signInWithEmail: async (email, password) => {
    if (!hasSupabaseConfig()) {
      return { error: "Auth is not configured." };
    }
    const { data, error } = await client().auth.signInWithPassword({
      email,
      password,
    });
    if (error) return { error: error.message };
    if (data.user) set({ user: userFromSb(data.user, "email") });
    return {};
  },

  signUpWithEmail: async (email, password, name) => {
    if (!hasSupabaseConfig()) {
      return { error: "Auth is not configured." };
    }
    const { data, error } = await client().auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name?.trim() || nameFromEmail(email),
        },
      },
    });
    if (error) return { error: error.message };
    if (data.user) set({ user: userFromSb(data.user, "email") });
    return {};
  },

  signInWithGoogle: async () => {
    if (!hasSupabaseConfig()) {
      return { error: "Auth is not configured." };
    }
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const { error } = await client().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback`,
      },
    });
    if (error) return { error: error.message };
    return {};
  },

  continueAsGuest: () => {
    const user: User = {
      id: uid(),
      name: "Guest",
      email: null,
      provider: "guest",
      createdAt: Date.now(),
    };
    saveGuest(user);
    set({ user });
    return user;
  },

  signOut: async () => {
    saveGuest(null);
    clearCachedPrefs();
    if (hasSupabaseConfig()) {
      try {
        await client().auth.signOut();
      } catch {
        // Network failure shouldn't block local sign-out.
      }
    }
    set({ user: null });
  },

  updateProfile: async (patch) => {
    const current = get().user;
    if (!current) return;
    set({ user: { ...current, ...patch } });
    if (current.provider === "guest") {
      saveGuest({ ...current, ...patch });
      return;
    }
    if (!hasSupabaseConfig()) return;
    try {
      await client()
        .from("profiles")
        .update({
          name: patch.name ?? current.name,
          email: patch.email ?? current.email,
        })
        .eq("id", current.id);
    } catch {
      // best-effort — UI already optimistically updated
    }
  },

  _setHydrated: () => set({ hydrated: true }),
}));

export function initialOf(name: string | undefined | null): string {
  if (!name) return "?";
  const trimmed = name.trim();
  if (!trimmed) return "?";
  return trimmed[0]!.toUpperCase();
}

// Sync helper for non-React modules (sync layer in src/lib/db).
export function getCurrentUser(): User | null {
  return useAuth.getState().user;
}

export function getCurrentUserId(): string | null {
  const u = useAuth.getState().user;
  if (!u || u.provider === "guest") return null;
  return u.id;
}
