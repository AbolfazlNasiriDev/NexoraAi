/**
 * Unit tests for the AI gateway (Phase 2.2).
 *
 * Pins the "never a fake reply" contract: an unknown model is a 400,
 * a known-but-unconfigured model is a 503, and the streaming path
 * fails eagerly — before any chunk is produced.
 */
import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/server/errors";
import { aiGateway } from "@/lib/ai/gateway";

const userTurn = [{ role: "user" as const, content: "Hello." }];

describe("aiGateway.chat", () => {
  it("rejects an unknown model with 400 VALIDATION_ERROR", async () => {
    await expect(
      aiGateway.chat({ modelId: "not-a-model", messages: userTurn }),
    ).rejects.toMatchObject({
      status: 400,
      code: "VALIDATION_ERROR",
    });
  });

  it("rejects a missing modelId with 400", async () => {
    await expect(
      aiGateway.chat({ modelId: "   ", messages: userTurn }),
    ).rejects.toMatchObject({ status: 400, code: "VALIDATION_ERROR" });
    await expect(
      aiGateway.chat({ modelId: "", messages: userTurn }),
    ).rejects.toMatchObject({ status: 400, code: "VALIDATION_ERROR" });
  });

  it("rejects an empty message list with 400", async () => {
    await expect(
      aiGateway.chat({ modelId: "gpt-4o", messages: [] }),
    ).rejects.toMatchObject({ status: 400, code: "VALIDATION_ERROR" });
  });

  it("throws 503 PROVIDER_NOT_CONFIGURED for a known model — never a reply", async () => {
    let caught: unknown;
    try {
      await aiGateway.chat({ modelId: "gpt-4o", messages: userTurn });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect(caught).toMatchObject({
      status: 503,
      code: "PROVIDER_NOT_CONFIGURED",
      message: "AI provider is not configured yet.",
    });
  });
});

describe("aiGateway.chatStream", () => {
  it("fails eagerly with 503 before producing any chunk", () => {
    // The provider's chatStream() is a regular method (not a generator),
    // so requireConfigured() runs synchronously at call time — the 503
    // is thrown before any generator exists, let alone any chunk.
    let caught: unknown;
    try {
      aiGateway.chatStream({
        modelId: "gemini-2.0-flash",
        messages: userTurn,
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect(caught).toMatchObject({
      status: 503,
      code: "PROVIDER_NOT_CONFIGURED",
      message: "AI provider is not configured yet.",
    });
  });
});
