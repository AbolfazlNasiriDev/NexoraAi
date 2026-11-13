/**
 * Chat history windowing for the API payload (Phase 2.10).
 *
 * The UI keeps the full displayed thread, but the API must never
 * receive an unbounded history: the server rejects >50 messages, and
 * sending everything also grows token cost without bound. This helper
 * caps the payload at the most recent turns. It is pure and unit
 * tested; it never reorders messages and never touches the UI state.
 */

/**
 * Max messages sent to the API per request — well under the server's
 * 50-message limit, so a capped payload can never trip it.
 */
export const MAX_HISTORY_MESSAGES = 20;

/** Minimal shape the helper needs: a role and content. */
export interface HistoryMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

/**
 * Keep the most recent `maxMessages` messages, in order.
 *
 * Guarantees:
 * - the result never exceeds `maxMessages`;
 * - order is preserved (chronological, newest last);
 * - the last user message is always included — it is the newest turn
 *   in normal use (so it is in the tail by construction), and if the
 *   input's newest user turn is older than the window it is swapped
 *   in at the front (still chronological) while the oldest tail item
 *   is dropped, so the cap still holds;
 * - an input at or under the cap is returned unchanged (as a copy).
 */
export function selectRecentMessages<T extends HistoryMessage>(
  messages: readonly T[],
  maxMessages: number = MAX_HISTORY_MESSAGES,
): T[] {
  if (messages.length <= maxMessages) return [...messages];
  const tail = messages.slice(-maxMessages);

  let lastUserIndex = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      lastUserIndex = i;
      break;
    }
  }
  if (lastUserIndex === -1) return tail;
  const lastUser = messages[lastUserIndex];
  if (tail.includes(lastUser)) return tail;
  return [lastUser, ...tail.slice(1)];
}
