/**
 * Tests for the auth validation module (Phase 3.1).
 *
 * Pure functions only — no Supabase, no network, no DOM. These rules
 * are shared by the client forms and the server-side callback route,
 * so the same cases are enforced on both sides.
 */
import { describe, expect, it } from "vitest";

import {
  MIN_PASSWORD_LENGTH,
  validateEmail,
  validateNextPath,
  validatePassword,
  validatePasswordMatch,
  validateSignInForm,
  validateSignUpForm,
} from "@/lib/validation/auth.schema";

describe("validateEmail", () => {
  it("accepts a normal email address", () => {
    expect(validateEmail("user@example.com")).toBeNull();
    expect(validateEmail("  user@example.com  ")).toBeNull();
  });

  it("rejects empty and malformed addresses", () => {
    expect(validateEmail("")).toBe("Email is required.");
    expect(validateEmail("   ")).toBe("Email is required.");
    expect(validateEmail("not-an-email")).toBe("Enter a valid email address.");
    expect(validateEmail("user@")).toBe("Enter a valid email address.");
    expect(validateEmail("user@example")).toBe("Enter a valid email address.");
    expect(validateEmail("user @example.com")).toBe(
      "Enter a valid email address.",
    );
  });
});

describe("validatePassword", () => {
  it("requires at least 8 characters", () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8);
    expect(validatePassword("")).toBe("Password is required.");
    expect(validatePassword("short1")).toBe(
      "Password must be at least 8 characters.",
    );
    expect(validatePassword("1234567")).toBe(
      "Password must be at least 8 characters.",
    );
    expect(validatePassword("12345678")).toBeNull();
  });
});

describe("validatePasswordMatch", () => {
  it("requires a confirmation and an exact match", () => {
    expect(validatePasswordMatch("secret123", "")).toBe(
      "Please confirm your password.",
    );
    expect(validatePasswordMatch("secret123", "secret124")).toBe(
      "Passwords do not match.",
    );
    expect(validatePasswordMatch("secret123", "secret123")).toBeNull();
  });
});

describe("validateSignInForm / validateSignUpForm", () => {
  it("accepts a valid sign-in", () => {
    expect(
      validateSignInForm({ email: "a@b.co", password: "secret123" }),
    ).toEqual({ ok: true, errors: {} });
  });

  it("collects both field errors on sign-in", () => {
    const result = validateSignInForm({ email: "bad", password: "short" });
    expect(result.ok).toBe(false);
    expect(result.errors.email).toBe("Enter a valid email address.");
    expect(result.errors.password).toBe(
      "Password must be at least 8 characters.",
    );
  });

  it("validates the confirmation on sign-up", () => {
    const result = validateSignUpForm({
      email: "a@b.co",
      password: "secret123",
      confirmPassword: "different",
    });
    expect(result.ok).toBe(false);
    expect(result.errors.confirmPassword).toBe("Passwords do not match.");
    expect(
      validateSignUpForm({
        email: "a@b.co",
        password: "secret123",
        confirmPassword: "secret123",
      }).ok,
    ).toBe(true);
  });
});

describe("validateNextPath (open-redirect guard)", () => {
  it("allows relative paths inside the app", () => {
    expect(validateNextPath("/")).toBe("/");
    expect(validateNextPath("/auth/reset-password")).toBe(
      "/auth/reset-password",
    );
    expect(validateNextPath("/auth/sign-in?reset=success")).toBe(
      "/auth/sign-in?reset=success",
    );
  });

  it("falls back to / for missing, absolute and protocol-relative input", () => {
    expect(validateNextPath(null)).toBe("/");
    expect(validateNextPath(undefined)).toBe("/");
    expect(validateNextPath("")).toBe("/");
    expect(validateNextPath("https://evil.com")).toBe("/");
    expect(validateNextPath("http://evil.com/auth")).toBe("/");
    expect(validateNextPath("//evil.com")).toBe("/");
    expect(validateNextPath("//evil.com/auth")).toBe("/");
    expect(validateNextPath("javascript:alert(1)")).toBe("/");
    expect(validateNextPath("/\\evil.com")).toBe("/");
    expect(validateNextPath("/foo\\bar")).toBe("/");
  });
});
