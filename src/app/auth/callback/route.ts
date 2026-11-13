/**
 * GET /auth/callback — Supabase Auth callback (Phase 3.1).
 *
 * Supabase redirects here after email confirmation / password recovery
 * with a `code` in the query string. This handler exchanges it for a
 * session (which sets the auth cookies via the server client) and then
 * redirects to the validated `next` target.
 *
 * Security:
 * - `next` is validated server-side with `validateNextPath` — only
 *   relative paths inside this app are allowed (open-redirect
 *   protection); anything else falls back to "/".
 * - A missing/invalid `code`, an unconfigured Supabase, or a failed
 *   exchange all redirect to /auth/sign-in with a safe, allowlisted
 *   `error` query value — the raw Supabase error is never put in the
 *   URL and never rendered.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validateNextPath } from "@/lib/validation/auth.schema";

function signInRedirect(request: NextRequest, error: string): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = "/auth/sign-in";
  url.search = "";
  url.searchParams.set("error", error);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = validateNextPath(request.nextUrl.searchParams.get("next"));

  if (!code) {
    return signInRedirect(request, "callback");
  }

  const supabase = await createClient();
  if (!supabase) {
    // No project configured — there is no session to create.
    return signInRedirect(request, "not_configured");
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return signInRedirect(request, "callback");
  }

  const url = request.nextUrl.clone();
  url.pathname = next;
  url.search = "";
  return NextResponse.redirect(url);
}
