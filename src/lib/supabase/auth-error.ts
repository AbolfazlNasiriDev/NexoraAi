/**
 * Supabase Auth error mapping (Phase 3.1) — pure, no dependencies.
 *
 * Supabase returns terse, sometimes technical messages ("Invalid login
 * credentials", "over_email_send_rate_limit"). This maps the known ones
 * to friendly, user-facing strings and everything else to one generic
 * message. The raw message is NEVER rendered: it can name internals
 * (rate-limit buckets, token states) that the user should not see.
 * Nothing here logs anything — callers must never log the raw error
 * either (no passwords, tokens, or full error objects in logs).
 */

/** Extract a message string from an unknown thrown value, if any. */
function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (
    error !== null &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return "";
}

/**
 * Map a Supabase Auth error (or any thrown value) to a safe, friendly
 * message. Unknown errors get the generic message — never the raw text.
 */
export function mapAuthError(error: unknown): string {
  const message = errorMessage(error);

  if (/invalid login credentials/i.test(message)) {
    return "Incorrect email or password.";
  }
  if (/email not confirmed/i.test(message)) {
    return "Please confirm your email before signing in. Check your inbox for the confirmation link.";
  }
  if (/user already registered|already registered|user already exists/i.test(message)) {
    return "An account with this email already exists. Try signing in instead.";
  }
  if (
    /too many requests|rate limit|over_email_send_rate_limit|email rate limit exceeded/i.test(message)
  ) {
    return "Too many attempts. Please try again later.";
  }
  if (/password should be at least|password.*too short/i.test(message)) {
    return "Password must be at least 8 characters.";
  }
  if (/invalid email/i.test(message)) {
    return "Enter a valid email address.";
  }
  if (/same password/i.test(message)) {
    return "Choose a new password — it must be different from your current one.";
  }
  if (
    /expired|invalid.*(token|link|code)|token has expired|code verifier/i.test(message)
  ) {
    return "This link has expired or is invalid. Request a new one.";
  }
  if (/signup is disabled|signups? (is )?disabled/i.test(message)) {
    return "Sign-up is currently disabled. Please try again later.";
  }
  if (/network|fetch failed|failed to fetch/i.test(message)) {
    return "Couldn't reach the authentication service. Check your connection and try again.";
  }
  return "Something went wrong. Please try again.";
}
