/**
 * OpenAI provider (Phase 2.2).
 *
 * Thin implementation of the shared `AIProvider` contract. No SDK is
 * installed and no API key exists, so this provider is NOT configured and
 * NOT usable yet:
 * - `chat()` / `chatStream()` throw the standard 503
 *   (`providerNotConfiguredError`) while unconfigured and never return a
 *   fabricated reply.
 * - Once a real `OPENAI_API_KEY` is set, the methods throw a clearly-marked
 *   "not implemented" error until the real OpenAI SDK integration lands
 *   (Phase 2.3+). No SDK calls are written here.
 *
 * The model ids below are candidate identifiers only — real public model
 * family names, listed so the registry knows what this provider *would*
 * serve. They are reported as `not_configured` until a real key is set.
 */

import "server-only";

import { BaseProvider } from "@/lib/ai/providers/base";
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  StreamChunk,
} from "@/lib/ai/types";

export class OpenAIProvider extends BaseProvider {
  constructor() {
    super(
      "openai",
      "OpenAI",
      { streaming: true, supportsSystemPrompt: true },
      [
        {
          id: "gpt-4o",
          name: "GPT-4o",
          description:
            "OpenAI's flagship multimodal model — fast, capable general chat.",
          capabilities: ["chat", "streaming"],
        },
        {
          id: "gpt-4o-mini",
          name: "GPT-4o mini",
          description:
            "OpenAI's small, fast and affordable model for everyday chat.",
          capabilities: ["chat", "streaming"],
        },
      ],
    );
  }

  async chat(
    request: ChatCompletionRequest,
  ): Promise<ChatCompletionResponse> {
    this.requireConfigured();
    throw this.notImplementedError(`chat for model ${request.modelId}`);
  }

  chatStream(
    request: ChatCompletionRequest,
  ): AsyncGenerator<StreamChunk> {
    this.requireConfigured();
    return this.unimplementedStream(
      `chatStream for model ${request.modelId}`,
    );
  }
}
