/**
 * Conversation / UI message types (Phase 2.5).
 *
 * These describe what the user sees in the chat thread. They are
 * deliberately separate from the transport types in `src/types/chat.ts`:
 * the UI also needs loading and error states, which are not API messages.
 *
 * Honesty rules for `UiMessage.kind`:
 * - `"user"`: the user's own words, exactly as typed.
 * - `"assistant"`: a REAL provider reply, returned by `POST /api/v1/chat`.
 *   Nothing in Phase 2.5 may create one except the success path in
 *   `src/app/page.tsx` — and that path is unreachable today, because
 *   every valid request returns 503 `PROVIDER_NOT_CONFIGURED`.
 * - `"error"`: a distinct SYSTEM message (never an assistant reply). It
 *   renders as a visibly different error bubble carrying the API error
 *   code/message, e.g. the provider-not-configured error.
 * - `"loading"`: a transient "thinking" indicator, removed as soon as
 *   the API answers or fails. It is never shown as a reply.
 */

/** How a message in the thread should be rendered. */
export type UiMessageKind = "user" | "assistant" | "error" | "loading";

/** One row in the chat thread. */
export interface UiMessage {
  /** Client-side id, unique within the thread. */
  id: string;
  kind: UiMessageKind;
  /** Message text. Empty for "loading" messages. */
  content: string;
  /** API error code (only for kind "error"), e.g. "PROVIDER_NOT_CONFIGURED". */
  errorCode?: string;
  /** Attached file name (only for kind "user", local-only in Phase 2.5). */
  fileName?: string;
  /** Attached file size in bytes (only for kind "user", local-only). */
  fileSize?: number;
  /** Model name shown on the bubble (only for kind "user"/"assistant"). */
  modelName?: string;
  /** When the message was added, as a unix timestamp in ms. */
  createdAt?: number;
}

/** The conversation the page holds: one (still local-only) thread. */
export interface Conversation {
  /** Server conversation id, once the backend supports it. `null` for now. */
  id: string | null;
  /** Registry model id selected in the ModelSelector. */
  modelId: string;
  /** Thread contents, in display order. */
  messages: UiMessage[];
}
