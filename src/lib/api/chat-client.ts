/**
 * Chat API client (Phase 2.5) — client-safe, NO "server-only" import.
 *
 * Talks to the real Phase 2.3 / 2.4 endpoints (`POST /api/v1/chat`,
 * `GET /api/v1/models`) and understands the standard envelope from
 * Phase 2.1 (`{ success, data }` / `{ success, error: { code, message } }`).
 * It never invents replies, never hardcodes models, and never touches
 * secrets — API keys live only on the server and are never sent here.
 */

import type { ChatRequest, ChatResponseData } from "@/types/chat";
import type { ModelInfo } from "@/types/ai";
import type { StreamChunk } from "@/lib/ai/types";

/** Typed error thrown for every failed API call. */
export class ApiClientError extends Error {
  /** HTTP status, or 0 when the request never reached the server. */
  readonly status: number;
  /** Machine-readable code from the API error envelope. */
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
  }
}

/** True when the error is the standard 503 provider-not-configured error. */
export function isProviderNotConfiguredError(error: unknown): boolean {
  return (
    error instanceof ApiClientError &&
    error.code === "PROVIDER_NOT_CONFIGURED"
  );
}

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string; details?: unknown };
}

async function parseEnvelope<T>(res: Response): Promise<ApiEnvelope<T>> {
  try {
    return (await res.json()) as ApiEnvelope<T>;
  } catch {
    return {
      success: false,
      error: {
        code: "INVALID_RESPONSE",
        message: "The server returned an unreadable response.",
      },
    };
  }
}

function networkError(): ApiClientError {
  return new ApiClientError(
    0,
    "NETWORK_ERROR",
    "Couldn't reach the Nexora API. Check your connection and try again.",
  );
}

/**
 * Send one chat turn to `POST /api/v1/chat` and return the real
 * `ChatResponseData`. Throws `ApiClientError` on any failure — today a
 * valid request throws 503 `PROVIDER_NOT_CONFIGURED`, because no AI
 * provider is configured yet. Never returns a fabricated reply.
 */
export async function sendChatMessage(
  request: ChatRequest,
): Promise<ChatResponseData> {
  let res: Response;
  try {
    res = await fetch("/api/v1/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
  } catch {
    throw networkError();
  }
  const envelope = await parseEnvelope<ChatResponseData>(res);
  if (!res.ok || !envelope.success || !envelope.data) {
    throw new ApiClientError(
      res.status,
      envelope.error?.code ?? "UNKNOWN_ERROR",
      envelope.error?.message ?? `Chat request failed (HTTP ${res.status}).`,
    );
  }
  return envelope.data;
}

interface ModelsData {
  models: ModelInfo[];
  total: number;
  availableCount: number;
}

/** Load the real model list from `GET /api/v1/models`. */
export async function fetchModels(): Promise<ModelInfo[]> {
  let res: Response;
  try {
    res = await fetch("/api/v1/models");
  } catch {
    throw networkError();
  }
  const envelope = await parseEnvelope<ModelsData>(res);
  if (!res.ok || !envelope.success || !envelope.data) {
    throw new ApiClientError(
      res.status,
      envelope.error?.code ?? "UNKNOWN_ERROR",
      envelope.error?.message ??
        `Couldn't load models (HTTP ${res.status}).`,
    );
  }
  return envelope.data.models;
}

/* ------------------------------------------------------------------ */
/* Streaming preparation (future only — NOT wired to the UI)           */
/* ------------------------------------------------------------------ */

/**
 * Callbacks for a future streaming chat response. Prepared in Phase 2.5
 * only: no streaming endpoint exists yet (Phase 2.3 serves non-streaming
 * `POST /api/v1/chat`), so nothing in the UI calls `parseSseStream` and
 * it must never be fed fabricated chunks — it only forwards events the
 * server actually sends.
 */
export interface ChatStreamCallbacks {
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (error: ApiClientError) => void;
}

/** One event of a future `text/event-stream` chat response. */
export type ChatStreamEvent = StreamChunk;

/**
 * Read a `text/event-stream` Response and invoke the callbacks for each
 * `data:` line (`{"type":"text","delta":"..."}` chunks, a
 * `{"type":"done"}` chunk, or a `{"type":"error",...}` chunk). A bare
 * `[DONE]` line also ends the stream. Unparseable lines are skipped;
 * a broken connection reports `STREAM_ERROR` via `onError`.
 */
export async function parseSseStream(
  response: Response,
  callbacks: ChatStreamCallbacks,
): Promise<void> {
  if (!response.ok || !response.body) {
    callbacks.onError(
      new ApiClientError(
        response.status,
        "STREAM_ERROR",
        `Streaming failed (HTTP ${response.status}).`,
      ),
    );
    return;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finished = false;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (!line.startsWith("data:")) continue;
        const payload = line.slice("data:".length).trim();
        if (payload === "[DONE]") {
          callbacks.onDone();
          finished = true;
          return;
        }
        let event: ChatStreamEvent;
        try {
          event = JSON.parse(payload) as ChatStreamEvent;
        } catch {
          continue;
        }
        if (event.type === "text" && event.delta) {
          callbacks.onDelta(event.delta);
        } else if (event.type === "done") {
          callbacks.onDone();
          finished = true;
          return;
        } else if (event.type === "error") {
          callbacks.onError(
            new ApiClientError(
              0,
              event.error?.code ?? "STREAM_ERROR",
              event.error?.message ?? "The stream ended with an error.",
            ),
          );
          return;
        }
      }
    }
    if (!finished) callbacks.onDone();
  } catch {
    callbacks.onError(
      new ApiClientError(
        0,
        "STREAM_ERROR",
        "The stream was interrupted.",
      ),
    );
  } finally {
    reader.releaseLock();
  }
}
