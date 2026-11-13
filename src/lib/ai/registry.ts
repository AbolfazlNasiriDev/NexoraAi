/**
 * Model registry (Phase 2.2).
 *
 * The single place the whole app asks "which models exist, and which of
 * them are actually usable?" It is built from the three provider classes
 * and nothing else — adding a provider means adding it to the
 * `ALL_PROVIDERS` list below, nothing else changes.
 *
 * Status derivation (the honesty rule, Phase 2.10):
 * every `ModelInfo.status` is computed live from configuration AND
 * implementation — a real API key present and a real SDK call
 * implemented -> "available"; a key present but the provider still a
 * stub -> "not_implemented"; no key -> "not_configured". Statuses are
 * NEVER hardcoded. Today no key is set, so every model reports
 * "not_configured" and `listAvailableModels()` correctly returns [].
 *
 * The Phase 1 display labels "Nexora 1.0 Pro", "Nexora 1.0" and
 * "Nexora Lite" are UI labels only and deliberately do NOT appear here —
 * they are not real AI models.
 */

import "server-only";

import { isProviderConfigured } from "@/lib/server/env";
import type { AIProvider } from "@/lib/ai/provider";
import { AnthropicProvider } from "@/lib/ai/providers/anthropic";
import { GeminiProvider } from "@/lib/ai/providers/gemini";
import { OpenAIProvider } from "@/lib/ai/providers/openai";
import type { ModelInfo, ProviderId } from "@/types/ai";
import type { ProviderStatus } from "@/types/api";

export class ModelRegistry {
  private readonly providers: AIProvider[];

  constructor(providers: AIProvider[]) {
    this.providers = [...providers];
  }

  /** All providers known to the registry. */
  listProviders(): AIProvider[] {
    return [...this.providers];
  }

  /** Every model from every provider, with live status attached. */
  listModels(): ModelInfo[] {
    return this.providers.flatMap((provider) => provider.getModels());
  }

  /** One model by registry id, or `undefined` when unknown. */
  getModel(modelId: string): ModelInfo | undefined {
    return this.listModels().find((model) => model.id === modelId);
  }

  /** The provider that serves a model id, or `undefined` when unknown. */
  getProviderForModel(modelId: string): AIProvider | undefined {
    return this.providers.find(
      (provider) => provider.identifyModel(modelId) !== undefined,
    );
  }

  /**
   * Only models whose provider is configured AND implemented.
   * Returns [] today — nothing is configured, and that empty result is
   * correct, not a bug. A `not_implemented` model is never listed here.
   */
  listAvailableModels(): ModelInfo[] {
    return this.listModels().filter((model) => model.status === "available");
  }

  /**
   * Live status of every provider, derived from real configuration.
   * NOTE: provider status is key-based only ("configured" = a key is
   * present) and is NOT the same as model availability — a configured
   * provider whose `chat()` is still a stub reports its models as
   * `not_implemented`, not `available`.
   */
  getProviderStatus(): Record<ProviderId, ProviderStatus> {
    return {
      openai: isProviderConfigured("openai")
        ? "configured"
        : "not_configured",
      gemini: isProviderConfigured("gemini")
        ? "configured"
        : "not_configured",
      anthropic: isProviderConfigured("anthropic")
        ? "configured"
        : "not_configured",
    };
  }
}

/** The single shared registry instance for the whole app. */
export const modelRegistry = new ModelRegistry([
  new OpenAIProvider(),
  new GeminiProvider(),
  new AnthropicProvider(),
]);
