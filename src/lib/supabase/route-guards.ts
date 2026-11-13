/**
 * Route protection decisions (Phase 3.1) — pure, no dependencies.
 *
 * The Next.js proxy (`src/proxy.ts`) calls `getAuthRedirect`
 * with the live auth state; these helpers are the decision table, kept
 * pure so they are unit-testable without the Next.js runtime.
 *
 * Rules:
 * - Unconfigured Supabase -> pass everything through. There is no auth
 *   to enforce, and the app must keep working exactly as before.
 * - "/" (the workspace) and any future "/app/*" path are protected:
 *   guests are sent to /auth/sign-in.
 * - /auth/sign-in and /auth/sign-up send signed-in users back to "/".
 * - /auth/callback, /auth/forgot-password and /auth/reset-password are
 *   always allowed through — redirecting them would loop the recovery
 *   and callback flows (the callback needs to run to create a session;
 *   reset-password needs an anonymous visit to verify the recovery
 *   session before it can act).
 * - Everything else (unknown paths, static assets the matcher lets
 *   through) is passed through; Next.js answers 404 for it.
 */

/** Paths that require a signed-in user. */
export function isProtectedPath(path: string): boolean {
  return path === "/" || path === "/app" || path.startsWith("/app/");
}

/** The two pages a signed-in user has no reason to visit. */
export function isAuthPage(path: string): boolean {
  return path === "/auth/sign-in" || path === "/auth/sign-up";
}

/** Auth pages that must never be redirect-looped. */
export function isAuthPassthroughPath(path: string): boolean {
  return (
    path === "/auth/callback" ||
    path.startsWith("/auth/callback/") ||
    path === "/auth/forgot-password" ||
    path === "/auth/reset-password"
  );
}

/**
 * Decide the redirect for a request, or null to let it through.
 *
 * @param path - the request pathname (no query string).
 * @param isAuthenticated - true when a session user was verified
 *   server-side (never from a client claim).
 * @param isConfigured - false when no Supabase project is configured;
 *   protection is off entirely in that case.
 */
export function getAuthRedirect(
  path: string,
  isAuthenticated: boolean,
  isConfigured: boolean,
): string | null {
  if (!isConfigured) return null;
  if (isAuthPassthroughPath(path)) return null;
  if (!isAuthenticated && isProtectedPath(path)) return "/auth/sign-in";
  if (isAuthenticated && isAuthPage(path)) return "/";
  return null;
}
