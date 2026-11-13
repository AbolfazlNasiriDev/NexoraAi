/**
 * Unit test for `.gitignore` env coverage (Phase 2.10).
 *
 * Reads the real `.gitignore` from the repo root and asserts the six
 * env files are protected while `.env.example` stays committable.
 * The matcher is a minimal gitignore glob (`*` matches any run of
 * characters except `/`); a third test proves the matcher is not
 * vacuous by asserting `.env.local` IS ignored.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REQUIRED_PATTERNS = [
  ".env",
  ".env.local",
  ".env.development",
  ".env.production",
  ".env.test",
  ".env.*.local",
] as const;

function patternToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, "[^/]*");
  return new RegExp(`^${escaped}$`);
}

function ignoreLines(): string[] {
  const text = readFileSync(resolve(process.cwd(), ".gitignore"), "utf8");
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"));
}

describe(".gitignore env coverage", () => {
  it("protects all six env files", () => {
    const lines = ignoreLines();
    for (const pattern of REQUIRED_PATTERNS) {
      expect(lines).toContain(pattern);
    }
  });

  it("does not ignore .env.example (no blanket rule)", () => {
    const lines = ignoreLines();
    for (const line of lines) {
      expect(patternToRegExp(line).test(".env.example")).toBe(false);
    }
  });

  it("the matcher is not vacuous: .env.local IS ignored", () => {
    const lines = ignoreLines();
    expect(
      lines.some((line) => patternToRegExp(line).test(".env.local")),
    ).toBe(true);
  });
});
