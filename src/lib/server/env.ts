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
