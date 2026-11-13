/**
 * Auth-branch tests for POST /api/v1/chat (Phase 3.1).
 *
 * The Supabase server module is mocked — no real Supabase, no network,
 * no keys. The real gateway still runs behind the gate: a configured
 * + authenticated request reaches it and gets today's honest 503.
 *
 * Branches:
 *   (a) Supabase NOT configured -> today's exact behaviour (valid
 *       request -> 503, validation errors unchanged).
 *   (b) Configured + anonymous -> 401 UNAUTHORIZED, before the body
 *       is even validated.
 *   (c) Configured + authenticated -> existing behaviour (503).
 * A `user_id` forged in the request body is never trusted: with an
 * anonymous caller it is a 401 (auth runs first), with an authenticated
 * caller it is a 400 (strict validation rejects the unknown field) —
 * it can never become an identity.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { User } from "@supabase/supabase-js";

vi.mock("@/lib/supabase/server", () => ({
  getAuthenticatedUser: vi.fn(),
  isSupabaseConfiguredServer: vi.fn(),
}));

import {
  getAuthenticatedUser,
  isSupabaseConfiguredServer,
} from "@/lib/supabase/server";
import { POST } from "@/app/api/v1/chat/route";

const mockedIsConfigured = vi.mocked(isSupabaseConfiguredServer);
const mockedGetUser = vi.mocked(getAuthenticatedUser);

const authedUser = { id: "user-123", email: "user@example.com" } as User;

function chatRequest(body: string): Request {
  return new Request("http://x/api/v1/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

const smallValidBody = JSON.stringify({
  modelId: "gpt-4o",
  messages: [{ role: "user", content: "hello" }],
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/v1/chat auth gate", () => {
  it("(a) unconfigured: valid request still returns 503 as before", async () => {
    mockedIsConfigured.mockReturnValue(false);
    const res = await POST(chatRequest(smallValidBody));
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({
      success: false,
      error: {
        code: "PROVIDER_NOT_CONFIGURED",
        message: "AI provider is not configured yet.",
      },
    });
    // The auth helper is never even consulted when unconfigured.
    expect(mockedGetUser).not.toHaveBeenCalled();
  });

  it("(b) configured + anonymous: 401 UNAUTHORIZED in the standard envelope", async () => {
    mockedIsConfigured.mockReturnValue(true);
    mockedGetUser.mockResolvedValue({ user: null });
    const res = await POST(chatRequest(smallValidBody));
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication is required.",
      },
    });
  });

  it("(b) configured + anonymous: 401 fires before validation", async () => {
    mockedIsConfigured.mockReturnValue(true);
    mockedGetUser.mockResolvedValue({ user: null });
    // Malformed JSON would be a 400 — auth runs first, so it is a 401.
    const res = await POST(chatRequest("{not json"));
    expect(res.status).toBe(401);
  });

  it("(c) configured + authenticated: existing behaviour (503)", async () => {
    mockedIsConfigured.mockReturnValue(true);
    mockedGetUser.mockResolvedValue({ user: authedUser });
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

  it("a forged body user_id never becomes an identity", async () => {
    const forgedBody = JSON.stringify({
      modelId: "gpt-4o",
      messages: [{ role: "user", content: "hello" }],
      user_id: "victim-user-id",
    });

    // Anonymous: 401 — the forged value is ignored, auth decides.
    mockedIsConfigured.mockReturnValue(true);
    mockedGetUser.mockResolvedValue({ user: null });
    const anonRes = await POST(chatRequest(forgedBody));
    expect(anonRes.status).toBe(401);

    // Authenticated: 400 — the strict validator rejects the unknown
    // field instead of trusting it as an identity.
    mockedGetUser.mockResolvedValue({ user: authedUser });
    const authedRes = await POST(chatRequest(forgedBody));
    expect(authedRes.status).toBe(400);
    const body = (await authedRes.json()) as {
      error: { code: string };
    };
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
