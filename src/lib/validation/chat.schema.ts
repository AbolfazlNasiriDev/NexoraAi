/**
 * Chat request validation (Phase 2.3).
 *
 * Server-only, hand-written validation for `POST /api/v1/chat` — no
 * validation library is used, so no new dependency is needed.
 *
 * Rules (all enforced, all returning 400 `VALIDATION_ERROR`):
 * - body must be a plain JSON object (not null, not an array);
 * - unknown top-level fields are rejected (strict shape);
 * - `conversationId`: missing is treated as `null`; otherwise `null` or a
 *   non-empty string of at most 128 chars;
 * - `modelId`: required non-empty string of at most 128 chars;
 * - `messages`: required array of 1..50 messages;
 * - each message: an object with exactly `role` + `content` (unknown
 *   message fields are rejected); `role` must be "user" | "assistant" |
 *   "system"; `content` must be a string of 1..8000 chars after trimming
 *   (empty / whitespace-only and over-long content are rejected);
 * - at least one message must have role "user", and the last message must
 *   have role "user" (a chat request ends with the user's turn).
 *
 * Error details never include raw user content — only a short field
 * pointer such as "messages[2].content". Secrets are never echoed.
 */

import "server-only";

import { ApiError, validationError } from "@/lib/server/errors";
import type { ChatMessage, ChatRequest, ChatRole } from "@/types/chat";

/** Maximum number of messages in one chat request. */
export const MAX_MESSAGES = 50;
/** Maximum characters of one message's content (measured after trimming). */
export const MAX_CONTENT_CHARS = 8000;
/** Maximum characters of `modelId`. */
export const MAX_MODEL_ID_CHARS = 128;
/** Maximum characters of `conversationId`. */
export const MAX_CONVERSATION_ID_CHARS = 128;

const TOP_LEVEL_FIELDS = ["conversationId", "modelId", "messages"] as const;
const MESSAGE_FIELDS = ["role", "content"] as const;
const ROLES: readonly ChatRole[] = ["user", "assistant", "system"];

export type ValidateChatRequestResult =
  | { ok: true; data: ChatRequest }
  | { ok: false; error: ApiError };

function fail(message: string, field: string): ValidateChatRequestResult {
  return { ok: false, error: validationError(message, { field }) };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Validate an unknown parsed JSON body as a `ChatRequest`.
 * Returns the validated (and trimmed) request, or a typed 400 error.
 */
export function validateChatRequest(
  input: unknown,
): ValidateChatRequestResult {
  if (!isPlainObject(input)) {
    return fail("Request body must be a JSON object.", "body");
  }

  for (const key of Object.keys(input)) {
    if (!(TOP_LEVEL_FIELDS as readonly string[]).includes(key)) {
      return fail(`Unknown field: ${key}.`, key);
    }
  }

  // --- conversationId: missing -> null; null or non-empty string <= 128 ---
  let conversationId: string | null = null;
  if ("conversationId" in input && input.conversationId !== undefined) {
    const raw = input.conversationId;
    if (raw === null) {
      conversationId = null;
    } else if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (trimmed.length === 0) {
        return fail(
          "conversationId must be null or a non-empty string.",
          "conversationId",
        );
      }
      if (trimmed.length > MAX_CONVERSATION_ID_CHARS) {
        return fail(
          `conversationId must be at most ${MAX_CONVERSATION_ID_CHARS} characters.`,
          "conversationId",
        );
      }
      conversationId = trimmed;
    } else {
      return fail(
        "conversationId must be null or a string.",
        "conversationId",
      );
    }
  }

  // --- modelId: required non-empty string <= 128 ---
  const rawModelId = input.modelId;
  if (typeof rawModelId !== "string" || rawModelId.trim().length === 0) {
    return fail("modelId is required and must be a non-empty string.", "modelId");
  }
  const modelId = rawModelId.trim();
  if (modelId.length > MAX_MODEL_ID_CHARS) {
    return fail(
      `modelId must be at most ${MAX_MODEL_ID_CHARS} characters.`,
      "modelId",
    );
  }

  // --- messages: required array of 1..50 ---
  const rawMessages = input.messages;
  if (!Array.isArray(rawMessages)) {
    return fail("messages is required and must be an array.", "messages");
  }
  if (rawMessages.length === 0) {
    return fail("At least one message is required.", "messages");
  }
  if (rawMessages.length > MAX_MESSAGES) {
    return fail(
      `At most ${MAX_MESSAGES} messages are allowed per request.`,
      "messages",
    );
  }

  const messages: ChatMessage[] = [];
  let hasUserMessage = false;

  for (let i = 0; i < rawMessages.length; i++) {
    const field = `messages[${i}]`;
    const raw = rawMessages[i];
    if (!isPlainObject(raw)) {
      return fail("Each message must be an object.", field);
    }
    for (const key of Object.keys(raw)) {
      if (!(MESSAGE_FIELDS as readonly string[]).includes(key)) {
        return fail(`Unknown field in message: ${key}.`, `${field}.${key}`);
      }
    }

    const role = raw.role;
    if (
      typeof role !== "string" ||
      !(ROLES as readonly string[]).includes(role)
    ) {
      return fail(
        'Message role must be "user", "assistant" or "system".',
        `${field}.role`,
      );
    }
    if (role === "user") {
      hasUserMessage = true;
    }

    const content = raw.content;
    if (typeof content !== "string") {
      return fail("Message content must be a string.", `${field}.content`);
    }
    const trimmed = content.trim();
    if (trimmed.length === 0) {
      return fail(
        "Message content must not be empty.",
        `${field}.content`,
      );
    }
    if (trimmed.length > MAX_CONTENT_CHARS) {
      return fail(
        `Message content must be at most ${MAX_CONTENT_CHARS} characters.`,
        `${field}.content`,
      );
    }

    messages.push({ role: role as ChatRole, content: trimmed });
  }

  if (!hasUserMessage) {
    return fail("At least one message must have role \"user\".", "messages");
  }
  if (messages[messages.length - 1].role !== "user") {
    return fail(
      "The last message must have role \"user\".",
      `messages[${messages.length - 1}].role`,
    );
  }

  return { ok: true, data: { conversationId, modelId, messages } };
}
