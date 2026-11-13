/**
 * Shared API types for the Nexora AI backend (Phase 2.1).
 *
 * Every API route returns the same typed envelope so the frontend can rely
 * on one predictable shape. Domain types for chat and AI models live in
 * later phases (src/types/chat.ts, src/types/ai.ts) — this file only holds
 * the transport-level contracts.
 */

/** Machine-readable error codes returned inside the error envelope. */
export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "PROVIDER_NOT_CONFIGURED"
  | "RATE_LIMITED"
  | "UNAUTHORIZED"
  | "PAYLOAD_TOO_LARGE"
  | "INTERNAL_ERROR";

/** The error object inside a failure envelope. */
export interface ApiErrorBody {
  code: ApiErrorCode;
  message: string;
  /** Optional machine-readable context (never secrets, never stack traces). */
  details?: Record<string, unknown>;
}

/** Success envelope: `{ success: true, data }`. */
export interface ApiSuccessEnvelope<T> {
  success: true;
  data: T;
}

/** Failure envelope: `{ success: false, error }`. */
export interface ApiErrorEnvelope {
  success: false;
  error: ApiErrorBody;
}

/** Union of both envelope shapes. */
export type ApiEnvelope<T> = ApiSuccessEnvelope<T> | ApiErrorEnvelope;

/** Honest status of an AI provider. No provider is ever reported as
 * available unless a real API key is configured (Phase 2.2+). */
export type ProviderStatus = "not_configured" | "configured" | "disabled";
