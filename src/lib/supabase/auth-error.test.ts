/**
 * Tests for the Supabase Auth error mapping (Phase 3.1).
 *
 * Pure function — no Supabase, no network. Pins that known Supabase
 * messages become friendly text and that unknown/raw messages are
 * never surfaced to the user.
 */
import { describe, expect, it } from "vitest";

import { mapAuthError } from "@/lib/supabase/auth-error";

describe("mapAuthError", () => {
  it("maps wrong credentials", () => {
    expect(mapAuthError(new Error("Invalid login credentials"))).toBe(
      "Incorrect email or password.",
    );
    expect(mapAuthError({ message: "Invalid login credentials" })).toBe(
      "Incorrect email or password.",
    );
  });

  it("maps unconfirmed email", () => {
    expect(mapAuthError(new Error("Email not confirmed"))).toBe(
      "Please confirm your email before signing in. Check your inbox for the confirmation link.",
    );
  });

  it("maps an already-registered email", () => {
    expect(mapAuthError(new Error("User already registered"))).toBe(
      "An account with this email already exists. Try signing in instead.",
    );
  });

  it("maps rate limits", () => {
    expect(mapAuthError(new Error("over_email_send_rate_limit"))).toBe(
      "Too many attempts. Please try again later.",
    );
    expect(mapAuthError(new Error("Too many requests"))).toBe(
      "Too many attempts. Please try again later.",
    );
  });

  it("maps short passwords and invalid emails", () => {
    expect(
      mapAuthError(new Error("Password should be at least 6 characters")),
    ).toBe("Password must be at least 8 characters.");
    expect(mapAuthError(new Error("Invalid email"))).toBe(
      "Enter a valid email address.",
    );
  });

  it("maps expired/invalid links", () => {
    expect(mapAuthError(new Error("Auth code has expired"))).toBe(
      "This link has expired or is invalid. Request a new one.",
    );
    expect(mapAuthError(new Error("Invalid token"))).toBe(
      "This link has expired or is invalid. Request a new one.",
    );
  });

  it("never surfaces unknown or raw messages", () => {
    expect(mapAuthError(new Error("something internal broke"))).toBe(
      "Something went wrong. Please try again.",
    );
    expect(mapAuthError(undefined)).toBe(
      "Something went wrong. Please try again.",
    );
    expect(mapAuthError(null)).toBe("Something went wrong. Please try again.");
    expect(mapAuthError("plain string")).toBe(
      "Something went wrong. Please try again.",
    );
  });
});
