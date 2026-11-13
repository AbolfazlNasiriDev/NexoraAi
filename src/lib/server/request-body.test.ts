/**
 * Unit tests for size-capped request body reading (Phase 2.10).
 *
 * Pins the 1 MB cap: small bodies read unchanged, oversize bodies
 * fail with 413 `PAYLOAD_TOO_LARGE` — including streamed bodies with
 * no (or a lying) `Content-Length`, where the stream cap must catch
 * the overage and stop reading early instead of draining the stream.
 */
import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/server/errors";
import {
  MAX_REQUEST_BODY_BYTES,
  readLimitedBodyText,
} from "@/lib/server/request-body";

describe("readLimitedBodyText", () => {
  it("reads a small body unchanged", async () => {
    const req = new Request("http://x/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"a":1}',
    });
    await expect(readLimitedBodyText(req)).resolves.toBe('{"a":1}');
  });

  it("reads an empty body as an empty string", async () => {
    const req = new Request("http://x/", { method: "POST" });
    await expect(readLimitedBodyText(req)).resolves.toBe("");
  });

  it("accepts a body of exactly 1 MB", async () => {
    const req = new Request("http://x/", {
      method: "POST",
      body: "x".repeat(MAX_REQUEST_BODY_BYTES),
    });
    const text = await readLimitedBodyText(req);
    expect(text).toHaveLength(MAX_REQUEST_BODY_BYTES);
  });

  it("short-circuits on a Content-Length above the limit without reading", async () => {
    // Shaped like a Request (headers + null body): the helper only
    // touches `headers` and `body`, and no bytes are ever read here.
    const req = {
      headers: new Headers({
        "Content-Length": String(MAX_REQUEST_BODY_BYTES + 1),
      }),
      body: null,
    } as unknown as Request;
    let caught: unknown;
    try {
      await readLimitedBodyText(req);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect(caught).toMatchObject({
      status: 413,
      code: "PAYLOAD_TOO_LARGE",
      message: "Request body is too large.",
    });
  });

  it("caps a streamed body without Content-Length and stops reading early", async () => {
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
    const req = new Request("http://x/", {
      method: "POST",
      body: stream,
      duplex: "half",
    } as RequestInit);

    let caught: unknown;
    try {
      await readLimitedBodyText(req);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect(caught).toMatchObject({
      status: 413,
      code: "PAYLOAD_TOO_LARGE",
    });
    // 1 MB is exactly 16 chunks of 64 KB; the 17th chunk crosses the
    // limit. The stream must NOT have been drained (40 chunks offered).
    expect(pulled).toBeLessThanOrEqual(18);
    expect(pulled).toBeLessThan(TOTAL_CHUNKS);
  });

  it("a lying Content-Length below the real size is still caught by the stream cap", async () => {
    const CHUNK_BYTES = 64 * 1024;
    const TOTAL_CHUNKS = 40; // ~2.5 MB actually streamed
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
    // Declared length lies (claims 10 bytes); the stream cap must
    // still fire. Shaped like a Request: the helper only touches
    // `headers` and `body`.
    const req = {
      headers: new Headers({ "Content-Length": "10" }),
      body: stream,
    } as unknown as Request;

    let caught: unknown;
    try {
      await readLimitedBodyText(req);
    } catch (error) {
      caught = error;
    }
    expect(caught).toMatchObject({
      status: 413,
      code: "PAYLOAD_TOO_LARGE",
    });
    expect(pulled).toBeLessThan(TOTAL_CHUNKS);
  });
});
