import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";

/**
 * Supabase server client (Phase 3.1) — server-only.
 *
 * Reads the SAME single pair as the browser client —
 * `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
 * (unified in Phase 3.1.1). The `NEXT_PUBLIC_` prefix only means the
 * values are inlined into the browser bundle; the anon key is a
 * publishable key by design, so reading the same pair server-side is
 * safe and keeps one source of truth — there is no second, server-only
 * pair to keep in sync. Its value may be either a legacy anon JWT
 * (`eyJ…`) or a new publishable key (`sb_publishable_…`); both are
 * accepted in the same `apikey` slot by the installed SDKs
 * (@supabase/supabase-js 2.119.0, @supabase/ssr 0.12.7).
 * It NEVER creates a service-role client: `SUPABASE_SERVICE_ROLE_KEY`
 * is not used in this phase, and no code path here (or anywhere in
 * the app) may hand it to a client. Profile rows are created by the
 * database trigger on `auth.users`, never by app code.
 *
 * Unconfigured behaviour (no project yet): every export below returns
 * null / `{ user: null }` instead of throwing, so routes and middleware
 * keep working exactly as before — protection simply has nothing to
 * enforce yet.
 */

/** True only when the server client has both values it needs. */
export function isSupabaseConfiguredServer(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return (
    typeof url === "string" &&
    url.trim().length > 0 &&
    typeof key === "string" &&
    key.trim().length > 0
  );
}

/**
 * A server client bound to the current request's cookies, or null when
 * Supabase is not configured. Created per call (never at module scope)
 * so no client exists before a request does. `setAll` failures are
 * swallowed on purpose: Server Components cannot set cookies, and a
 * failed set must not break the request (the official @supabase/ssr
 * pattern).
 */
export async function createClient(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfiguredServer()) return null;
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — setting cookies is not
            // possible there; the middleware refresh handles it.
          }
        },
      },
    },
  );
}

/**
 * The currently authenticated user, verified server-side with
 * `supabase.auth.getUser()` (which revalidates the session against
 * the Auth server — it never trusts a client claim).
 *
 * Returns `{ user: null }` for anonymous visitors, for unconfigured
 * Supabase, and for any auth failure (expired/invalid token). It never
 * throws for those cases — callers treat "no user" as "guest". Only
 * unexpected runtime failures propagate, and route wrappers map them
 * to the standard 500.
 */
export async function getAuthenticatedUser(): Promise<{ user: User | null }> {
  const supabase = await createClient();
  if (!supabase) return { user: null };
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { user: null };
  return { user: data.user };
}
