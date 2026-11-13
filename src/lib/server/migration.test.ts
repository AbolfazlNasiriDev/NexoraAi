/**
 * Structural tests for the Supabase migrations (Phase 2.11).
 *
 * These tests read the real migration files from disk and assert on
 * their TEXT — they are STRUCTURAL ONLY. No database exists in this
 * environment (no psql, no local Postgres, no Supabase project), so
 * nothing here proves the SQL executes, the trigger fires, or the RLS
 * policies behave under a real `auth.uid()`. That is stated explicitly
 * in `docs/database.md` ("What remains untested") and must not be
 * read into these tests: a green suite means "the files say what they
 * should say", not "the database works".
 *
 * What is pinned here:
 * - v1 (Phase 2.6): 5 tables, 7 indexes, 7 policies, RLS on all 5,
 *   ZERO grants, no profile-creation path (the audit findings).
 * - v2 (Phase 2.11): the least-privilege GRANT matrix, the
 *   `handle_new_user` trigger, the new `messages` CHECKs, and the
 *   idempotency markers that make re-running safe.
 * - v3 (Phase 2.11.2, Option A): `profiles.email` nullable
 *   (DROP NOT NULL), the trigger guard changed from swallow-all to
 *   log-and-re-raise, and PUBLIC's EXECUTE on the function revoked.
 *   The v2 tests below still pin the v2 FILE as written — v2 is
 *   frozen history; v3 supersedes its function body at runtime via
 *   CREATE OR REPLACE FUNCTION.
 *
 * Syntax note: these tests are still structural — but in Phase
 * 2.11.1 the SQL syntax of v1+v2 (and the PL/pgSQL bodies) was
 * validated separately with pglast v8.8 (libpg_query, the real
 * PostgreSQL parser) in /tmp, and the same check was re-run for v3.
 * Nothing here proves execution, trigger firing, or RLS behaviour.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const V1_PATH = resolve(
  process.cwd(),
  "supabase/migrations/20261113000000_nexora_phase2_init.sql",
);
const V2_PATH = resolve(
  process.cwd(),
  "supabase/migrations/20261113000001_nexora_phase2_hardening.sql",
);
const V3_PATH = resolve(
  process.cwd(),
  "supabase/migrations/20261113000002_nexora_phase2_profile_email_nullable.sql",
);
const DATABASE_DOC_PATH = resolve(process.cwd(), "docs/database.md");

const V1_TABLES = [
  "profiles",
  "conversations",
  "messages",
  "user_settings",
  "usage_records",
] as const;

/** Read a migration file. Fails loudly if the file is missing. */
function readMigration(path: string): string {
  return readFileSync(path, "utf8");
}

/**
 * Return the table names from `CREATE TABLE IF NOT EXISTS public.<t>`
 * statements. The `^` anchor excludes the header comments, which
 * mention the keywords in prose (that is also why a naive `grep -c`
 * overcounts: v1 has 5 tables, not 6).
 */
function createdTables(sql: string): string[] {
  return [...sql.matchAll(/^CREATE TABLE IF NOT EXISTS public\.(\w+)/gm)].map(
    (m) => m[1],
  );
}

/** Count statements that start a line (excludes header comments). */
function countStatements(sql: string, keyword: string): number {
  return [...sql.matchAll(new RegExp(`^${keyword}`, "gm"))].length;
}

interface GrantLine {
  privileges: string[];
  table: string;
  grantee: string;
}

/** Parse `GRANT <privs> ON TABLE public.<t> TO <role>` lines. */
function grantLines(sql: string): GrantLine[] {
  return [
    ...sql.matchAll(
      /^GRANT ([\w, ]+) ON TABLE public\.(\w+) TO (\w+);?$/gm,
    ),
  ].map((m) => ({
    privileges: m[1].split(",").map((p) => p.trim()),
    table: m[2],
    grantee: m[3],
  }));
}

describe("v1 migration (Phase 2.6) — the baseline the audit reviewed", () => {
  const sql = readMigration(V1_PATH);

  it("creates exactly the 5 expected tables", () => {
    expect(createdTables(sql).sort()).toEqual([...V1_TABLES].sort());
  });

  it("creates exactly 7 indexes", () => {
    expect(countStatements(sql, "CREATE INDEX IF NOT EXISTS")).toBe(7);
  });

  it("creates exactly 7 RLS policies", () => {
    expect(countStatements(sql, "CREATE POLICY")).toBe(7);
  });

  it("enables RLS on all 5 tables", () => {
    for (const table of V1_TABLES) {
      expect(sql).toContain(
        `ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`,
      );
    }
  });

  it("contains ZERO grant statements (the audit finding)", () => {
    expect(sql).not.toMatch(/^GRANT /m);
    expect(sql).not.toMatch(/^REVOKE /m);
  });

  it("has no way to create a profile (the audit finding)", () => {
    // No INSERT policy for profiles…
    expect(sql).not.toMatch(/CREATE POLICY \w*profiles\w*insert/i);
    expect(sql).not.toMatch(/FOR INSERT ON public\.profiles/i);
    // …and no trigger on auth.users.
    expect(sql).not.toContain("ON auth.users");
    expect(sql).not.toContain("handle_new_user");
  });

  it("leaves messages token columns without a >= 0 CHECK (the audit finding)", () => {
    // usage_records has the CHECK; messages must not have it yet.
    expect(sql).toContain("CHECK (input_tokens >= 0)");
    expect(sql).not.toContain("messages_input_tokens_nonneg");
    expect(sql).not.toContain("messages_output_tokens_nonneg");
    expect(sql).not.toContain("messages_content_nonblank");
  });
});

describe("v2 migration (Phase 2.11) — GRANT matrix", () => {
  const sql = readMigration(V2_PATH);

  it("revokes everything first, from PUBLIC, anon and authenticated, for all 5 tables", () => {
    for (const table of V1_TABLES) {
      for (const role of ["PUBLIC", "anon", "authenticated"]) {
        expect(sql).toContain(
          `REVOKE ALL ON TABLE public.${table} FROM ${role};`,
        );
      }
    }
  });

  it("grants exactly the least-privilege matrix, only to authenticated", () => {
    const expected: Record<string, string[]> = {
      profiles: ["SELECT", "UPDATE"],
      conversations: ["SELECT", "INSERT", "UPDATE", "DELETE"],
      messages: ["SELECT", "INSERT"],
      user_settings: ["SELECT", "INSERT", "UPDATE", "DELETE"],
      usage_records: ["SELECT"],
    };
    const grants = grantLines(sql);
    expect(grants).toHaveLength(5);
    for (const grant of grants) {
      expect(grant.grantee).toBe("authenticated");
      expect(grant.privileges.sort()).toEqual(
        expected[grant.table].sort(),
      );
    }
    expect(grants.map((g) => g.table).sort()).toEqual(
      [...V1_TABLES].sort(),
    );
  });

  it("grants NOTHING to anon or PUBLIC, and never GRANT ALL", () => {
    expect(sql).not.toMatch(/^GRANT .* TO anon/m);
    expect(sql).not.toMatch(/^GRANT .* TO PUBLIC/m);
    expect(sql).not.toMatch(/^GRANT ALL /m);
    expect(sql).not.toMatch(/GRANT .* TO service_role/m);
  });

  it("does not redefine any table", () => {
    expect(sql).not.toMatch(/^CREATE TABLE/m);
  });
});

describe("v2 migration (Phase 2.11) — profile trigger", () => {
  const sql = readMigration(V2_PATH);

  it("defines handle_new_user as SECURITY DEFINER with an empty search_path", () => {
    expect(sql).toContain(
      "CREATE OR REPLACE FUNCTION public.handle_new_user()",
    );
    expect(sql).toContain("SECURITY DEFINER");
    expect(sql).toContain("SET search_path = ''");
  });

  it("inserts only id + email into public.profiles, duplicate-proof", () => {
    expect(sql).toContain("INSERT INTO public.profiles (id, email)");
    expect(sql).toContain("VALUES (NEW.id, NEW.email)");
    expect(sql).toContain("ON CONFLICT (id) DO NOTHING");
    // Minimal data only: nothing from raw_user_meta_data is copied.
    expect(sql).not.toContain("raw_user_meta_data");
    expect(sql).not.toContain("display_name");
    expect(sql).not.toContain("avatar_url");
  });

  it("never breaks sign-up: failures are swallowed with a warning", () => {
    expect(sql).toContain("EXCEPTION WHEN OTHERS THEN");
    expect(sql).toContain("RAISE WARNING");
    expect(sql).toContain("RETURN NEW;");
  });

  it("wires the trigger to auth.users inserts, idempotently", () => {
    expect(sql).toContain(
      "DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;",
    );
    expect(sql).toContain("CREATE TRIGGER on_auth_user_created");
    expect(sql).toContain("AFTER INSERT ON auth.users");
    expect(sql).toContain(
      "EXECUTE FUNCTION public.handle_new_user();",
    );
  });

  it("deliberately adds NO profiles INSERT policy (trigger-only creation)", () => {
    expect(sql).not.toMatch(/CREATE POLICY \w*profiles\w*insert/i);
    expect(sql).not.toMatch(/FOR INSERT ON public\.profiles/i);
    // …and says why, in the file itself.
    expect(sql).toContain("NO profiles INSERT policy");
  });
});

describe("v2 migration (Phase 2.11) — messages CHECKs", () => {
  const sql = readMigration(V2_PATH);

  it("adds >= 0 CHECKs on both token columns", () => {
    expect(sql).toContain(
      "ADD CONSTRAINT messages_input_tokens_nonneg",
    );
    expect(sql).toContain("CHECK (input_tokens >= 0)");
    expect(sql).toContain(
      "ADD CONSTRAINT messages_output_tokens_nonneg",
    );
    expect(sql).toContain("CHECK (output_tokens >= 0)");
  });

  it("adds a non-blank content CHECK using btrim", () => {
    expect(sql).toContain("ADD CONSTRAINT messages_content_nonblank");
    expect(sql).toContain("CHECK (char_length(btrim(content)) > 0)");
  });

  it("does not change nullability or defaults of the token columns", () => {
    expect(sql).not.toMatch(/ALTER TABLE public\.messages\s+ALTER COLUMN (input|output)_tokens SET NOT NULL/i);
    expect(sql).not.toMatch(/ALTER TABLE public\.messages\s+ALTER COLUMN (input|output)_tokens SET DEFAULT/i);
  });

  it("guards every ADD CONSTRAINT with a pg_constraint lookup (re-runnable)", () => {
    const guards = [...sql.matchAll(/pg_constraint/g)].length;
    expect(guards).toBeGreaterThanOrEqual(3);
    expect(sql).toContain("conrelid = 'public.messages'::regclass");
  });
});

describe("v2 migration (Phase 2.11) — idempotency in form", () => {
  const sql = readMigration(V2_PATH);

  it("uses only re-runnable forms", () => {
    expect(sql).toContain("CREATE OR REPLACE FUNCTION");
    expect(sql).toContain("ON CONFLICT (id) DO NOTHING");
    // The trigger is re-runnable because the DROP precedes the CREATE.
    const dropAt = sql.indexOf(
      "DROP TRIGGER IF EXISTS on_auth_user_created",
    );
    const createAt = sql.indexOf("CREATE TRIGGER on_auth_user_created");
    expect(dropAt).toBeGreaterThanOrEqual(0);
    expect(createAt).toBeGreaterThan(dropAt);
    // REVOKE / GRANT are naturally idempotent; the guarded CHECKs
    // are covered by the pg_constraint assertions above.
  });
});

describe("v3 migration (Phase 2.11.2, Option A) — nullable email", () => {
  const sql = readMigration(V3_PATH);

  it("drops NOT NULL on profiles.email and keeps UNIQUE", () => {
    expect(sql).toContain(
      "ALTER TABLE public.profiles ALTER COLUMN email DROP NOT NULL;",
    );
    // UNIQUE stays: NULL emails never collide (PostgreSQL allows
    // multiple NULLs under UNIQUE) — the file must say so.
    expect(sql).toContain("The UNIQUE constraint is intentionally KEPT");
    expect(sql).not.toMatch(/DROP CONSTRAINT.*email/i);
  });

  it("does not create, drop, or redefine any table", () => {
    expect(sql).not.toMatch(/^CREATE TABLE/m);
    expect(sql).not.toMatch(/^DROP TABLE/m);
    expect(sql).not.toMatch(/^ALTER TABLE public\.profiles ALTER COLUMN email (SET|DROP) DEFAULT/m);
  });
});

describe("v3 migration (Phase 2.11.2, Option A) — log-and-re-raise trigger", () => {
  const sql = readMigration(V3_PATH);

  it("replaces handle_new_user with the same secure shape", () => {
    expect(sql).toContain(
      "CREATE OR REPLACE FUNCTION public.handle_new_user()",
    );
    expect(sql).toContain("SECURITY DEFINER");
    expect(sql).toContain("SET search_path = ''");
    expect(sql).toContain("INSERT INTO public.profiles (id, email)");
    expect(sql).toContain("VALUES (NEW.id, NEW.email)");
    expect(sql).toContain("ON CONFLICT (id) DO NOTHING");
    expect(sql).toContain("RETURN NEW;");
  });

  it("logs the failure AND re-raises it — no swallow-all", () => {
    expect(sql).toContain("EXCEPTION WHEN OTHERS THEN");
    expect(sql).toContain("RAISE WARNING");
    // The re-raise must come right after the WARNING: log-and-re-raise,
    // not swallow. A bare `RAISE;` with no arguments re-raises the
    // current exception, so the auth.users insert fails loudly.
    expect(sql).toMatch(/RAISE WARNING[^;]*;\s*RAISE;/);
  });

  it("does NOT recreate the trigger — the v2 trigger stands", () => {
    // `^`-anchored: the header comments mention CREATE/DROP TRIGGER
    // in prose (explaining why no re-creation is needed) — only a
    // real statement at line start would count.
    expect(sql).not.toMatch(/^CREATE TRIGGER/m);
    expect(sql).not.toMatch(/^DROP TRIGGER/m);
    expect(sql).toContain("the v2 trigger `on_auth_user_created` stands");
  });
});

describe("v3 migration (Phase 2.11.2, Option A) — scope and idempotency", () => {
  const sql = readMigration(V3_PATH);

  it("touches no RLS, no policies, and no table GRANTs/REVOKEs", () => {
    expect(sql).not.toMatch(/CREATE POLICY/i);
    expect(sql).not.toMatch(/^GRANT .* ON TABLE/m);
    expect(sql).not.toMatch(/^REVOKE ALL ON TABLE/m);
    expect(sql).not.toMatch(/DISABLE ROW LEVEL SECURITY/i);
  });

  it("revokes EXECUTE on the function from PUBLIC — exactly once", () => {
    const revokes = [
      ...sql.matchAll(
        /^REVOKE EXECUTE ON FUNCTION public\.handle_new_user\(\) FROM PUBLIC;$/gm,
      ),
    ];
    expect(revokes).toHaveLength(1);
  });

  it("is idempotent in form and documents the same-role requirement", () => {
    expect(sql).toContain(
      "ALTER TABLE public.profiles ALTER COLUMN email DROP NOT NULL;",
    );
    expect(sql).toContain("CREATE OR REPLACE FUNCTION");
    expect(sql).toContain("Same-role requirement");
  });

  it("docs/database.md records the nullable email and the loud guard", () => {
    // Types cannot be asserted at runtime; the 1:1 type change
    // (ProfileRow.email: string | null) is covered by keeping the
    // docs in sync — this pins the doc sentences the type change
    // must match.
    const doc = readFileSync(DATABASE_DOC_PATH, "utf8");
    expect(doc).toContain("nullable since Phase 2.11.2");
    expect(doc).toContain("log-and-re-raise");
  });
});
