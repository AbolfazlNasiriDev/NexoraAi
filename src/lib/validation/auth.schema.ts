/**
 * Auth form validation (Phase 3.1) — pure, no dependencies.
 *
 * Shared by the client auth forms AND the server-side callback route
 * (`validateNextPath`), so the same rules are enforced on both sides.
 * Messages are user-facing and safe to display as-is. Nothing here
 * talks to Supabase, the network, or any secret.
 */

/** Minimum password length, client-side. Stricter than Supabase Auth's
 * default minimum (6) on purpose: 8 is the floor this product wants.
 * The server (Supabase) still enforces its own minimum as well. */
export const MIN_PASSWORD_LENGTH = 8;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Validate one email address. Returns a friendly message or null. */
export function validateEmail(email: string): string | null {
  const value = email.trim();
  if (value.length === 0) return "Email is required.";
  if (value.length > 254) return "That email address is too long.";
  if (!EMAIL_PATTERN.test(value)) return "Enter a valid email address.";
  return null;
}

/** Validate one password. Returns a friendly message or null. */
export function validatePassword(password: string): string | null {
  if (password.length === 0) return "Password is required.";
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
}

/** Validate that the confirmation matches the password. */
export function validatePasswordMatch(
  password: string,
  confirmPassword: string,
): string | null {
  if (confirmPassword.length === 0) return "Please confirm your password.";
  if (password !== confirmPassword) return "Passwords do not match.";
  return null;
}

export interface SignInErrors {
  email?: string;
  password?: string;
}

export interface SignUpErrors extends SignInErrors {
  confirmPassword?: string;
}

/** Validate the sign-in form. Returns `{ ok, errors }`. */
export function validateSignInForm(input: {
  email: string;
  password: string;
}): { ok: boolean; errors: SignInErrors } {
  const errors: SignInErrors = {};
  const emailError = validateEmail(input.email);
  if (emailError) errors.email = emailError;
  const passwordError = validatePassword(input.password);
  if (passwordError) errors.password = passwordError;
  return { ok: Object.keys(errors).length === 0, errors };
}

/** Validate the sign-up form (incl. password confirmation). */
export function validateSignUpForm(input: {
  email: string;
  password: string;
  confirmPassword: string;
}): { ok: boolean; errors: SignUpErrors } {
  const errors: SignUpErrors = {};
  const emailError = validateEmail(input.email);
  if (emailError) errors.email = emailError;
  const passwordError = validatePassword(input.password);
  if (passwordError) errors.password = passwordError;
  const matchError = validatePasswordMatch(
    input.password,
    input.confirmPassword,
  );
  if (matchError) errors.confirmPassword = matchError;
  return { ok: Object.keys(errors).length === 0, errors };
}

/**
 * Validate a `next` redirect target (open-redirect protection, used by
 * the auth callback route). Only relative paths inside this app are
 * allowed: must start with exactly one `/`, and must not be a protocol
 * or protocol-relative URL. Returns the safe path, or "/" as the
 * default when the input is missing/invalid.
 */
export function validateNextPath(next: string | null | undefined): string {
  if (typeof next !== "string" || next.length === 0) return "/";
  if (!next.startsWith("/")) return "/";
  // "//evil.com", "/\evil.com" and "/%2Fevil.com"-style escapes are out.
  if (next.startsWith("//") || next.startsWith("/\\")) return "/";
  if (next.includes("\\")) return "/";
  if (/^\/[a-z][a-z0-9+.-]*:/i.test(next)) return "/";
  return next;
}
