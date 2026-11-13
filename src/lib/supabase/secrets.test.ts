/**
 * Secret-leakage tests (Phase 3.1) — grep-based, like the gitignore test.
 *
 * Reads the real files from disk and pins the security invariants:
 * - No service-role key (or any server-only secret name) in any
 *   client-facing file: the browser client, the auth pages, the auth
 *   components, or the TopBar that hosts the user chip.
 * - The browser client reads ONLY the NEXT_PUBLIC_ Supabase pair —
 *   never the old server-only `SUPABASE_URL` name.
 * - The server client reads ONLY the same NEXT_PUBLIC_ pair (unified
 *   in Phase 3.1.1) — never the removed `SUPABASE_URL` /
 *   `SUPABASE_ANON_KEY` names and never a service-role key.
 * - No profile-write path exists anywhere in the app: profile rows
 *   are created by the database trigger only (see docs/auth.md).
 * - `.env.example` keeps the two NEXT_PUBLIC_ Supabase values empty
 *   and never exposes a secret under a NEXT_PUBLIC_ name.
 *
 * These are structural tests: they pin what the files SAY. A green
 * suite means no secret string is present in client code — it does
 * not prove a runtime leak is impossible.
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

function listFilesRecursive(relDir: string): string[] {
  const out: string[] = [];
  const dir = resolve(ROOT, relDir);
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = `${relDir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...listFilesRecursive(rel));
    else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) out.push(rel);
  }
  return out;
}

/** Every client-facing file in the auth surface. */
const CLIENT_FILES: string[] = [
  "src/lib/supabase/client.ts",
  "src/components/layout/TopBar.tsx",
  ...listFilesRecursive("src/app/auth"),
  ...listFilesRecursive("src/components/auth"),
];

describe("no secrets in client-facing code", () => {
  it("no SERVICE_ROLE_KEY (or any service-role reference) in client files", () => {
    expect(CLIENT_FILES.length).toBeGreaterThan(0);
    for (const file of CLIENT_FILES) {
      const content = read(file);
      expect(content, file).not.toContain("SERVICE_ROLE_KEY");
      expect(content, file).not.toContain("service_role");
    }
  });

  it("the browser client reads only the NEXT_PUBLIC_ Supabase pair", () => {
    const content = read("src/lib/supabase/client.ts");
    expect(content).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(content).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    // The server-only name must not appear as its own env read.
    expect(content).not.toContain("process.env.SUPABASE_URL");
    expect(content).not.toContain("process.env.SUPABASE_ANON_KEY");
  });

  it("the server client reads only the single NEXT_PUBLIC_ pair (unified in 3.1.1)", () => {
    for (const file of [
      "src/lib/supabase/server.ts",
      "src/lib/supabase/middleware.ts",
    ]) {
      const content = read(file);
      expect(content, file).toContain("NEXT_PUBLIC_SUPABASE_URL");
      expect(content, file).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
      // The removed server-only names must never be read again.
      expect(content, file).not.toContain("process.env.SUPABASE_URL");
      expect(content, file).not.toContain("process.env.SUPABASE_ANON_KEY");
      // And no service-role key is ever read here either (the header
      // comment may NAME it as forbidden, but no env read may exist).
      expect(content, file).not.toContain(
        "process.env.SUPABASE_SERVICE_ROLE_KEY",
      );
    }
  });

  it("no profile-write path exists anywhere in the app", () => {
    // The database trigger owns profile creation; the app must never
    // insert into profiles (a client-side insert with an arbitrary
    // user_id would be user_id spoofing).
    const allSrc = listFilesRecursive("src");
    for (const file of allSrc) {
      const content = read(file);
      expect(content, file).not.toMatch(/\.from\(\s*["']profiles["']\s*\)/);
    }
  });
});

describe(".env.example stays empty of Supabase secrets", () => {
  it("the NEXT_PUBLIC_ Supabase values are empty", () => {
    const envExample = read(".env.example");
    for (const name of [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ]) {
      const match = envExample.match(new RegExp(`^${name}=(.*)$`, "m"));
      expect(match, name).not.toBeNull();
      expect(match?.[1].trim() ?? "", name).toBe("");
    }
  });

  it("no NEXT_PUBLIC_ variable name contains SERVICE or SECRET", () => {
    const envExample = read(".env.example");
    for (const line of envExample.split("\n")) {
      const match = line.match(/^(NEXT_PUBLIC_[A-Z0-9_]+)=/);
      if (!match) continue;
      expect(match[1]).not.toContain("SERVICE");
      expect(match[1]).not.toContain("SECRET");
    }
  });
});
