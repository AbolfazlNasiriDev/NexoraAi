/**
 * The shared AI provider contract (Phase 2.2).
 *
 * Every provider (OpenAI, Gemini, Claude — and any future one) implements
 * this interface. The gateway and the registry only ever talk to providers
 * through this contract, so swapping or adding a provider never touches
 * the rest of the app.
 *
 * Honesty rules built into the contract:
 * - `isConfigured()` is the only source of truth for "is this provider
 *   usable?" — it reads the real server env, never a hardcoded flag.
 * - `chat()` / `chatStream()` must throw `providerNotConfiguredError`
 *   (HTTP 503) when the provider is not configured, and must NEVER return
 *   a fabricated reply.
 * - Rate-limit failures surface as `ApiError` with code `RATE_LIMITED`
 *   and `retryable: true` (see `ProviderErrorInfo`), so callers can retry
 *   with back-off instead of guessing.
 */

import "server-only";

import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  StreamChunk,
} from "@/lib/ai/types";
import type { ModelInfo, ProviderId } from "@/types/ai";

export interface AIProvider {
  /** Stable provider id, e.g. "openai". */
  id: ProviderId;

  /** Human-readable name, e.g. "OpenAI". */
  displayName: string;

  /**
   * True only when a real API key (or other real connection) is configured
   * for this provider. Reads live server env — never hardcoded.
   */
  isConfigured(): boolean;

  /**
   * The models this provider would serve once configured, with their live
   * status derived from configuration. Returns an empty list only if the
   * provider declares no candidate models at all — never invents models.
   */
  getModels(): ModelInfo[];

  /**
   * Send a chat completion request and wait for the full reply.
   * @throws providerNotConfiguredError (503) when not configured.
   * @throws rateLimitedError (429, retryable) when the provider rate-limits.
   * @throws internalError (500) for unexpected provider failures.
   * Never returns fabricated text.
   */
  chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;

  /**
   * Stream a chat completion as `StreamChunk`s ("text" deltas, then a
   * "done" chunk; "error" chunks carry failures instead of throwing
   * mid-stream where the transport allows it).
   * @throws providerNotConfiguredError (503) when not configured — thrown
   * eagerly, before any chunk is produced.
   * Never yields fabricated text.
   */
  chatStream(request: ChatCompletionRequest): AsyncGenerator<StreamChunk>;

  /**
   * Identify one of this provider's models by registry id.
   * Returns `undefined` when the id is unknown to this provider — callers
   * use this to route a request to the right provider.
   */
  identifyModel(modelId: string): ModelInfo | undefined;
}
