/**
 * POST /auth/sign-out — server-side sign-out (Phase 3.1).
 *
 * Signs out through the server client, which clears the auth cookies.
 * The UI (UserChip) calls this route instead of signing out in the
 * browser — one real path, server-enforced. When Supabase is not
 * configured there is no session to clear, so the call is a harmless
 * no-op success (nothing is faked: no session existed).
 */

import { createClient } from "@/lib/supabase/server";
import { ok, withErrorHandling } from "@/lib/server/response";

export const POST = withErrorHandling(async () => {
  const supabase = await createClient();
  if (supabase) {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }
  return ok({ signedOut: true });
});
