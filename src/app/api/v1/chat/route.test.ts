/**
 * Route-level tests for POST /api/v1/chat body handling (Phase 2.10).
 *
 * Pins the 1 MB cap at the route: a small valid request passes the
 * size check (then 503, as today — no provider is configured), a body
 * over 1 MB gets 413 `PAYLOAD_TOO_LARGE` in the standard envelope, and
 * malformed JSON under the limit still gets the standard 400.
 */
import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/v1/chat/route";

function chatRequest(body: string | ReadableStream<Uint8Array>): Request {
  return new Request("http://x/api/v1/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body as BodyInit,
    ...(typeof body !== "string" ? { duplex: "half" } : {}),
  } as RequestInit);
}

const smallValidBody = JSON.stringify({
  modelId: "gpt-4o",
  messages: [{ role: "user", content: "hello" }],
});

describe("POST /api/v1/chat body limit", () => {
  it("accepts a small valid request (passes the size check, then 503)", async () => {
    const res = await POST(chatRequest(smallValidBody));
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({
      success: false,
      error: {
        code: "PROVIDER_NOT_CONFIGURED",
        message: "AI provider is not configured yet.",
      },
    });
  });

  it("rejects a body over 1 MB with 413 PAYLOAD_TOO_LARGE in the standard envelope", async () => {
    const bigBody = JSON.stringify({
      modelId: "gpt-4o",
      messages: [{ role: "user", content: "x".repeat(1_048_577) }],
    });
    expect(bigBody.length).toBeGreaterThan(1_048_576);
    const res = await POST(chatRequest(bigBody));
    expect(res.status).toBe(413);
    await expect(res.json()).resolves.toEqual({
      success: false,
      error: {
        code: "PAYLOAD_TOO_LARGE",
        message: "Request body is too large.",
      },
    });
  });

  it("rejects a >1 MB streamed body without Content-Length with 413", async () => {
    const CHUNK_BYTES = 64 * 1024;
    const TOTAL_CHUNKS = 40; // ~2.5 MB offered in total
    let pulled = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (pulled >= TOTAL_CHUNKS) {
          controller.close();
          return;
        }
        pulled += 1;
        controller.enqueue(new Uint8Array(CHUNK_BYTES));
      },
    });
    const res = await POST(chatRequest(stream));
    expect(res.status).toBe(413);
    await expect(res.json()).resolves.toEqual({
      success: false,
      error: {
        code: "PAYLOAD_TOO_LARGE",
        message: "Request body is too large.",
      },
    });
    expect(pulled).toBeLessThan(TOTAL_CHUNKS);
  });

  it("malformed JSON under the limit still returns 400", async () => {
    const res = await POST(chatRequest("{not json"));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Request body must be valid JSON.",
        details: { field: "body" },
      },
    });
  });
});
