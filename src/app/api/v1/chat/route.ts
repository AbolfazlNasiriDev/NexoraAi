/**
 * POST /api/v1/chat — chat completion endpoint (Phase 2.3).
 *
 * Flow:
 * 0. Read the body with a 1 MB size cap (`readLimitedBodyText`) —
 *    oversize -> 413 PAYLOAD_TOO_LARGE, before any JSON parsing.
 * 1. Parse the JSON body safely (malformed JSON -> 400 VALIDATION_ERROR).
 * 2. Validate strictly with `validateChatRequest` (roles, sizes, counts,
 *    last message must be the user's turn) -> 400 on any violation.
 * 3. Hand the validated request to `aiGateway.chat()`, which resolves the
 *    model through the registry: unknown modelId -> 400 VALIDATION_ERROR
 *    (the id is named as unknown, never silently re-routed or replaced).
 * 4. The provider answers — or, today, the gateway throws the standard
 *    503 `providerNotConfiguredError` ("AI provider is not configured
 *    yet.") because no provider has a real API key. No fabricated reply
 *    text is ever produced here.
 *
 * Known Phase 2.2 caveat, handled loudly: if a provider were configured
 * but its `chat()` were still a not-implemented stub, the plain Error it
 * throws is mapped by `withErrorHandling` to a generic 500
 * INTERNAL_ERROR — a loud failure, never a fake reply. With no keys set
 * today that path is unreachable and every valid request returns 503.
 *
 * Only POST is defined; any other method gets Next.js' default 405.
 * Streaming is not served here — `gateway.chatStream` stays a library
 * for a later phase.
 *
 * Auth gate (Phase 3.1) — the identity check runs BEFORE the body is
 * read, and the authenticated user id comes ONLY from
 * `getAuthenticatedUser()` (a server-verified session). A `user_id`
 * sent in the request body is never read or trusted: the validator
 * rejects unknown fields, so a forged `user_id` is a 400, never an
 * identity. The three branches:
 *   (a) Supabase NOT configured: today's exact behaviour — valid
 *       request -> 503 PROVIDER_NOT_CONFIGURED, validation errors
 *       unchanged. There is no auth to enforce and no AI to protect.
 *   (b) Supabase configured + no authenticated user -> 401
 *       UNAUTHORIZED ("Authentication is required.").
 *   (c) Supabase configured + authenticated -> existing behaviour
 *       (503 until a provider is implemented).
 */

import { aiGateway } from "@/lib/ai/gateway";
import { validateChatRequest } from "@/lib/validation/chat.schema";
import { ApiError, unauthorizedError, validationError } from "@/lib/server/errors";
import { readLimitedBodyText } from "@/lib/server/request-body";
import { ok, withErrorHandling } from "@/lib/server/response";
import {
  getAuthenticatedUser,
  isSupabaseConfiguredServer,
} from "@/lib/supabase/server";
import type { ChatResponseData } from "@/types/chat";

export const POST = withErrorHandling(async (req: Request) => {
  // Phase 3.1 auth gate (see header): configured + anonymous -> 401.
  // Unconfigured -> skip entirely, behaviour is unchanged.
  if (isSupabaseConfiguredServer()) {
    const { user } = await getAuthenticatedUser();
    if (!user) throw unauthorizedError();
  }

  // Size-capped read first (1 MB): oversize -> 413 PAYLOAD_TOO_LARGE.
  // Any other read failure (aborted/truncated stream) is treated like
  // an unreadable body -> the standard 400 below.
  let text: string;
  try {
    text = await readLimitedBodyText(req);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw validationError("Request body must be valid JSON.", {
      field: "body",
    });
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw validationError("Request body must be valid JSON.", {
      field: "body",
    });
  }

  const validated = validateChatRequest(body);
  if (!validated.ok) {
    throw validated.error;
  }
  const { conversationId, modelId, messages } = validated.data;

  const completion = await aiGateway.chat({ modelId, messages });

  const data: ChatResponseData = {
    conversationId,
    modelId: completion.modelId,
    provider: completion.provider,
    message: { role: "assistant", content: completion.content },
    ...(completion.usage ? { usage: completion.usage } : {}),
  };
  return ok(data);
});
