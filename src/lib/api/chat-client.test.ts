/**
 * Unit tests for the browser API client (Phase 2.5).
 *
 * Client-safe module (no "server-only" import). `fetch` is stubbed —
 * no network, no server. Pins the envelope handling: success data
 * passes through, the 503 provider error surfaces as a typed
 * `ApiClientError`, and the (future-only) SSE parser forwards only
 * events the server actually sends.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ApiClientError,
  fetchModels,
  isProviderNotConfiguredError,
  parseSseStream,
  sendChatMessage,
} from "@/lib/api/chat-client";

const fetchMock = vi.fn();

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sendChatMessage", () => {
  const request = {
    conversationId: null,
    modelId: "gpt-4o",
    messages: [{ role: "user" as const, content: "Hello." }],
  };

  it("returns the real reply data on success", async () => {
    const data = {
      conversationId: null,
      modelId: "gpt-4o",
      provider: "openai",
      message: { role: "assistant", content: "Hi there." },
    };
    fetchMock.mockResolvedValue(jsonResponse(200, { success: true, data }));
    await expect(sendChatMessage(request)).resolves.toEqual(data);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/chat",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("surfaces the 503 provider error as a typed ApiClientError", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(503, {
        success: false,
        error: {
          code: "PROVIDER_NOT_CONFIGURED",
          message: "AI provider is not configured yet.",
        },
      }),
    );
    let caught: unknown;
    try {
      await sendChatMessage(request);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ApiClientError);
    expect(caught).toMatchObject({
      status: 503,
      code: "PROVIDER_NOT_CONFIGURED",
      message: "AI provider is not configured yet.",
    });
    expect(isProviderNotConfiguredError(caught)).toBe(true);
    expect(isProviderNotConfiguredError(new Error("other"))).toBe(false);
  });

  it("maps a failed fetch to NETWORK_ERROR with status 0", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    await expect(sendChatMessage(request)).rejects.toMatchObject({
      status: 0,
      code: "NETWORK_ERROR",
    });
  });

  it("maps an unreadable response to INVALID_RESPONSE", async () => {
    fetchMock.mockResolvedValue(new Response("not json", { status: 200 }));
    await expect(sendChatMessage(request)).rejects.toMatchObject({
      status: 200,
      code: "INVALID_RESPONSE",
    });
  });
});

describe("fetchModels", () => {
  it("returns the model list from the envelope", async () => {
    const models = [{ id: "gpt-4o", status: "not_configured" }];
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        success: true,
        data: { models, total: 1, availableCount: 0 },
      }),
    );
    await expect(fetchModels()).resolves.toEqual(models);
  });

  it("throws a typed error when the request fails", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(500, {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "boom" },
      }),
    );
    await expect(fetchModels()).rejects.toMatchObject({
      status: 500,
      code: "INTERNAL_ERROR",
    });
  });
});

describe("parseSseStream", () => {
  function sseResponse(text: string) {
    return new Response(text, {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    });
  }

  it("forwards text deltas and calls onDone", async () => {
    const deltas: string[] = [];
    let done = false;
    await parseSseStream(
      sseResponse(
        'data: {"type":"text","delta":"Hel"}\n' +
          'data: {"type":"text","delta":"lo"}\n' +
          'data: {"type":"done"}\n',
      ),
      {
        onDelta: (text) => deltas.push(text),
        onDone: () => {
          done = true;
        },
        onError: () => {
          throw new Error("onError must not be called");
        },
      },
    );
    expect(deltas).toEqual(["Hel", "lo"]);
    expect(done).toBe(true);
  });

  it("ends on a bare [DONE] line", async () => {
    let done = false;
    await parseSseStream(sseResponse("data: [DONE]\n"), {
      onDelta: () => {},
      onDone: () => {
        done = true;
      },
      onError: () => {
        throw new Error("onError must not be called");
      },
    });
    expect(done).toBe(true);
  });

  it("forwards an error event to onError", async () => {
    let caught: ApiClientError | undefined;
    await parseSseStream(
      sseResponse(
        'data: {"type":"error","error":{"code":"RATE_LIMITED","message":"slow down"}}\n',
      ),
      {
        onDelta: () => {},
        onDone: () => {
          throw new Error("onDone must not be called");
        },
        onError: (error) => {
          caught = error;
        },
      },
    );
    expect(caught).toMatchObject({
      code: "RATE_LIMITED",
      message: "slow down",
    });
  });

  it("reports a non-OK response as STREAM_ERROR", async () => {
    let caught: ApiClientError | undefined;
    await parseSseStream(new Response("nope", { status: 500 }), {
      onDelta: () => {},
      onDone: () => {},
      onError: (error) => {
        caught = error;
      },
    });
    expect(caught).toMatchObject({ status: 500, code: "STREAM_ERROR" });
  });
});
