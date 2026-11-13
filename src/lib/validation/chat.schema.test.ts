/**
 * Unit tests for the chat request validator (Phase 2.3).
 *
 * Mirrors the live curl checks from Phase 2.3: every case below was
 * verified against the real endpoint then, and is pinned here so a
 * future change to the rules fails loudly instead of silently.
 *
 * No server, no network, no provider key: the validator is pure.
 */
import { describe, expect, it } from "vitest";

import {
  MAX_CONTENT_CHARS,
  MAX_MESSAGES,
  validateChatRequest,
} from "@/lib/validation/chat.schema";

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    modelId: "gpt-4o",
    messages: [{ role: "user", content: "Hello, Nexora." }],
    ...overrides,
  };
}

describe("validateChatRequest", () => {
  it("accepts a minimal valid request", () => {
    const result = validateChatRequest(validBody());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.conversationId).toBeNull();
    expect(result.data.modelId).toBe("gpt-4o");
    expect(result.data.messages).toEqual([
      { role: "user", content: "Hello, Nexora." },
    ]);
  });

  it("accepts system + assistant history and trims content", () => {
    const result = validateChatRequest(
      validBody({
        conversationId: "  conv-123  ",
        messages: [
          { role: "system", content: "Be helpful." },
          { role: "assistant", content: "Sure." },
          { role: "user", content: "  Hi again  " },
        ],
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.conversationId).toBe("conv-123");
    expect(result.data.messages[2]?.content).toBe("Hi again");
  });

  it("rejects an empty messages array", () => {
    const result = validateChatRequest(validBody({ messages: [] }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.status).toBe(400);
    expect(result.error.code).toBe("VALIDATION_ERROR");
    expect(result.error.details).toEqual({ field: "messages" });
  });

  it(`rejects more than ${MAX_MESSAGES} messages`, () => {
    const messages = Array.from({ length: MAX_MESSAGES + 1 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: "x",
    }));
    // Last message must be user for the count rule to be the one that fires.
    messages[MAX_MESSAGES] = { role: "user", content: "x" };
    const result = validateChatRequest(validBody({ messages }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.status).toBe(400);
    expect(result.error.code).toBe("VALIDATION_ERROR");
  });

  it(`rejects a message longer than ${MAX_CONTENT_CHARS} chars`, () => {
    const long = "a".repeat(MAX_CONTENT_CHARS + 1);
    const result = validateChatRequest(
      validBody({ messages: [{ role: "user", content: long }] }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.status).toBe(400);
    expect(result.error.code).toBe("VALIDATION_ERROR");
    // Error messages never echo user content.
    expect(result.error.message).not.toContain(long);
  });

  it("rejects an unknown role", () => {
    const result = validateChatRequest(
      validBody({ messages: [{ role: "tool", content: "hi" }] }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.details).toEqual({ field: "messages[0].role" });
  });

  it("rejects a request whose last message is not the user's", () => {
    const result = validateChatRequest(
      validBody({
        messages: [
          { role: "user", content: "hi" },
          { role: "assistant", content: "hello" },
        ],
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.details).toEqual({ field: "messages[1].role" });
  });

  it("rejects a request with no user message at all", () => {
    const result = validateChatRequest(
      validBody({ messages: [{ role: "system", content: "hi" }] }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects a missing modelId", () => {
    const { modelId: _omitted, ...body } = validBody();
    void _omitted;
    const result = validateChatRequest(body);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.details).toEqual({ field: "modelId" });
  });

  it("rejects an unknown top-level field", () => {
    const result = validateChatRequest(validBody({ stream: true }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.details).toEqual({ field: "stream" });
  });

  it("rejects an unknown field inside a message", () => {
    const result = validateChatRequest(
      validBody({
        messages: [{ role: "user", content: "hi", extra: 1 }],
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.details).toEqual({
      field: "messages[0].extra",
    });
  });

  it("rejects malformed types (non-array messages, non-string content)", () => {
    expect(validateChatRequest(validBody({ messages: "nope" })).ok).toBe(
      false,
    );
    expect(
      validateChatRequest(
        validBody({ messages: [{ role: "user", content: 42 }] }),
      ).ok,
    ).toBe(false);
    expect(
      validateChatRequest(validBody({ messages: [null] })).ok,
    ).toBe(false);
  });

  it("rejects a non-object body", () => {
    expect(validateChatRequest(null).ok).toBe(false);
    expect(validateChatRequest([1, 2]).ok).toBe(false);
    expect(validateChatRequest("hello").ok).toBe(false);
  });

  it("rejects whitespace-only content", () => {
    const result = validateChatRequest(
      validBody({ messages: [{ role: "user", content: "   " }] }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.details).toEqual({
      field: "messages[0].content",
    });
  });

  it("rejects an empty or over-long conversationId", () => {
    expect(
      validateChatRequest(validBody({ conversationId: "   " })).ok,
    ).toBe(false);
    expect(
      validateChatRequest(
        validBody({ conversationId: "x".repeat(129) }),
      ).ok,
    ).toBe(false);
    expect(
      validateChatRequest(validBody({ conversationId: null })).ok,
    ).toBe(true);
  });
});
