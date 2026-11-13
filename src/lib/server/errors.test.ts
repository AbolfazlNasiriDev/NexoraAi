/**
 * Unit tests for the error factories and response envelope (Phase 2.1).
 *
 * Pins the exact status + code + message contract the API routes rely
 * on — including the honest 503 message and the rule that unknown
 * errors never leak their internals to the client.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ApiError,
  internalError,
  notFoundError,
  payloadTooLargeError,
  providerNotConfiguredError,
  rateLimitedError,
  toErrorResponse,
  validationError,
} from "@/lib/server/errors";
import { fail, ok, withErrorHandling } from "@/lib/server/response";

describe("ApiError factories", () => {
  it("providerNotConfiguredError is 503 with the exact honest message", () => {
    const error = providerNotConfiguredError();
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(503);
    expect(error.code).toBe("PROVIDER_NOT_CONFIGURED");
    expect(error.message).toBe("AI provider is not configured yet.");
  });

  it("validationError is 400 and carries field details", () => {
    const error = validationError("modelId is required.", {
      field: "modelId",
    });
    expect(error.status).toBe(400);
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details).toEqual({ field: "modelId" });
  });

  it("payloadTooLargeError is 413 with the standard message", () => {
    const error = payloadTooLargeError();
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(413);
    expect(error.code).toBe("PAYLOAD_TOO_LARGE");
    expect(error.message).toBe("Request body is too large.");
  });

  it("notFoundError is 404, rateLimitedError is 429, internalError is 500", () => {
    expect(notFoundError().status).toBe(404);
    expect(notFoundError().code).toBe("NOT_FOUND");
    expect(rateLimitedError().status).toBe(429);
    expect(rateLimitedError().code).toBe("RATE_LIMITED");
    expect(internalError().status).toBe(500);
    expect(internalError().code).toBe("INTERNAL_ERROR");
    expect(internalError().message).toBe(
      "An unexpected error occurred. Please try again later.",
    );
  });
});

describe("toErrorResponse", () => {
  it("renders an ApiError in the standard failure envelope", async () => {
    const res = toErrorResponse(
      validationError("modelId is required.", { field: "modelId" }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "modelId is required.",
        details: { field: "modelId" },
      },
    });
  });

  it("maps an unknown error to a generic 500 without leaking it", async () => {
    const res = toErrorResponse(new Error("db password is hunter2"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred. Please try again later.",
      },
    });
    expect(JSON.stringify(body)).not.toContain("hunter2");
  });
});

describe("toErrorResponse safe logging (Phase 2.10)", () => {
  const SENSITIVE = "sk-test-secret-123";
  const USER_CONTENT = "alice@example.com";
  let logs: string[];
  let spy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logs = [];
    spy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      logs.push(args.map((arg) => String(arg)).join(" "));
    });
  });

  afterEach(() => {
    spy.mockRestore();
  });

  it("logs only the error code + status for ApiError, never the message", () => {
    const res = toErrorResponse(
      validationError(`Unknown model: ${SENSITIVE}.`, { field: "modelId" }),
    );
    expect(res.status).toBe(400);
    const logged = logs.join("\n");
    expect(logged).not.toContain(SENSITIVE);
    expect(logged).not.toContain("Unknown model");
    expect(logged).toContain("VALIDATION_ERROR");
    expect(logged).toContain("400");
  });

  it("logs only the constructor name for unknown errors — no message, no secret, no user content", async () => {
    const err = new Error(
      `provider failed with key ${SENSITIVE} for user ${USER_CONTENT}`,
    );
    const res = toErrorResponse(err);
    expect(res.status).toBe(500);

    // The client response is the generic 500 — nothing leaks there.
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain(SENSITIVE);
    expect(JSON.stringify(body)).not.toContain(USER_CONTENT);

    // And the server log holds only the constructor name.
    const logged = logs.join("\n");
    expect(logged).not.toContain(SENSITIVE);
    expect(logged).not.toContain(USER_CONTENT);
    expect(logged).not.toContain("provider failed");
    expect(logged).toContain("Error");
  });

  it("keeps the generic client message for unknown errors", async () => {
    const body = await toErrorResponse(new Error("boom")).json();
    expect(body).toEqual({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred. Please try again later.",
      },
    });
  });
});

describe("response helpers", () => {
  it("ok() renders the standard success envelope", async () => {
    const res = ok({ hello: "world" });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      success: true,
      data: { hello: "world" },
    });
  });

  it("fail() converts a thrown ApiError into an error response", async () => {
    const res = fail(providerNotConfiguredError());
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error.code).toBe("PROVIDER_NOT_CONFIGURED");
  });

  it("withErrorHandling passes successes through and converts throws", async () => {
    const good = withErrorHandling(async () => ok({ fine: true }));
    await expect((await good(new Request("http://x/"))).json()).resolves.toEqual({
      success: true,
      data: { fine: true },
    });

    const bad = withErrorHandling(async () => {
      throw validationError("nope.", { field: "body" });
    });
    const res = await bad(new Request("http://x/"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
