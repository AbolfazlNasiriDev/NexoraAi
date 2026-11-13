/**
 * AI gateway (Phase 2.2).
 *
 * The single entry point for everything AI in the app. Route handlers
 * (Phase 2.3+) call the gateway — never a provider directly — so model
 * resolution, configuration checks, and error handling happen in exactly
 * one place.
 *
 * Behaviour:
 * - Resolves `request.modelId` through the registry. An unknown model id
 *   is a 400 `validationError` — never silently routed somewhere else.
 * - When the model's provider has no real API key, throws the standard
 *   503 `providerNotConfiguredError` ("AI provider is not configured
 *   yet."). No fabricated reply is ever produced.
 * - When configured, delegates to the provider. (Until the real SDK
 *   integration lands in Phase 2.3+, a configured provider throws a
 *   clearly-marked "not implemented" error — loud failure, never a fake
 *   answer.)
 * - No route handler lives here: this is a library for Phase 2.3.
 */

import "server-only";

import { validationError } from "@/lib/server/errors";
import type { AIProvider } from "@/lib/ai/provider";
import { modelRegistry, type ModelRegistry } from "@/lib/ai/registry";
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  StreamChunk,
} from "@/lib/ai/types";

export class AIGateway {
  private readonly registry: ModelRegistry;

  constructor(registry: ModelRegistry = modelRegistry) {
    this.registry = registry;
  }

  /** The registry this gateway resolves models through. */
  getRegistry(): ModelRegistry {
    return this.registry;
  }

  /**
   * Run a full (non-streaming) chat completion.
   * @throws validationError (400) for a missing/unknown modelId or an
   * empty message list.
   * @throws providerNotConfiguredError (503) when the model's provider
   * has no real API key configured.
   */
  async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const provider = this.resolveProvider(request);
    return provider.chat(request);
  }

  /**
   * Stream a chat completion as `StreamChunk`s.
   * @throws validationError (400) / providerNotConfiguredError (503) —
   * both thrown eagerly, before any chunk is produced.
   */
  chatStream(
    request: ChatCompletionRequest,
  ): AsyncGenerator<StreamChunk> {
    const provider = this.resolveProvider(request);
    return provider.chatStream(request);
  }

  /**
   * Validate the request shape minimally and resolve the provider that
   * serves `request.modelId`. Full input validation (message roles,
   * sizes, counts) belongs to Phase 2.3's validation layer.
   */
  private resolveProvider(request: ChatCompletionRequest): AIProvider {
    if (
      !request ||
      typeof request.modelId !== "string" ||
      request.modelId.trim() === ""
    ) {
      throw validationError("modelId is required.", {
        field: "modelId",
      });
    }
    if (!Array.isArray(request.messages) || request.messages.length === 0) {
      throw validationError("At least one message is required.", {
        field: "messages",
      });
    }
    const model = this.registry.getModel(request.modelId);
    if (!model) {
      throw validationError(`Unknown model: ${request.modelId}.`, {
        field: "modelId",
        modelId: request.modelId,
      });
    }
    const provider = this.registry.getProviderForModel(request.modelId);
    if (!provider) {
      // Unreachable when getModel() succeeded, but kept as a guard.
      throw validationError(`Unknown model: ${request.modelId}.`, {
        field: "modelId",
        modelId: request.modelId,
      });
    }
    return provider;
  }
}

/** The single shared gateway instance for the whole app. */
export const aiGateway = new AIGateway(modelRegistry);

/** Convenience accessor for the shared gateway instance. */
export function getGateway(): AIGateway {
  return aiGateway;
}

/** Convenience accessor for the shared registry instance. */
export function getRegistry(): ModelRegistry {
  return modelRegistry;
}
