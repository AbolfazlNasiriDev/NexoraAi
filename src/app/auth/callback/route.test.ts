/**
 * Tests for GET /auth/callback (Phase 3.1).
 *
 * The Supabase server module is mocked — no real Supabase, no network.
 * Pins the open-redirect guard (only relative in-app paths) and the
 * safe-error behaviour (allowlisted `error` query values only, never
 * raw Supabase error text in the URL).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import { GET } from "@/app/auth/callback/route";

const mockedCreateClient = vi.mocked(createClient);

function callbackRequest(url: string): NextRequest {
  return new NextRequest(url);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /auth/callback", () => {
  it("exchanges a valid code and redirects to the validated next path", async () => {
    const exchange = vi.fn().mockResolvedValue({ error: null });
    mockedCreateClient.mockResolvedValue({
      auth: { exchangeCodeForSession: exchange },
    } as never);
    const res = await GET(
      callbackRequest(
        "http://x/auth/callback?code=abc123&next=/auth/reset-password",
      ),
    );
    expect(exchange).toHaveBeenCalledWith("abc123");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "http://x/auth/reset-password",
    );
  });

  it("rejects an open redirect and falls back to /", async () => {
    const exchange = vi.fn().mockResolvedValue({ error: null });
    mockedCreateClient.mockResolvedValue({
      auth: { exchangeCodeForSession: exchange },
    } as never);
    const res = await GET(
      callbackRequest(
        "http://x/auth/callback?code=abc123&next=https://evil.com",
      ),
    );
    expect(res.headers.get("location")).toBe("http://x/");
  });

  it("missing code redirects to sign-in with a safe error value", async () => {
    const res = await GET(
      callbackRequest("http://x/auth/callback?next=/auth/reset-password"),
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "http://x/auth/sign-in?error=callback",
    );
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  it("unconfigured Supabase redirects to sign-in with not_configured", async () => {
    mockedCreateClient.mockResolvedValue(null);
    const res = await GET(
      callbackRequest("http://x/auth/callback?code=abc123"),
    );
    expect(res.headers.get("location")).toBe(
      "http://x/auth/sign-in?error=not_configured",
    );
  });

  it("a failed exchange redirects to sign-in without leaking the error", async () => {
    const exchange = vi
      .fn()
      .mockResolvedValue({ error: new Error("code verifier mismatch") });
    mockedCreateClient.mockResolvedValue({
      auth: { exchangeCodeForSession: exchange },
    } as never);
    const res = await GET(
      callbackRequest("http://x/auth/callback?code=bad"),
    );
    const location = res.headers.get("location") ?? "";
    expect(location).toBe("http://x/auth/sign-in?error=callback");
    expect(location).not.toContain("verifier");
    expect(location).not.toContain("bad");
  });
});
