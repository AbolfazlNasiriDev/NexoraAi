/**
 * Chat domain types (Phase 2.3).
 *
 * These are the public, transport-level types for `POST /api/v1/chat`.
 * They are safe to import from anywhere (including future client code):
 * they carry no secrets, no SDK imports, and no server-only code.
 *
 * Relationship with `src/lib/ai/types.ts`:
 * - `ChatRole` is an alias of `AiRole` and `ChatMessage` is an alias of
 *   `AiMessage` — one single message type is shared by the API layer and
 *   the provider layer, so a validated chat request can be handed to the
 *   gateway without any conversion. `ChatRequest` / `ChatResponseData`
 *   are the API shapes built on top of those shared types; the gateway's
 *   `ChatCompletionRequest` / `ChatCompletionResponse` are the internal
 *   provider shapes (they additionally allow `maxTokens`, `temperature`
 *   and `stream`, which the public chat endpoint does not accept yet).
 */

import type { AiMessage, AiRole, TokenUsage } from "@/lib/ai/types";
import type { ProviderId } from "@/types/ai";

/** Role of a message in a conversation — same type as `AiRole`. */
export type ChatRole = AiRole;

/** One message in a chat request/response — same type as `AiMessage`. */
export type ChatMessage = AiMessage;

/**
 * A validated `POST /api/v1/chat` request body.
 * `conversationId` is `null` for a brand-new conversation.
 */
export interface ChatRequest {
  conversationId: string | null;
  modelId: string;
  messages: ChatMessage[];
}

/**
 * The `data` payload of a successful chat response.
 * `message` is always the assistant's reply — only ever real provider
 * output, never fabricated text.
 */
export interface ChatResponseData {
  conversationId: string | null;
  modelId: string;
  provider: ProviderId;
  message: ChatMessage;
  /** Token usage, when the provider reports it. Never invented. */
  usage?: TokenUsage;
}
