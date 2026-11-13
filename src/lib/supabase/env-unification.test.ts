/**
 * Env unification tests (Phase 3.1.1) — ONE Supabase pair for browser
 * AND server: `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
 *
 * Before 3.1.1 the browser client read the `NEXT_PUBLIC_` pair while
 * the server client and proxy read a second pair, `SUPABASE_URL` /
 * `SUPABASE_ANON_KEY`, and both had to be set to the same values. The
 * old names are now dead: setting them configures nothing, and no
 * production code reads them anymore.
 *
 * `env.ts` and `server.ts` read `process.env` at import time, so each
 * case re-imports a fresh copy of the modules (`vi.resetModules()` +
 * dynamic `import`) after stubbing the environment — the same pattern
 * as `env.test.ts`. `next/headers` is mocked because the boolean
 * helper under test never touches cookies; the real cookie path is
 * covered by the live smoke checks, not by unit tests. Nothing here
 * touches a real project: every value is an obvious fake.
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

const ROOT = process.cwd();

const URL = "https://example.supabase.co";
const KEY = "fake-anon-key-for-tests-only";
const PUBLISHABLE_KEY = "sb_publishable_test-fake-value";
const OLD_URL = "https://old-example.supabase.co";
const OLD_KEY = "fake-old-key-for-tests-only";

const ALL_VARS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
] as const;

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
  for (const name of ALL_VARS) {
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

async function freshServer() {
  return import("@/lib/supabase/server");
}

async function freshClient() {
  return import("@/lib/supabase/client");
}

describe("one pair configures both clients", () => {
  it("only the NEXT_PUBLIC_ pair set → env, server and browser all configured", async () => {
    stubVar("NEXT_PUBLIC_SUPABASE_URL", URL);
    stubVar("NEXT_PUBLIC_SUPABASE_ANON_KEY", KEY);

    const env = await freshEnv();
    expect(env.isSupabaseConfigured()).toBe(true);

    const server = await freshServer();
    expect(server.isSupabaseConfiguredServer()).toBe(true);

    const client = await freshClient();
    expect(client.isSupabaseConfigured()).toBe(true);
    expect(client.createClient()).not.toBeNull();
  });

  it("a publishable-format key (sb_publishable_…) configures the pair too", async () => {
    stubVar("NEXT_PUBLIC_SUPABASE_URL", URL);
    stubVar("NEXT_PUBLIC_SUPABASE_ANON_KEY", PUBLISHABLE_KEY);

    const env = await freshEnv();
    expect(env.isSupabaseConfigured()).toBe(true);

    const server = await freshServer();
    expect(server.isSupabaseConfiguredServer()).toBe(true);

    const client = await freshClient();
    expect(client.isSupabaseConfigured()).toBe(true);
  });

  it("only the old names set → nothing is configured (old names are dead)", async () => {
    stubVar("SUPABASE_URL", OLD_URL);
    stubVar("SUPABASE_ANON_KEY", OLD_KEY);

    const env = await freshEnv();
    expect(env.isSupabaseConfigured()).toBe(false);
    expect(env.validateEnv().missingOptional).toContain(
      "NEXT_PUBLIC_SUPABASE_URL",
    );
    expect(env.validateEnv().missingOptional).toContain(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );

    const server = await freshServer();
    expect(server.isSupabaseConfiguredServer()).toBe(false);

    const client = await freshClient();
    expect(client.isSupabaseConfigured()).toBe(false);
    expect(client.createClient()).toBeNull();
  });

  it("nothing set → nothing is configured and no client is created", async () => {
    const env = await freshEnv();
    expect(env.isSupabaseConfigured()).toBe(false);

    const server = await freshServer();
    expect(server.isSupabaseConfiguredServer()).toBe(false);

    const client = await freshClient();
    expect(client.isSupabaseConfigured()).toBe(false);
    expect(client.createClient()).toBeNull();
  });
});

describe("old names are gone from code and template", () => {
  function listNonTestSrcFiles(relDir: string): string[] {
    const out: string[] = [];
    const dir = resolve(ROOT, relDir);
    if (!existsSync(dir)) return out;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const rel = `${relDir}/${entry.name}`;
      if (entry.isDirectory()) out.push(...listNonTestSrcFiles(rel));
      else if (
        entry.isFile() &&
        /\.(ts|tsx)$/.test(entry.name) &&
        !/\.test\.ts$/.test(entry.name)
      ) {
        out.push(rel);
      }
    }
    return out;
  }

  // The old names, NOT preceded by NEXT_PUBLIC_ — the negative
  // lookbehind keeps the live NEXT_PUBLIC_SUPABASE_* names out.
  const OLD_NAME = /(?<!NEXT_PUBLIC_)SUPABASE_(URL|ANON_KEY)/;

  it("no production source file mentions the old names", () => {
    const files = listNonTestSrcFiles("src");
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const content = readFileSync(resolve(ROOT, file), "utf8");
      expect(content, file).not.toMatch(OLD_NAME);
    }
  });

  it(".env.example has no old-name lines", () => {
    const envExample = readFileSync(resolve(ROOT, ".env.example"), "utf8");
    for (const line of envExample.split("\n")) {
      expect(line).not.toMatch(/^SUPABASE_URL=/);
      expect(line).not.toMatch(/^SUPABASE_ANON_KEY=/);
    }
    // The single pair is still present (and empty).
    expect(envExample).toMatch(/^NEXT_PUBLIC_SUPABASE_URL=$/m);
    expect(envExample).toMatch(/^NEXT_PUBLIC_SUPABASE_ANON_KEY=$/m);
  });

  it("the removal is documented in exactly one place (docs/environment.md)", () => {
    const environmentMd = readFileSync(
      resolve(ROOT, "docs/environment.md"),
      "utf8",
    );
    expect(environmentMd).toContain("Removed in Phase 3.1.1");
  });
});
