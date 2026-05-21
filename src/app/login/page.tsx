"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Eye, EyeOff, Lock, Mail, User as UserIcon } from "lucide-react";
import { Mascot } from "@/components/Mascot";
import { PillButton } from "@/components/PillButton";
import { useAuth } from "@/lib/auth/store";
import { hasSupabaseConfig } from "@/lib/auth/config";

type Mode = "login" | "signup";

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function LoginPage() {
  const router = useRouter();
  const signIn = useAuth((s) => s.signInWithEmail);
  const signUp = useAuth((s) => s.signUpWithEmail);
  const continueAsGuest = useAuth((s) => s.continueAsGuest);
  const user = useAuth((s) => s.user);
  const hydrated = useAuth((s) => s.hydrated);

  const [mode, setMode] = useState<Mode>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const showSocials = hasSupabaseConfig();

  useEffect(() => {
    if (hydrated && user) router.replace("/home");
  }, [hydrated, user, router]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isEmail(email)) {
      setError("Enter a valid email.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (mode === "signup" && name.trim().length === 0) {
      setError("Tell us what to call you.");
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "login") signIn(email, password);
      else signUp(email, password, name);
      router.replace("/home");
    } finally {
      setSubmitting(false);
    }
  }

  function handleGuest() {
    continueAsGuest();
    router.replace("/home");
  }

  return (
    <div className="relative flex min-h-dvh w-full flex-col bg-bg text-foreground">
      <div aria-hidden className="pointer-events-none fixed inset-0 lm-aurora" />

      <div className="relative grid flex-1 grid-cols-1 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="relative hidden flex-col items-center justify-center overflow-hidden border-r border-white/5 bg-surface/30 px-12 backdrop-blur-xl lg:flex">
          <div className="relative">
            <div className="absolute inset-0 -z-10 rounded-full bg-purple/20 blur-3xl" />
            <Mascot state="idle" size={180} className="lm-drift" />
          </div>
          <h2 className="mt-10 max-w-[26ch] text-center text-3xl font-semibold leading-tight tracking-tight lm-text-grad">
            {mode === "login"
              ? "Welcome back. Pick up where you left off."
              : "Make a free account in seconds."}
          </h2>
          <p className="mt-4 max-w-[42ch] text-center text-sm text-muted">
            {mode === "login"
              ? "Your last sessions, notes, and quizzes are waiting."
              : "Notes and quizzes stay on your device until you sign in to sync."}
          </p>
        </section>

        <section className="flex flex-1 flex-col px-6 py-8 lg:py-0">
          <div className="flex items-center lg:hidden">
            <Link
              href="/welcome"
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-surface/70 text-foreground/80 ring-1 ring-white/5"
              aria-label="Back"
            >
              <ArrowLeft size={18} />
            </Link>
          </div>

          <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center pt-6 lg:pt-0">
            <div className="hidden lg:block">
              <Link
                href="/welcome"
                className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground"
              >
                <ArrowLeft size={14} />
                Back
              </Link>
            </div>

            <h1 className="mt-8 text-3xl font-semibold leading-tight tracking-tight lm-rise lg:mt-6 lg:text-4xl">
              {mode === "login" ? (
                <>
                  Login your
                  <br />
                  <span className="lm-text-teal-grad">account</span>
                </>
              ) : (
                <>
                  Create your
                  <br />
                  <span className="lm-text-teal-grad">account</span>
                </>
              )}
            </h1>
            <p className="mt-3 text-sm text-muted lm-rise lm-rise-1">
              {mode === "login"
                ? "Enter your details to continue."
                : "Pick a name, email, and password to get started."}
            </p>

            <form
              className="mt-8 flex flex-col gap-3 lm-rise lm-rise-2"
              onSubmit={handleSubmit}
              noValidate
            >
              {mode === "signup" && (
                <label className="group relative block">
                  <span className="sr-only">Name</span>
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted transition group-focus-within:text-teal">
                    <UserIcon size={18} />
                  </span>
                  <input
                    className="h-12 w-full rounded-2xl bg-surface/70 px-12 text-sm text-foreground placeholder:text-muted/70 outline-none ring-1 ring-white/5 transition focus:ring-2 focus:ring-teal/60"
                    placeholder="What should we call you?"
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
              )}

              <label className="group relative block">
                <span className="sr-only">Email</span>
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted transition group-focus-within:text-teal">
                  <Mail size={18} />
                </span>
                <input
                  className="h-12 w-full rounded-2xl bg-surface/70 px-12 text-sm text-foreground placeholder:text-muted/70 outline-none ring-1 ring-white/5 transition focus:ring-2 focus:ring-teal/60"
                  placeholder="you@example.com"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>

              <label className="group relative block">
                <span className="sr-only">Password</span>
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted transition group-focus-within:text-teal">
                  <Lock size={18} />
                </span>
                <input
                  className="h-12 w-full rounded-2xl bg-surface/70 px-12 pr-12 text-sm text-foreground placeholder:text-muted/70 outline-none ring-1 ring-white/5 transition focus:ring-2 focus:ring-teal/60"
                  placeholder="Password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-xl text-muted hover:bg-white/5 hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </label>

              {mode === "login" && (
                <div className="-mt-1 flex justify-end">
                  <button
                    type="button"
                    className="text-xs text-muted hover:text-foreground"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              {error && (
                <div
                  role="alert"
                  className="rounded-2xl bg-red/15 px-4 py-2.5 text-xs text-red ring-1 ring-red/30"
                >
                  {error}
                </div>
              )}

              <div className="mt-4">
                <PillButton variant="primary" type="submit" disabled={submitting}>
                  {submitting
                    ? mode === "login"
                      ? "Logging in…"
                      : "Creating account…"
                    : mode === "login"
                      ? "Login"
                      : "Create account"}
                </PillButton>
              </div>

              <p className="mt-2 text-center text-xs text-muted">
                {mode === "login" ? (
                  <>
                    New here?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setMode("signup");
                        setError(null);
                      }}
                      className="font-semibold text-foreground underline decoration-teal/60 underline-offset-4"
                    >
                      Create account
                    </button>
                  </>
                ) : (
                  <>
                    Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setMode("login");
                        setError(null);
                      }}
                      className="font-semibold text-foreground underline decoration-teal/60 underline-offset-4"
                    >
                      Log in
                    </button>
                  </>
                )}
              </p>
            </form>

            <div className="my-8 flex items-center gap-3 lm-rise lm-rise-3">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-[11px] uppercase tracking-[0.16em] text-muted">
                or
              </span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <div className="lm-rise lm-rise-4 flex flex-col gap-3">
              <PillButton variant="outline" type="button" onClick={handleGuest}>
                Continue as guest
              </PillButton>
              {showSocials && (
                <div className="grid grid-cols-2 gap-3">
                  <PillButton variant="google">Google</PillButton>
                  <PillButton variant="facebook">Facebook</PillButton>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
