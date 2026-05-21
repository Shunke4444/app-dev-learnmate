"use client";

import Link from "next/link";
import { useState } from "react";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { PillButton } from "@/components/PillButton";

export default function LoginPage() {
  const [show, setShow] = useState(false);

  return (
    <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col px-6 pb-10 pt-10">
      <div className="flex items-center">
        <Link
          href="/welcome"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface/70 text-foreground/80"
          aria-label="Back"
        >
          <span className="text-lg">‹</span>
        </Link>
      </div>

      <h1 className="mt-10 text-3xl font-semibold leading-tight tracking-tight">
        Login Your
        <br />
        Account
      </h1>

      <form className="mt-10 flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
        <label className="relative block">
          <span className="sr-only">Email</span>
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">
            <Mail size={18} />
          </span>
          <input
            className="h-12 w-full rounded-2xl bg-surface px-12 text-sm text-foreground placeholder:text-muted/70 outline-none ring-1 ring-white/5 focus:ring-2 focus:ring-teal/60"
            placeholder="you@example.com"
            type="email"
            autoComplete="email"
          />
        </label>

        <label className="relative block">
          <span className="sr-only">Password</span>
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">
            <Lock size={18} />
          </span>
          <input
            className="h-12 w-full rounded-2xl bg-surface px-12 pr-12 text-sm text-foreground placeholder:text-muted/70 outline-none ring-1 ring-white/5 focus:ring-2 focus:ring-teal/60"
            placeholder="Password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
            aria-label={show ? "Hide password" : "Show password"}
          >
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </label>

        <div className="mt-1 flex justify-end">
          <button type="button" className="text-xs text-muted hover:text-foreground">
            Forget Password ?
          </button>
        </div>

        <div className="mt-4">
          <Link href="/home" className="block">
            <PillButton variant="surface" type="button">
              Login
            </PillButton>
          </Link>
        </div>

        <p className="mt-6 text-center text-xs text-muted">
          Create New Account?{" "}
          <Link className="text-foreground underline decoration-white/30" href="/login">
            Sign up
          </Link>
        </p>
      </form>

      <div className="mt-8">
        <p className="text-center text-xs tracking-wide text-muted">
          Continue With Accounts
        </p>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <PillButton variant="google">Google</PillButton>
          <PillButton variant="facebook">Facebook</PillButton>
        </div>
      </div>
    </div>
  );
}
