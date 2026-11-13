/**
 * Supabase session middleware (Phase 3.1) — the official @supabase/ssr
 * pattern, adapted so it is safe when Supabase is NOT configured.
 *
 * `updateSession` refreshes the auth session on every request (calling
 * `getUser()` so expired tokens are renewed and their cookies updated)
 * and returns the response plus the verified user (or null). When no
 * Supabase project is configured it returns the request untouched with
 * `user: null` — the app keeps working exactly as before, and the
 * redirect decisions in `src/middleware.ts` pass everything through.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";
import { isSupabaseConfiguredServer } from "@/lib/supabase/server";

export interface SessionUpdate {
  response: NextResponse;
  /** Verified session user, or null when anonymous / unconfigured. */
  user: User | null;
}

export async function updateSession(
  request: NextRequest,
): Promise<SessionUpdate> {
  let supabaseResponse = NextResponse.next({ request });

  // Unconfigured: no session exists to refresh. Pass through unchanged.
  if (!isSupabaseConfiguredServer()) {
    return { response: supabaseResponse, user: null };
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() revalidates the session and refreshes expired tokens.
  // An error here means "no valid session" — the user is a guest.
  const { data, error } = await supabase.auth.getUser();
  return {
    response: supabaseResponse,
    user: error || !data.user ? null : data.user,
  };
}
