/**
 * Tests for POST /auth/sign-out (Phase 3.1).
 *
 * The Supabase server module is mocked — no real Supabase, no network.
 * Pins that sign-out goes through the server client (the one real
 * path) and that an unconfigured Supabase is a harmless no-op success.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import { POST } from "@/app/auth/sign-out/route";

const mockedCreateClient = vi.mocked(createClient);

function signOutRequest(): Request {
  return new Request("http://x/auth/sign-out", { method: "POST" });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /auth/sign-out", () => {
  it("signs out through the server client and returns ok", async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null });
    mockedCreateClient.mockResolvedValue({
      auth: { signOut },
    } as never);
    const res = await POST(signOutRequest());
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      success: true,
      data: { signedOut: true },
    });
  });

  it("unconfigured Supabase is a no-op success (no session to clear)", async () => {
    mockedCreateClient.mockResolvedValue(null);
    const res = await POST(signOutRequest());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      success: true,
      data: { signedOut: true },
    });
  });

  it("a sign-out failure becomes a generic 500, never a leaked error", async () => {
    const signOut = vi
      .fn()
      .mockResolvedValue({ error: new Error("session token leaked") });
    mockedCreateClient.mockResolvedValue({
      auth: { signOut },
    } as never);
    const res = await POST(signOutRequest());
    expect(res.status).toBe(500);
    const body = (await res.json()) as {
      error: { code: string; message: string };
    };
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(body.error.message).not.toContain("leaked");
  });
});
