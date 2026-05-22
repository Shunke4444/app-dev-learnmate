import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Skip static assets + images + favicon + sw + PWA artifacts.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.png|manifest.webmanifest|sw.js|workbox-.*|swe-worker-.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
