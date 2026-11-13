/**
 * Provider-neutral AI types (Phase 2.2).
 *
 * These describe a chat completion in a way that works for every provider
 * (OpenAI, Gemini, Claude). No provider-specific fields, no SDK types,
 * no model names invented here — concrete models live in the provider
 * classes under `src/lib/ai/providers/`.
 */

import type { ProviderId } from "@/types/ai";

/** Roles a message in a conversation can have. */
export type AiRole = "user" | "assistant" | "system";

/** One message in a chat completion request. */
export interface AiMessage {
  role: AiRole;
  content: string;
}

/** A chat completion request, as the gateway receives it. */
export interface ChatCompletionRequest {
  /** Registry model id, e.g. "gpt-4o". Must exist in the registry. */
  modelId: string;
  /** Conversation so far. The last message is normally the user's. */
  messages: AiMessage[];
  /** Optional cap on generated tokens. */
  maxTokens?: number;
  /** Optional sampling temperature. */
  temperature?: number;
  /** When true, the caller wants a streaming response instead. */
  stream?: boolean;
}

/** Token usage reported by a provider (all fields optional — not every
 * provider reports usage, and we never invent numbers). */
export interface TokenUsage {
  inputTokens?: number;
  outputTokens?: number;
}

/** A completed (non-streaming) chat completion. */
export interface ChatCompletionResponse {
  /** The model id that produced this response. */
  modelId: string;
  /** The provider that served it. */
  provider: ProviderId;
  /** The assistant's reply text — only ever real provider output. */
  content: string;
  /** Token usage, when the provider reports it. */
  usage?: TokenUsage;
  /** Why generation stopped, when the provider reports it. */
  finishReason?: string;
}

/** One piece of a streaming response. */
export interface StreamChunk {
  /** "text" carries a delta, "done" ends the stream, "error" reports a failure. */
  type: "text" | "done" | "error";
  /** Incremental reply text (only for "text" chunks). */
  delta?: string;
  /** Why generation stopped (only for "done" chunks, when reported). */
  finishReason?: string;
  /** Error details (only for "error" chunks). */
  error?: ProviderErrorInfo;
}

/** What a provider can do, in provider-neutral terms. */
export interface ProviderCapabilities {
  /** Whether the provider supports streaming responses. */
  streaming: boolean;
  /** Maximum output tokens the provider accepts, when known. */
  maxTokens?: number;
  /** Whether the provider accepts a "system" role message. */
  supportsSystemPrompt?: boolean;
}

/** Structured information about a provider-side failure. */
export interface ProviderErrorInfo {
  /** Machine-readable code, e.g. "RATE_LIMITED". */
  code: string;
  /** Human-readable message (safe to show, no secrets). */
  message: string;
  /** Whether retrying later is expected to help. */
  retryable: boolean;
  /** Suggested wait before retrying, in milliseconds, when known. */
  retryAfterMs?: number;
}
