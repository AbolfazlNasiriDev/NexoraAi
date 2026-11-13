/**
 * Next.js proxy (Phase 3.1) — session refresh + route protection.
 *
 * NOTE on the file name: Next.js 16 renamed the "middleware" file
 * convention to "proxy" (`src/proxy.ts`, exported function `proxy`).
 * The old `src/middleware.ts` still runs in 16.x but prints a
 * deprecation warning on every build, so this project uses the
 * current convention. The behaviour is identical to middleware.
 *
 * 1. `updateSession` refreshes the Supabase session on every request
 *    and returns the verified user (or null when anonymous).
 * 2. `getAuthRedirect` (pure, tested in `route-guards.test.ts`) decides
 *    whether this request is redirected: guests on protected routes go
 *    to /auth/sign-in; signed-in users on /auth/sign-in or /auth/sign-up
 *    go to "/". Callback / forgot-password / reset-password are always
 *    allowed through so those flows cannot loop.
 *
 * CRITICAL — unconfigured behaviour: when no Supabase project is
 * configured, `isSupabaseConfiguredServer()` is false, `updateSession`
 * passes the request through untouched, and `getAuthRedirect` returns
 * null for every path. Protection activates ONLY once a real project
 * is configured. This middleware therefore never redirects, never
 * loops, and never crashes on missing env.
 *
 * When a redirect IS needed, the refreshed session cookies are carried
 * onto the redirect response so a token rotation is not lost.
 */

import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { getAuthRedirect } from "@/lib/supabase/route-guards";
import { isSupabaseConfiguredServer } from "@/lib/supabase/server";

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);

  const redirectTo = getAuthRedirect(
    request.nextUrl.pathname,
    user !== null,
    isSupabaseConfiguredServer(),
  );
  if (!redirectTo) return response;

  const url = request.nextUrl.clone();
  url.pathname = redirectTo;
  url.search = "";
  const redirectResponse = NextResponse.redirect(url);
  // Carry any refreshed session cookies onto the redirect response.
  for (const cookie of response.cookies.getAll()) {
    redirectResponse.cookies.set(cookie);
  }
  return redirectResponse;
}

export const config = {
  matcher: [
    /*
     * Run on every route except static assets and API routes:
     * - API routes enforce auth themselves (e.g. POST /api/v1/chat
     *   returns 401 when configured and unauthenticated).
     * - _next/static, _next/image, favicon.ico and image files never
     *   need a session refresh.
     */
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
