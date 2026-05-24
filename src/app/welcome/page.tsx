"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Mascot } from "@/components/Mascot";
import { PillButton } from "@/components/PillButton";
import { useAuth } from "@/lib/auth/store";
import { hasSupabaseConfig } from "@/lib/auth/config";

export default function WelcomePage() {
  const router = useRouter();
  const continueAsGuest = useAuth((s) => s.continueAsGuest);
  const signInWithGoogle = useAuth((s) => s.signInWithGoogle);
  const user = useAuth((s) => s.user);
  const hydrated = useAuth((s) => s.hydrated);
  const showSocials = hasSupabaseConfig();

  useEffect(() => {
    if (hydrated && user) router.replace("/home");
  }, [hydrated, user, router]);

  function handleGuest() {
    continueAsGuest();
    router.replace("/home");
  }

  async function handleGoogle() {
    await signInWithGoogle();
  }

  return (
    <div className="relative flex min-h-dvh w-full flex-col bg-bg text-foreground">
      <div aria-hidden className="pointer-events-none fixed inset-0 lm-aurora" />

      <div className="relative grid flex-1 grid-cols-1 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden flex-col items-center justify-center overflow-hidden border-r border-white/5 bg-surface/30 px-12 backdrop-blur-xl lg:flex">
          <div className="relative">
            <div className="absolute inset-0 -z-10 rounded-full bg-teal/15 blur-3xl" />
            <Mascot state="idle" size={200} className="lm-drift" />
          </div>
          <h2 className="mt-10 max-w-[28ch] text-center text-3xl font-semibold leading-tight tracking-tight lm-text-grad">
            A study buddy that listens, summarizes, and quizzes you.
          </h2>
          <p className="mt-4 max-w-[44ch] text-center text-sm text-muted">
            Voice-first AI for class notes, quick quizzes, and research polish — built to feel friendly, not formal.
          </p>

          <div className="mt-10 flex gap-2">
            {["Talk", "Notes", "Quiz", "Research"].map((t, i) => (
              <span
                key={t}
                className={
                  "rounded-full bg-surface/60 px-3 py-1 text-[11px] font-medium text-foreground/85 ring-1 ring-white/5 lm-rise " +
                  ["lm-rise-1", "lm-rise-2", "lm-rise-3", "lm-rise-4"][i]
                }
              >
                {t}
              </span>
            ))}
          </div>
        </section>

        <section className="flex flex-1 items-center justify-center px-6 py-12 lg:py-0">
          <div className="mx-auto flex w-full max-w-[420px] flex-col">
            <div className="flex flex-col items-center lg:hidden">
              <div className="relative">
                <div className="absolute inset-0 -z-10 rounded-full bg-teal/15 blur-2xl" />
                <Mascot state="idle" size={92} />
              </div>
            </div>

            <h1 className="mt-8 text-center text-3xl font-semibold leading-tight tracking-tight lm-rise lg:mt-0 lg:text-left lg:text-4xl">
              Welcome to
              <br />
              <span className="lm-text-teal-grad">LearnMate</span>
            </h1>
            <p className="mt-3 text-center text-sm text-muted lm-rise lm-rise-1 lg:text-left">
              Your personal study buddy.
            </p>

            <div className="mt-10 flex w-full flex-col gap-3 lm-rise lm-rise-2">
              <Link href="/login" className="w-full">
                <PillButton variant="primary">Log in</PillButton>
              </Link>
              <Link href="/signup" className="w-full">
                <PillButton variant="outline">Sign up</PillButton>
              </Link>
              <PillButton variant="surface" type="button" onClick={handleGuest}>
                Continue as guest
              </PillButton>
            </div>

            {showSocials && (
              <>
                <div className="my-8 flex items-center gap-3 lm-rise lm-rise-3">
                  <div className="h-px flex-1 bg-white/10" />
                  <span className="text-[11px] uppercase tracking-[0.16em] text-muted">
                    Continue with
                  </span>
                  <div className="h-px flex-1 bg-white/10" />
                </div>

                <div className="grid grid-cols-2 gap-3 lm-rise lm-rise-4">
                  <PillButton variant="google" type="button" onClick={handleGoogle}>
                    Google
                  </PillButton>
                  <PillButton variant="facebook" disabled>
                    Facebook
                  </PillButton>
                </div>
              </>
            )}

            <p className="mt-8 text-center text-[11px] text-muted">
              By continuing you agree to our terms and privacy policy.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
