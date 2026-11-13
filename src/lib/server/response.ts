import "server-only";

import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/server/errors";
import type { ApiEnvelope } from "@/types/api";

/**
 * Response formatting (Phase 2.1).
 *
 * Every API route answers with the same envelope:
 *   success -> `{ success: true, data }`
 *   failure -> `{ success: false, error: { code, message, details? } }`
 */

type RouteHandler = (
  req: Request,
) => Promise<NextResponse> | NextResponse;

/** Build a success response in the standard envelope. */
export function ok<T>(data: T, status = 200): NextResponse {
  const body: ApiEnvelope<T> = { success: true, data };
  return NextResponse.json(body, { status });
}

/** Build a failure response from any thrown value (see errors.ts). */
export function fail(error: unknown): NextResponse {
  return toErrorResponse(error);
}

/**
 * Wrap a route handler so any thrown error is converted into a standard
 * error response instead of crashing the request. Use in every route:
 *
 *   export const GET = withErrorHandling(async () => ok({ ... }));
 */
export function withErrorHandling(handler: RouteHandler): RouteHandler {
  return async (req: Request) => {
    try {
      return await handler(req);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}
