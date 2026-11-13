import "server-only";

import { payloadTooLargeError } from "@/lib/server/errors";

/**
 * Size-capped request body reading (Phase 2.10).
 *
 * `POST /api/v1/chat` must never parse an unbounded body: validation
 * caps the *parsed* content, but without a cap here a huge JSON body
 * would be fully read into memory first. This helper enforces the cap
 * while streaming, so an oversize body is rejected as soon as the
 * limit is crossed — the rest of the stream is never consumed.
 */

/** Maximum request body size: 1 MB (1_048_576 bytes). */
export const MAX_REQUEST_BODY_BYTES = 1_048_576;

/**
 * Read a request body as text, enforcing `maxBytes`.
 *
 * - A `Content-Length` above the limit short-circuits to 413
 *   immediately (the body is never read).
 * - Otherwise the stream is read chunk by chunk; the moment the
 *   accumulated bytes exceed the limit, reading stops (the reader is
 *   cancelled) and a 413 `payloadTooLargeError` is thrown — a missing
 *   or lying `Content-Length` is still caught by this cap.
 * - An empty body reads as `""` (callers treat that as invalid JSON).
 * - Stream errors are re-thrown unchanged for the caller to map
 *   (the chat route maps them to the standard 400).
 */
export async function readLimitedBodyText(
  req: Request,
  maxBytes: number = MAX_REQUEST_BODY_BYTES,
): Promise<string> {
  const declared = req.headers.get("content-length");
  if (declared !== null) {
    const declaredBytes = Number(declared);
    if (Number.isFinite(declaredBytes) && declaredBytes > maxBytes) {
      throw payloadTooLargeError();
    }
  }

  const stream = req.body;
  if (stream === null) return "";

  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        // Stop consuming the stream: cancel instead of draining it.
        await reader.cancel();
        throw payloadTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    // The reader is still locked after cancel(); release it either way.
    try {
      reader.releaseLock();
    } catch {
      // Already released — nothing to do.
    }
  }

  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(combined);
}
