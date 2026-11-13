/**
 * Shared plumbing for all AI providers (Phase 2.2).
 *
 * `BaseProvider` implements the parts of the `AIProvider` contract that are
 * identical for every provider — configuration checks, model listing with
 * live status derivation, model identification, and error mapping — so each
 * concrete provider file stays small and consistent. It performs NO network
 * calls and returns NO replies: the actual `chat()` / `chatStream()`
 * implementations live in the subclasses and are still stubs until a real
 * SDK integration lands (Phase 2.3+).
 */

import "server-only";

import { isProviderConfigured } from "@/lib/server/env";
import {
  ApiError,
  providerNotConfiguredError,
  rateLimitedError,
} from "@/lib/server/errors";
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ProviderCapabilities,
  StreamChunk,
} from "@/lib/ai/types";
import type { AIProvider } from "@/lib/ai/provider";
import type { ModelInfo, ModelStatus, ProviderId } from "@/types/ai";

/** One model a provider *would* serve once configured. These are candidate
 * identifiers only — a candidate is NOT an available model until its
 * provider is both configured (real API key) AND implemented (real SDK
 * call); a key alone reports `not_implemented` (see `modelStatus()`
 * below). */
export interface CandidateModel {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
}

export abstract class BaseProvider implements AIProvider {
  readonly id: ProviderId;
  readonly displayName: string;
  readonly capabilities: ProviderCapabilities;
  protected readonly candidates: CandidateModel[];
  /**
   * True only when `chat()` / `chatStream()` are real SDK calls.
   * Stays `false` for the Phase 2.2 stubs; a real provider
   * implementation sets it to `true` (or overrides `isImplemented()`).
   */
  protected readonly implemented: boolean = false;

  protected constructor(
    id: ProviderId,
    displayName: string,
    capabilities: ProviderCapabilities,
    candidates: CandidateModel[],
  ) {
    this.id = id;
    this.displayName = displayName;
    this.capabilities = capabilities;
    this.candidates = candidates;
  }

  /** True only when a real API key is configured for this provider. */
  isConfigured(): boolean {
    return isProviderConfigured(this.id);
  }

  /**
   * True only when `chat()` / `chatStream()` are real SDK calls, not
   * stubs. The stubs inherit `implemented = false`.
   */
  isImplemented(): boolean {
    return this.implemented;
  }

  /**
   * Live status for this provider's models, derived from real config
   * AND real implementation (Phase 2.10):
   * - no key -> "not_configured"
   * - key set, still a stub -> "not_implemented" (never "available")
   * - key set and implemented -> "available"
   * Nothing is ever hardcoded to "available".
   */
  protected modelStatus(): ModelStatus {
    if (!this.isConfigured()) return "not_configured";
    return this.isImplemented() ? "available" : "not_implemented";
  }

  /** Candidate models with their live status attached. */
  getModels(): ModelInfo[] {
    const status = this.modelStatus();
    return this.candidates.map((model) => ({
      id: model.id,
      name: model.name,
      provider: this.id,
      description: model.description,
      capabilities: [...model.capabilities],
      status,
    }));
  }

  /** Identify one of this provider's models by registry id. */
  identifyModel(modelId: string): ModelInfo | undefined {
    return this.getModels().find((model) => model.id === modelId);
  }

  /**
   * Guard every provider call: throw the standard 503 when this provider
   * has no real API key configured. Call this first in `chat()` /
   * `chatStream()` — never substitute a fabricated reply.
   */
  protected requireConfigured(): void {
    if (!this.isConfigured()) {
      throw providerNotConfiguredError(
        `AI provider is not configured yet.`,
      );
    }
  }

  /**
   * Placeholder for the real SDK call. Throws a plain (non-ApiError)
   * Error so the route layer maps it to a safe generic 500 — this is
   * deliberate: a configured-but-not-yet-implemented provider must fail
   * loudly, never pretend to answer. Replace with the real SDK call in
   * Phase 2.3+; do not invent a reply here.
   */
  protected notImplementedError(feature: string): Error {
    return new Error(
      `${this.displayName} ${feature} is not implemented yet. ` +
        `Connect the ${this.displayName} SDK integration first.`,
    );
  }

  /** Stream variant of the not-implemented stub (yields nothing, throws). */
  protected async *unimplementedStream(
    feature = "chatStream",
  ): AsyncGenerator<StreamChunk> {
    throw this.notImplementedError(feature);
  }

  /**
   * Map a provider-side rate-limit failure to the standard 429 ApiError.
   * `retryAfterMs` (when the provider reports one) is passed through in
   * `details` so callers can back off instead of guessing.
   */
  protected mapRateLimitError(retryAfterMs?: number): ApiError {
    const details =
      retryAfterMs !== undefined ? { retryAfterMs } : undefined;
    return new ApiError(
      429,
      "RATE_LIMITED",
      `${this.displayName} rate limit exceeded. Please try again later.`,
      details,
    );
  }

  /**
   * Normalize any provider-side failure into an `ApiError`:
   * - ApiError: re-thrown unchanged.
   * - HTTP 429-shaped errors (`status`/`statusCode` 429): RATE_LIMITED,
   *   retryable, with `retryAfterMs` when the provider reported one.
   * - Anything else: generic internal error (no internals leaked).
   * Real SDK errors will be routed through here in Phase 2.3+.
   */
  protected normalizeError(error: unknown): ApiError {
    if (error instanceof ApiError) {
      return error;
    }
    const status =
      (error as { status?: unknown; statusCode?: unknown } | null)?.status ??
      (error as { statusCode?: unknown } | null)?.statusCode;
    if (status === 429) {
      const retryAfter =
        (error as { retryAfterMs?: unknown } | null)?.retryAfterMs ??
        (error as { headers?: Record<string, string> } | null)?.headers?.[
          "retry-after"
        ];
      const retryAfterMs =
        typeof retryAfter === "number"
          ? retryAfter * 1000
          : typeof retryAfter === "string" && retryAfter.trim() !== ""
            ? Number(retryAfter) * 1000
            : undefined;
      const err = rateLimitedError(
        `${this.displayName} rate limit exceeded. Please try again later.`,
      );
      if (retryAfterMs !== undefined && Number.isFinite(retryAfterMs)) {
        return new ApiError(429, "RATE_LIMITED", err.message, {
          retryAfterMs,
        });
      }
      return err;
    }
    return new ApiError(
      500,
      "INTERNAL_ERROR",
      "An unexpected error occurred. Please try again later.",
    );
  }

  /** Concrete providers implement the real call (stubbed until Phase 2.3+). */
  abstract chat(
    request: ChatCompletionRequest,
  ): Promise<ChatCompletionResponse>;

  /** Concrete providers implement the real stream (stubbed until Phase 2.3+). */
  abstract chatStream(
    request: ChatCompletionRequest,
  ): AsyncGenerator<StreamChunk>;
}
