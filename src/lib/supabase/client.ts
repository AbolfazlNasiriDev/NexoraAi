/**
 * Supabase browser client (Phase 3.1) — client-safe, NO "server-only".
 *
 * Reads ONLY the public pair `NEXT_PUBLIC_SUPABASE_URL` /
 * `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the anon key is publishable by
 * design). It NEVER references the service-role key or any other
 * server-only secret — a grep test pins that.
 *
 * Unconfigured behaviour (no project yet): the factory returns `null`
 * instead of throwing, so pages can render an honest "Authentication
 * is not configured yet" state. Nothing at import time throws and
 * nothing crashes page load. Callers must check for null before use.
 */

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/** True only when the browser client has both public values it needs. */
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return (
    typeof url === "string" &&
    url.trim().length > 0 &&
    typeof key === "string" &&
    key.trim().length > 0
  );
}

let browserClient: SupabaseClient | null = null;

/**
 * The shared browser client, or null when Supabase is not configured.
 * Safe to call during render; the client is created lazily on first
 * use so importing this module never touches the network or env.
 */
export function createClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!browserClient) {
    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    );
  }
  return browserClient;
}

/**
 * Like `createClient`, but throws a clear, catchable error when called
 * while unconfigured — for flows that cannot proceed without auth.
 * The error message names no secret and no internal detail.
 */
export function requireBrowserClient(): SupabaseClient {
  const client = createClient();
  if (!client) {
    throw new Error(
      "Supabase is not configured yet. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to enable authentication.",
    );
  }
  return client;
}
