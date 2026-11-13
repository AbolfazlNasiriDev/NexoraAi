/**
 * Unit tests for chat history windowing (Phase 2.10).
 *
 * Pins the payload cap: at most 20 messages are sent to the API,
 * newest last, and the last user message is always in the payload —
 * even when it is older than the window.
 */
import { describe, expect, it } from "vitest";

import {
  MAX_HISTORY_MESSAGES,
  selectRecentMessages,
  type HistoryMessage,
} from "@/lib/api/history";

function msg(role: "user" | "assistant", i: number): HistoryMessage {
  return { role, content: `message ${i}` };
}

describe("selectRecentMessages", () => {
  it("returns an under-cap list unchanged", () => {
    const input = [msg("user", 0), msg("assistant", 1), msg("user", 2)];
    const out = selectRecentMessages(input);
    expect(out).toEqual(input);
    expect(out).toHaveLength(3);
    // A copy, not the same array reference.
    expect(out).not.toBe(input);
  });

  it("returns an empty list for empty input", () => {
    expect(selectRecentMessages([])).toEqual([]);
  });

  it("caps an over-cap list at 20, preserving order", () => {
    const input = Array.from({ length: 45 }, (_, i) =>
      msg(i % 2 === 0 ? "user" : "assistant", i),
    );
    const out = selectRecentMessages(input);
    expect(out).toHaveLength(MAX_HISTORY_MESSAGES);
    expect(out).toHaveLength(20);
    expect(out).toEqual(input.slice(-20));
    expect(out[out.length - 1]).toEqual(input[input.length - 1]);
  });

  it("always keeps the last user message, even when it falls outside the window", () => {
    // 25 messages: the last user turn is at index 3; everything after
    // it is an assistant turn, so the plain tail would drop it.
    const input: HistoryMessage[] = [
      msg("user", 0),
      msg("assistant", 1),
      msg("assistant", 2),
      msg("user", 3),
      ...Array.from({ length: 21 }, (_, k) => msg("assistant", 4 + k)),
    ];
    expect(input).toHaveLength(25);
    expect(input[input.length - 1]).toEqual(msg("assistant", 24));

    const out = selectRecentMessages(input);
    expect(out).toHaveLength(MAX_HISTORY_MESSAGES);
    expect(out).toContainEqual(msg("user", 3));
    expect(out[0]).toEqual(msg("user", 3));
    // Chronological order is preserved: the swapped-in user turn is
    // older than everything else in the window.
    expect(out[out.length - 1]).toEqual(msg("assistant", 24));
  });

  it("keeps the newest user message when the input ends with one", () => {
    const input = Array.from({ length: 30 }, (_, i) =>
      msg(i % 2 === 0 ? "user" : "assistant", i),
    );
    // Last element (index 29) is an assistant turn; the last user turn
    // is index 28, inside the window.
    const out = selectRecentMessages(input);
    expect(out).toHaveLength(20);
    expect(out).toContainEqual(msg("user", 28));
    expect(out[out.length - 1]).toEqual(msg("assistant", 29));
  });

  it("respects a custom cap", () => {
    const input = Array.from({ length: 10 }, (_, i) => msg("user", i));
    const out = selectRecentMessages(input, 5);
    expect(out).toHaveLength(5);
    expect(out).toEqual(input.slice(-5));
  });
});
