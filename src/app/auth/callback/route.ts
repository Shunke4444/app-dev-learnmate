import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Supabase OAuth callback. Exchanges the `code` param for a session cookie,
// then redirects back into the app. Used by Google sign-in (and any future
// OAuth providers wired through Supabase).
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/home";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
    const failed = new URL("/login", request.url);
    failed.searchParams.set("error", error.message);
    return NextResponse.redirect(failed);
  }

  // No code — fall back to login.
  return NextResponse.redirect(new URL("/login", request.url));
}
