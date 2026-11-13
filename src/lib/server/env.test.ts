/**
 * Unit tests for the server env config (Phase 2.1 / 2.7).
 *
 * `env.ts` reads `process.env` once, at import time, so each case below
 * re-imports a fresh copy of the module (`vi.resetModules()` + dynamic
 * `import`) after stubbing the environment — that is the only way to
 * test the import-time snapshot honestly. Nothing here touches a real
 * key: the only "key" used is the literal fake string
 * "sk-test-only-fake-value", which is asserted never to leak out of
 * `validateEnv()`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const OPTIONAL_VARS = [
  "OPENAI_API_KEY",
  "GEMINI_API_KEY",
  "ANTHROPIC_API_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

const PUBLIC_VARS = ["NEXT_PUBLIC_APP_NAME", "NEXT_PUBLIC_APP_URL"] as const;

const savedEnv = new Map<string, string | undefined>();

function stubVar(name: string, value: string | undefined) {
  if (!savedEnv.has(name)) {
    savedEnv.set(name, process.env[name]);
  }
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

beforeEach(() => {
  vi.resetModules();
  savedEnv.clear();
  for (const name of [...OPTIONAL_VARS, ...PUBLIC_VARS]) {
    stubVar(name, undefined);
  }
});

afterEach(() => {
  for (const [name, value] of savedEnv) {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }
  savedEnv.clear();
  vi.unstubAllEnvs();
});

async function freshEnv() {
  return import("@/lib/server/env");
}

describe("env with nothing set", () => {
  it("uses safe public defaults and reports no provider configured", async () => {
    const mod = await freshEnv();
    expect(mod.env.appName).toBe("Nexora AI");
    expect(mod.env.appUrl).toBe("http://localhost:3000");
    expect(mod.env.nodeEnv).toBe("test");
    expect(mod.env.providers).toEqual({
      openai: { configured: false },
      gemini: { configured: false },
      anthropic: { configured: false },
    });
    expect(mod.isProviderConfigured("openai")).toBe(false);
    expect(mod.isProviderConfigured("gemini")).toBe(false);
    expect(mod.isProviderConfigured("anthropic")).toBe(false);
    expect(mod.hasAnyProviderConfigured()).toBe(false);
    expect(mod.isSupabaseConfigured()).toBe(false);
  });

  it("has no required vars and lists all six optional vars as missing", async () => {
    const mod = await freshEnv();
    expect(mod.REQUIRED_ENV_VARS).toEqual([]);
    expect([...mod.OPTIONAL_ENV_VARS].sort()).toEqual([...OPTIONAL_VARS].sort());
    expect(mod.validateEnv()).toEqual({
      ok: true,
      missingRequired: [],
      missingOptional: [...OPTIONAL_VARS],
    });
  });
});

describe("env with vars set", () => {
  it("detects a configured provider and Supabase — without ever returning a secret value", async () => {
    stubVar("OPENAI_API_KEY", "sk-test-only-fake-value");
    stubVar("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    stubVar("NEXT_PUBLIC_SUPABASE_ANON_KEY", "fake-anon-key-for-tests-only");
    const mod = await freshEnv();

    expect(mod.env.providers.openai.configured).toBe(true);
    expect(mod.env.providers.gemini.configured).toBe(false);
    expect(mod.hasAnyProviderConfigured()).toBe(true);
    expect(mod.isSupabaseConfigured()).toBe(true);

    const validation = mod.validateEnv();
    expect(validation.ok).toBe(true);
    expect(validation.missingOptional).toEqual([
      "GEMINI_API_KEY",
      "ANTHROPIC_API_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
    ]);
    // Names only — the fake key value must never appear in the report.
    expect(JSON.stringify(validation)).not.toContain("sk-test-only-fake-value");
    expect(JSON.stringify(validation)).not.toContain("fake-anon-key");
  });

  it("Supabase needs BOTH the URL and the anon key", async () => {
    stubVar("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    const mod = await freshEnv();
    expect(mod.isSupabaseConfigured()).toBe(false);
    expect(mod.validateEnv().missingOptional).toContain(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  });
});
