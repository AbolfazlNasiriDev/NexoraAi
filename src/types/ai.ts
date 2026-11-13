/**
 * Public / shared AI domain types (Phase 2.2).
 *
 * These types are safe to import from anywhere (including future client
 * code): they carry no secrets, no SDK imports, and no server-only code.
 * Server modules re-use the same `ProviderId` union as
 * `src/lib/server/env.ts` — the two unions are intentionally identical so
 * a provider id is the same value on both sides of the boundary.
 */

/** The AI providers Nexora will support. One id per provider, everywhere. */
export type ProviderId = "openai" | "gemini" | "anthropic";

/**
 * Honest status of a model in the registry.
 * - `available`: its provider has a real connection configured.
 * - `not_configured`: no API key (or other real connection) is set up.
 * - `disabled`: the model is known but deliberately switched off.
 *
 * Status is always DERIVED from live configuration (see
 * `src/lib/ai/registry.ts`). It is never hardcoded to `available`.
 */
export type ModelStatus = "available" | "not_configured" | "disabled";

/**
 * One model as the rest of the app sees it.
 *
 * NOTE: The Phase 1 display labels "Nexora 1.0 Pro", "Nexora 1.0" and
 * "Nexora Lite" are UI labels only and must NEVER appear as `ModelInfo`
 * entries — they are not real AI models.
 */
export interface ModelInfo {
  /** Stable registry id, e.g. "gpt-4o". Unique across all providers. */
  id: string;
  /** Human-readable name, e.g. "GPT-4o". */
  name: string;
  /** Which provider serves this model. */
  provider: ProviderId;
  /** Short description of the model. */
  description: string;
  /** Capability tags, e.g. ["chat", "streaming"]. */
  capabilities: string[];
  /** Live status — derived from real configuration, never faked. */
  status: ModelStatus;
}
