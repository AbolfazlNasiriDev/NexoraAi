/**
 * Tests for the route-protection decision table (Phase 3.1).
 *
 * Pure functions only — the middleware calls these with the live auth
 * state, so this matrix is the whole protection contract, testable
 * without the Next.js runtime.
 */
import { describe, expect, it } from "vitest";

import {
  getAuthRedirect,
  isAuthPage,
  isAuthPassthroughPath,
  isProtectedPath,
} from "@/lib/supabase/route-guards";

describe("isProtectedPath", () => {
  it("protects the workspace home and future /app/* paths", () => {
    expect(isProtectedPath("/")).toBe(true);
    expect(isProtectedPath("/app/settings")).toBe(true);
    expect(isProtectedPath("/app")).toBe(true);
  });

  it("does not protect auth pages or anything else", () => {
    expect(isProtectedPath("/auth/sign-in")).toBe(false);
    expect(isProtectedPath("/auth/sign-up")).toBe(false);
    expect(isProtectedPath("/auth/callback")).toBe(false);
    expect(isProtectedPath("/unknown")).toBe(false);
  });
});

describe("isAuthPassthroughPath", () => {
  it("lets callback / forgot / reset through so they cannot loop", () => {
    expect(isAuthPassthroughPath("/auth/callback")).toBe(true);
    expect(isAuthPassthroughPath("/auth/forgot-password")).toBe(true);
    expect(isAuthPassthroughPath("/auth/reset-password")).toBe(true);
  });

  it("does not pass through sign-in / sign-up", () => {
    expect(isAuthPassthroughPath("/auth/sign-in")).toBe(false);
    expect(isAuthPassthroughPath("/auth/sign-up")).toBe(false);
    expect(isAuthPage("/auth/sign-in")).toBe(true);
    expect(isAuthPage("/auth/sign-up")).toBe(true);
  });
});

describe("getAuthRedirect", () => {
  it("passes everything through when Supabase is not configured", () => {
    expect(getAuthRedirect("/", false, false)).toBeNull();
    expect(getAuthRedirect("/", true, false)).toBeNull();
    expect(getAuthRedirect("/auth/sign-in", true, false)).toBeNull();
    expect(getAuthRedirect("/auth/sign-in", false, false)).toBeNull();
  });

  it("sends guests on protected routes to /auth/sign-in", () => {
    expect(getAuthRedirect("/", false, true)).toBe("/auth/sign-in");
    expect(getAuthRedirect("/app/settings", false, true)).toBe("/auth/sign-in");
  });

  it("sends signed-in users off the sign-in / sign-up pages to /", () => {
    expect(getAuthRedirect("/auth/sign-in", true, true)).toBe("/");
    expect(getAuthRedirect("/auth/sign-up", true, true)).toBe("/");
  });

  it("lets signed-in users use protected routes", () => {
    expect(getAuthRedirect("/", true, true)).toBeNull();
    expect(getAuthRedirect("/app/settings", true, true)).toBeNull();
  });

  it("never redirects callback / forgot / reset, for either state", () => {
    for (const path of [
      "/auth/callback",
      "/auth/forgot-password",
      "/auth/reset-password",
    ]) {
      expect(getAuthRedirect(path, false, true)).toBeNull();
      expect(getAuthRedirect(path, true, true)).toBeNull();
    }
  });

  it("passes unknown paths through", () => {
    expect(getAuthRedirect("/unknown", false, true)).toBeNull();
    expect(getAuthRedirect("/unknown", true, true)).toBeNull();
  });
});
