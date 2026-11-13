import "server-only";

import { NextResponse } from "next/server";
import type { ApiErrorBody, ApiErrorCode } from "@/types/api";

/**
 * Centralized error handling (Phase 2.1).
 *
 * Route handlers throw `ApiError` for expected failures; anything else is
 * treated as an internal error and mapped to a safe, generic 500 response
 * that never leaks stack traces, env values, or provider internals.
 */

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    status: number,
    code: ApiErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** 400 — request failed validation (shape, size, role, ...). */
export function validationError(
  message: string,
  details?: Record<string, unknown>,
): ApiError {
  return new ApiError(400, "VALIDATION_ERROR", message, details);
}

/** 401 — authentication is required (Phase 3.1). */
export function unauthorizedError(
  message = "Authentication is required.",
): ApiError {
  return new ApiError(401, "UNAUTHORIZED", message);
}

/** 404 — the requested resource or route does not exist. */
export function notFoundError(message = "Resource not found"): ApiError {
  return new ApiError(404, "NOT_FOUND", message);
}

/**
 * 503 — no AI provider is configured yet. This is the honest answer for
 * every AI endpoint until a real API key is connected (Phase 2.2+).
 * Never substitute a fabricated reply.
 */
export function providerNotConfiguredError(
  message = "AI provider is not configured yet.",
): ApiError {
  return new ApiError(503, "PROVIDER_NOT_CONFIGURED", message);
}

/** 429 — too many requests. */
export function rateLimitedError(
  message = "Too many requests. Please try again later.",
): ApiError {
  return new ApiError(429, "RATE_LIMITED", message);
}

/** 413 — request body exceeds the allowed size (Phase 2.10). */
export function payloadTooLargeError(
  message = "Request body is too large.",
): ApiError {
  return new ApiError(413, "PAYLOAD_TOO_LARGE", message);
}

/** 500 — unexpected failure. The public message stays generic on purpose. */
export function internalError(): ApiError {
  return new ApiError(
    500,
    "INTERNAL_ERROR",
    "An unexpected error occurred. Please try again later.",
  );
}

/**
 * Convert any thrown value into a safe JSON error response in the standard
 * envelope shape. Unknown errors are logged server-side with safe
 * metadata only (see below) and mapped to a generic 500.
 */
export function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    // Log safe metadata only: code + status. Never the message — an
    // ApiError message can echo user input (e.g. an unknown modelId).
    console.error(
      "[nexora-api] ApiError:",
      error.code,
      error.status,
    );
    const body: ApiErrorBody = {
      code: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    };
    return NextResponse.json(
      { success: false, error: body },
      { status: error.status },
    );
  }

  // Unknown error: log ONLY the error's constructor name for the server
  // operator. Never the message, stack, request body, headers, or any
  // user content — those can embed secrets (e.g. SDK config) once
  // real provider SDKs exist. The client still gets the generic 500.
  const errorName =
    error !== null && typeof error === "object"
      ? (error as { constructor?: { name?: unknown } }).constructor?.name
      : typeof error;
  console.error(
    "[nexora-api] Unhandled error:",
    typeof errorName === "string" && errorName !== "" ? errorName : "unknown",
  );
  const fallback = internalError();
  return NextResponse.json(
    {
      success: false,
      error: { code: fallback.code, message: fallback.message },
    },
    { status: fallback.status },
  );
}

/**
 * Wrap a route handler so thrown errors become standard error responses
 * instead of unhandled exceptions.
 */
export function handleRouteError(error: unknown): NextResponse {
  return toErrorResponse(error);
}
