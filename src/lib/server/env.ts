import "server-only";

/**
 * Server-only environment configuration (Phase 2.1).
 *
 * - Reads `process.env` once, at import time, on the server only.
 * - AI provider keys are ALL OPTIONAL in Phase 2: the app must build and
 *   run with none of them set. Nothing here throws when a key is absent.
 * - Public values (NEXT_PUBLIC_*) get safe defaults.
 * - Secret values are NEVER logged, NEVER returned from any API, and NEVER
 *   re-exported — only booleans ("is this provider configured?") leave
 *   this module.
 */

export type ProviderId = "openai" | "gemini" | "anthropic";

/** The env var that holds each provider's API key. */
const PROVIDER_ENV_VARS: Record<ProviderId, string> = {
  openai: "OPENAI_API_KEY",
  gemini: "GEMINI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
};

const PROVIDER_IDS: ProviderId[] = ["openai", "gemini", "anthropic"];

/** Non-empty (after trimming) means "present". Empty strings count as absent. */
function hasValue(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function readPublic(name: string, fallback: string): string {
  const value = process.env[name];
  return hasValue(value) ? (value as string).trim() : fallback;
}

export interface ProviderConfig {
  /** True only when a real, non-empty API key is set for this provider. */
  configured: boolean;
}

export interface Env {
  appName: string;
  appUrl: string;
  nodeEnv: "development" | "production" | "test";
  providers: Record<ProviderId, ProviderConfig>;
}

function buildEnv(): Env {
  const nodeEnv = process.env.NODE_ENV;
  return {
    appName: readPublic("NEXT_PUBLIC_APP_NAME", "Nexora AI"),
    appUrl: readPublic("NEXT_PUBLIC_APP_URL", "http://localhost:3000"),
    nodeEnv:
      nodeEnv === "production" || nodeEnv === "test"
        ? nodeEnv
        : "development",
    providers: {
      openai: { configured: hasValue(process.env.OPENAI_API_KEY) },
      gemini: { configured: hasValue(process.env.GEMINI_API_KEY) },
      anthropic: { configured: hasValue(process.env.ANTHROPIC_API_KEY) },
    },
  };
}

/** Validated, typed server environment. Safe to import in route handlers
 * and other server-only modules. */
export const env: Env = buildEnv();

/** True when a real API key is configured for the given provider. */
export function isProviderConfigured(provider: ProviderId): boolean {
  return env.providers[provider].configured;
}

/** True when at least one AI provider has a real API key configured. */
export function hasAnyProviderConfigured(): boolean {
  return PROVIDER_IDS.some((id) => env.providers[id].configured);
}

/** The env var name for a provider's key (for docs / error messages only —
 * never use it to read or expose the value). */
export function providerEnvVar(provider: ProviderId): string {
  return PROVIDER_ENV_VARS[provider];
}

// ---------------------------------------------------------------------------
// Required vs. optional variables (Phase 2.7)
// ---------------------------------------------------------------------------
//
// - REQUIRED: variables with no safe default. Today there are NONE:
//   `NEXT_PUBLIC_APP_NAME` / `NEXT_PUBLIC_APP_URL` have defaults, and
//   every provider key and Supabase value is optional — the app must
//   build and run with an entirely empty env. If a future phase adds a
//   variable the server cannot run without, add it here AND to the
//   `REQUIRED_ENV_VARS` list; `validateEnv()` will then report it.
// - OPTIONAL: everything else. Missing optional vars only disable the
//   feature they gate (provider → `not_configured`, Supabase →
//   `isSupabaseConfigured() === false`).
//
// Runtime guard: server-only secrets — the three provider API keys and
// `SUPABASE_SERVICE_ROLE_KEY` — must only ever be read through this
// module, on the server. Never put a secret in a `NEXT_PUBLIC_`
// variable, never log it, never return it from an API, and never send
// it to the client. Only booleans ("is it configured?") leave this
// module. (`SUPABASE_ANON_KEY` is the one exception by design: it is a
// publishable key meant for the browser, but it is still read
// server-side here and only handed to a client when a Supabase client
// is created in a later phase.)

/** Variables the server cannot run without. Today: none (see above). */
export const REQUIRED_ENV_VARS: readonly string[] = [];

/** Variables that are safe to leave unset; each gates one feature. */
export const OPTIONAL_ENV_VARS: readonly string[] = [
  "OPENAI_API_KEY",
  "GEMINI_API_KEY",
  "ANTHROPIC_API_KEY",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

export interface EnvValidation {
  /** True when every required variable is set (today always true). */
  ok: boolean;
  /** Required variables that are missing. Today always empty. */
  missingRequired: string[];
  /** Optional variables that are unset — features they gate are off. */
  missingOptional: string[];
}

/**
 * Report which env vars are missing — names only, never values.
 * Safe to call at startup or from a health-style check; it never
 * returns, logs, or otherwise exposes a secret value.
 */
export function validateEnv(): EnvValidation {
  const missingRequired = REQUIRED_ENV_VARS.filter(
    (name) => !hasValue(process.env[name]),
  );
  const missingOptional = OPTIONAL_ENV_VARS.filter(
    (name) => !hasValue(process.env[name]),
  );
  return {
    ok: missingRequired.length === 0,
    missingRequired,
    missingOptional,
  };
}

/**
 * True only when Supabase can be used: both the project URL and the
 * anon key are set. Today always false — no Supabase project exists
 * yet (Phase 2.6 prepared the schema only).
 */
export function isSupabaseConfigured(): boolean {
  return (
    hasValue(process.env.SUPABASE_URL) &&
    hasValue(process.env.SUPABASE_ANON_KEY)
  );
}
