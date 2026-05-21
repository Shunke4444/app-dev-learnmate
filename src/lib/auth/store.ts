"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type AuthProvider = "guest" | "email";

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
  signInWithEmail: (email: string, _password: string) => User;
  signUpWithEmail: (email: string, _password: string, name?: string) => User;
  continueAsGuest: () => User;
  signOut: () => void;
  updateProfile: (patch: Partial<Pick<User, "name" | "email">>) => void;
  _setHydrated: () => void;
}

function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `u_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
}

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

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      hydrated: false,
      signInWithEmail: (email, _password) => {
        const user: User = {
          id: uid(),
          name: nameFromEmail(email),
          email,
          provider: "email",
          createdAt: Date.now(),
        };
        set({ user });
        return user;
      },
      signUpWithEmail: (email, _password, name) => {
        const user: User = {
          id: uid(),
          name: name?.trim() || nameFromEmail(email),
          email,
          provider: "email",
          createdAt: Date.now(),
        };
        set({ user });
        return user;
      },
      continueAsGuest: () => {
        const user: User = {
          id: uid(),
          name: "Guest",
          email: null,
          provider: "guest",
          createdAt: Date.now(),
        };
        set({ user });
        return user;
      },
      signOut: () => set({ user: null }),
      updateProfile: (patch) =>
        set((s) => (s.user ? { user: { ...s.user, ...patch } } : s)),
      _setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: "learnmate-auth",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ user: s.user }),
      onRehydrateStorage: () => (state) => {
        state?._setHydrated();
      },
    },
  ),
);

export function initialOf(name: string | undefined | null): string {
  if (!name) return "?";
  const trimmed = name.trim();
  if (!trimmed) return "?";
  return trimmed[0]!.toUpperCase();
}
