# Nexora AI — Database Architecture (Phase 2.6, hardened in 2.11 and 2.11.2)

> Status: **schema only, not connected.** The migrations in
> `supabase/migrations/` define the full schema — v1
> (`20261113000000_nexora_phase2_init.sql`, Phase 2.6) creates the
> tables, indexes, and RLS policies; v2
> (`20261113000001_nexora_phase2_hardening.sql`, Phase 2.11) adds
> least-privilege GRANTs, the profile-creation trigger, and the
> missing `messages` CHECKs; v3
> (`20261113000002_nexora_phase2_profile_email_nullable.sql`, Phase
> 2.11.2) makes `profiles.email` nullable and changes the trigger's
> error handling from swallow-all to log-and-re-raise. But no
> Supabase project exists yet, no account was used, and nothing in
> this repo connects to a database. There is no client, no auth flow,
> and no server query code. This document describes what the schema
> is and how it will be applied later.

## Tables

| Table | Purpose | Primary key |
| --- | --- | --- |
| `profiles` | One row per authenticated user | `id` (uuid, = `auth.users.id`) |
| `conversations` | A user's chat sessions | `id` (uuid) |
| `messages` | Turns inside a conversation (append-only) | `id` (uuid) |
| `user_settings` | Per-user preferences (one row per user) | `user_id` (uuid) |
| `usage_records` | Per-reply usage accounting (append-only) | `id` (uuid) |

All ids are `uuid` with `gen_random_uuid()`. All tables have
`timestamptz created_at` defaulting to `now()`. `profiles`,
`conversations` and `user_settings` also have `updated_at`, maintained
by the shared `public.set_updated_at()` trigger.

## Entity-relationship diagram

```text
auth.users (Supabase Auth)
    │ 1
    │ ON DELETE CASCADE
    ▼
profiles ────────────────┐
    │ 1                  │ 1
    │ ON DELETE CASCADE  │ ON DELETE CASCADE
    ▼                    ▼
conversations       user_settings
    │ 1                  (preferred_model, theme = 'light',
    │ ON DELETE CASCADE   notifications_enabled)
    ▼
messages (append-only)
    role ∈ {user, assistant, system}
    content, input_tokens?, output_tokens?

profiles ──▶ usage_records (append-only)
    │ 1         conversation_id → conversations
    │           ON DELETE SET NULL (keeps the accounting row)
    ▼
usage_records
    model_id, input_tokens ≥ 0, output_tokens ≥ 0
```

Relations in words:

- `profiles.id` **is** the Supabase Auth user id. Deleting the auth
  user cascades: profile → conversations → messages, plus settings and
  usage records.
- `conversations.user_id → profiles.id`, `messages.conversation_id →
  conversations.id`, `user_settings.user_id → profiles.id`,
  `usage_records.user_id → profiles.id`.
- `conversations.model_id`, `user_settings.preferred_model` and
  `usage_records.model_id` are **plain text registry model ids**
  (e.g. `gpt-4o`), not foreign keys — models live in the app's
  `ModelRegistry` (`src/lib/ai/registry.ts`), not in the database.
- `messages.role` uses a `CHECK (role IN ('user','assistant','system'))`,
  matching the `ChatRole` type in `src/types/chat.ts`.
- `messages.content` has `CHECK (char_length(content) > 0)` **and**,
  since Phase 2.11, `CHECK (char_length(btrim(content)) > 0)` — blank
  or whitespace-only content is rejected; the chat API additionally
  trims and enforces its 1–8000 character limit.
- `messages.input_tokens` / `output_tokens` have, since Phase 2.11,
  `CHECK (... >= 0)` (NULL still allowed — they stay nullable, like
  `usage_records` they are recorded only when the provider reports
  them).
- `user_settings.theme` has `CHECK (theme = 'light')` — light-only is a
  product decision, enforced in the database, not just in the UI.
- `messages` and `usage_records` are **append-only**: no `updated_at`
  column and no `updated_at` trigger. History is never rewritten;
  corrections are new rows. `usage_records.conversation_id` uses
  `ON DELETE SET NULL` so deleting a conversation keeps its accounting.

TypeScript mirrors of every row live in `src/types/database.ts`
(`ProfileRow`, `ConversationRow`, `MessageRow`, `UserSettingsRow`,
`UsageRecordRow`, plus a plain `Database` table→row map). The file is
types only — it opens no connection.

## Indexes — why each one exists

| Index | Why |
| --- | --- |
| `conversations (user_id)` | Listing one user's conversations. |
| `conversations (user_id, created_at DESC)` | History view, newest first, without a sort. |
| `messages (conversation_id)` | Loading one conversation's turns. |
| `messages (conversation_id, created_at)` | Turns in chronological order. |
| `usage_records (user_id)` | One user's usage rows. |
| `usage_records (user_id, created_at DESC)` | Usage history, newest first. |
| `usage_records (model_id)` | Per-model aggregation (e.g. total tokens per model). |

`profiles.email` is `UNIQUE` (one profile per email) and is
nullable since Phase 2.11.2 (v3 migration) — a phone-only signup has
no email to store, and PostgreSQL allows multiple NULLs under
UNIQUE, so NULL emails never collide. `user_settings.user_id` is
the primary key (one settings row per user), so those lookups need
no extra index.

## Row Level Security (RLS)

RLS is enabled on **all five tables**. Every policy is scoped to
`auth.uid()` — the signed-in user's id. Anonymous callers match no
policy and see nothing. Users can only touch their own rows:

| Table | Policies |
| --- | --- |
| `profiles` | `profiles_select_own`, `profiles_update_own` — own row only (`auth.uid() = id`). |
| `conversations` | `conversations_all_own` — all operations, own rows only (`auth.uid() = user_id`). |
| `messages` | `messages_select_own`, `messages_insert_own` — only inside conversations owned by the caller (checked with `EXISTS` against `conversations`). |
| `user_settings` | `user_settings_all_own` — all operations, own row only. |
| `usage_records` | `usage_records_select_own` — **read-only for end users**. |

### The service-role key rule

`usage_records` has **no** INSERT/UPDATE/DELETE policy for end users on
purpose. Usage rows are written **server-side with the service-role
key**, which bypasses RLS. That key must:

- stay **server-only** (read from server env, never from `NEXT_PUBLIC_*`),
- **never** be used from the browser,
- **never** be shipped to the frontend or committed to the repo.

The anon key (if one is ever used in the browser) can only ever read
rows the RLS policies allow — it can never write `usage_records`.

## GRANTs — least privilege (Phase 2.11)

v1 had **zero** GRANT statements: RLS policies alone grant nothing,
so every query would have failed with "permission denied" on first
apply. v2 (`20261113000001_nexora_phase2_hardening.sql`) revokes
everything first (from `PUBLIC`, `anon`, and `authenticated`), then
grants exactly this — nothing to `anon`, nothing to `PUBLIC`, and
`service_role` is left untouched (it bypasses RLS by design):

| Table | `authenticated` gets | Deliberately withheld |
| --- | --- | --- |
| `profiles` | SELECT, UPDATE | INSERT, DELETE — profiles are created only by the trigger / service role |
| `conversations` | SELECT, INSERT, UPDATE, DELETE | — |
| `messages` | SELECT, INSERT | UPDATE, DELETE — append-only |
| `user_settings` | SELECT, INSERT, UPDATE, DELETE | — (upsert needs INSERT + UPDATE) |
| `usage_records` | SELECT | INSERT, UPDATE, DELETE — server-side via service role only |

GRANTs alone do **not** replace RLS: RLS stays enabled on all five
tables and is the actual access control. A role with a GRANT but no
matching policy still sees nothing.

## Profile creation on sign-up (Phase 2.11, fixed in 2.11.2)

v1 had no way to create a profile row: no INSERT policy on
`profiles` and no trigger, so after sign-up the `profiles` row (and
everything keyed off it) could never exist. v2 adds
`public.handle_new_user()`, fired by the trigger
`on_auth_user_created` `AFTER INSERT ON auth.users`:

1. On every new `auth.users` row, the trigger inserts one
   `public.profiles` row with `(id, email)` taken from `NEW` — the
   user who actually just signed up, nothing else.
2. `ON CONFLICT (id) DO NOTHING` — a profile can never be created
   twice.
3. The function is `SECURITY DEFINER` with `SET search_path = ''`
   and schema-qualified objects, so it runs as its owner and cannot
   be hijacked through the search path. It bypasses RLS by design —
   that is the *only* user-facing path that creates profiles.
4. Since Phase 2.11.2 (v3 migration) the insert uses a
   log-and-re-raise guard: a failure is still logged (`RAISE
   WARNING` with the user id and error text), but the error is then
   re-raised with a bare `RAISE`, so the `auth.users` insert fails
   LOUDLY instead of silently leaving a profile-less user. This
   replaced v2's swallow-all guard, which the 2.11.1 final review
   proved unsafe: a phone-only signup inserted `(id, NULL)` into a
   NOT NULL column, the failure was swallowed, and the user could
   sign in but never use the app (every FK chain from `profiles.id`
   failed) with no recovery path anywhere. That cannot happen
   anymore — `profiles.email` is nullable since Phase 2.11.2, so a
   phone signup now creates a complete profile with `email` NULL,
   and the only failures left are real misconfigurations, which
   must be loud.
5. v1, v2 and v3 must be run by the SAME privileged role (Supabase
   SQL Editor / `postgres`): the function is `SECURITY DEFINER` and
   runs as its owner, and the owner needs INSERT on
   `public.profiles`.
6. Since v3, PUBLIC's EXECUTE privilege on the function is revoked,
   so it cannot be called directly by arbitrary roles. The trigger
   itself keeps working: EXECUTE on a trigger function is checked
   only for the role that creates the trigger, not when it fires —
   see PostgreSQL 18 CREATE TRIGGER docs
   (https://www.postgresql.org/docs/current/sql-createtrigger.html)
   and the postgresql.org discussion
   (https://www.postgresql.org/message-id/b1be2d05-b9fd-b9db-ea7f-38253e4e4bab%40anastigmatix.net).
   The throwaway run must still confirm a sign-up creates exactly
   one `profiles` row after this revoke.

There is **deliberately no INSERT policy on `profiles`**: an INSERT
policy would let any signed-in user insert a profile row with *any*
id, including another user's id (user_id spoofing). Only the trigger
and the service role can create profiles. Users keep SELECT + UPDATE
on their own row only (`auth.uid() = id`).

Creating the trigger requires a privileged role (Supabase SQL Editor
/ postgres); it will not work from a restricted client connection.

## RLS matrix — who can do what (policies from v1 + GRANTs from v2)

Every row is scoped to `auth.uid()`. `anon` has no GRANT on any table
and matches no policy, so anonymous callers see nothing. `service_role`
bypasses RLS and is the only writer of `usage_records` and the only
other creator of `profiles` rows.

| Table | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| `profiles` | own row only | — (trigger / service role only) | own row only | — |
| `conversations` | own rows | own rows | own rows | own rows |
| `messages` | own conversations | own conversations (EXISTS check) | — (append-only) | — (append-only) |
| `user_settings` | own row | own row | own row | own row |
| `usage_records` | own rows | — (service role only) | — (service role only) | — (service role only) |

## What remains untested (honest status)

No migration has ever been executed — there is no Supabase project
and no Postgres server in this environment (no `psql`, no local
Postgres, no Docker), so **execution, trigger firing, RLS behaviour
and GRANT enforcement are still unvalidated**. What DOES exist now
is real-parser syntax validation: in Phase 2.11.1 both v1 and v2
(and their PL/pgSQL bodies) were parsed with pglast v8.8
(libpg_query, the real PostgreSQL parser), and the same check was
re-run for v3 — syntax is valid; that is not proof the database
works. Structural testing (`src/lib/server/migration.test.ts`, 106
tests) pins the files' contents: 5 tables / 7 indexes / 7 policies
in v1, the exact GRANT matrix, the trigger shape, the new CHECKs,
the idempotency markers in v2, and the nullable email +
log-and-re-raise guard + EXECUTE revoke in v3.

Still untested, explicitly:

- Live execution of v1 then v2 then v3, in order, on a real database.
- The `handle_new_user` trigger actually firing on a real sign-up
  (and the duplicate / phone-signup-with-NULL-email / loud-failure
  paths).
- RLS behaviour under a real `auth.uid()` (including that `anon`
  sees nothing and one user cannot read another's rows).
- GRANT effectiveness (that the matrix above is what Postgres
  actually enforces, and that no default Supabase grant widens it).
- The `messages` CHECKs against real rows (including that an
  existing violating row would make the ADD CONSTRAINT fail).
- That the trigger still fires after v3's `REVOKE EXECUTE ... FROM
  PUBLIC` (the docs say EXECUTE is checked at trigger-creation
  time, not at firing time — see the profile-creation section — but
  this must be confirmed live before any production run).

The first live run must be on a **throwaway Supabase project**, never
production, and must check: the 5 tables + RLS on, the GRANT matrix
via `information_schema.role_table_grants`, the trigger row in
`information_schema.triggers`, the three new `messages` constraints,
`profiles.email` nullable via `information_schema.columns`, a phone
/ no-email test sign-up creating exactly one `public.profiles` row
with `email IS NULL`, a second user signing up without a duplicate
profile, and `has_function_privilege` returning false for `anon` /
`authenticated` on `handle_new_user()`. The exact verification
queries are in the headers of the v2 and v3 files.

## How to apply the migrations (later — not done in Phase 2.6/2.11/2.11.2)

Prerequisites: a Supabase project must exist first. None exists yet,
and creating one is a later, user-approved step.

**Option A — Supabase dashboard:** open the SQL Editor, paste
`supabase/migrations/20261113000000_nexora_phase2_init.sql`, run it,
then paste
`supabase/migrations/20261113000001_nexora_phase2_hardening.sql` and
run it, then paste
`supabase/migrations/20261113000002_nexora_phase2_profile_email_nullable.sql`
and run it. Order matters: v1 first, then v2, then v3 — all three by
the same privileged role (see the same-role requirement above).

**Option B — Supabase CLI** (from the project root, after linking to a
real project):

```bash
supabase db push
```

The files already live at the conventional path
`supabase/migrations/<timestamp>_nexora_phase2_*.sql` (the CLI runs
them in timestamp order).

**Verify afterwards** (SQL Editor):

```sql
SELECT tablename FROM pg_tables
  WHERE schemaname = 'public' ORDER BY tablename;
-- expect: conversations, messages, profiles, user_settings, usage_records

SELECT tablename, rowsecurity FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename IN
      ('profiles','conversations','messages','user_settings','usage_records');
-- expect: rowsecurity = true for all five tables.
```

The migrations are written to be safely re-runnable (`IF NOT EXISTS` /
`DROP POLICY IF EXISTS` / `CREATE OR REPLACE FUNCTION` / REVOKE+GRANT
/ `pg_constraint`-guarded ADD CONSTRAINT / idempotent
`ALTER COLUMN ... DROP NOT NULL`), and they create **zero
rows** — no seed data is included, and none should be added. Rows are
created by real users through the app once auth and the API are wired
up.

## What is intentionally NOT built yet

- No Supabase project, no `supabase link` / login, no Supabase client
  or CLI installed (`@supabase/supabase-js` is **not** a dependency).
- No auth flow (sign-up / sign-in) in the frontend. The profile
  *trigger* exists in SQL (v2), but nothing calls Supabase Auth yet.
- No server queries, no repository/data-access layer, no API route
  reads or writes these tables.
- `.env.example` exists since Phase 2.7 with **empty**
  `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` /
  `SUPABASE_SERVICE_ROLE_KEY` values — no real project or key is
  referenced anywhere.
- No seed data and no real user data of any kind.
