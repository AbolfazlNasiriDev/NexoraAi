# Nexora AI — Database Architecture (Phase 2.6)

> Status: **schema only, not connected.** The migration in
> `supabase/migrations/20261113000000_nexora_phase2_init.sql` defines the
> full schema, but no Supabase project exists yet, no account was used,
> and nothing in this repo connects to a database. There is no client,
> no auth flow, and no server query code. This document describes what
> the schema is and how it will be applied later.

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
- `messages.content` has `CHECK (char_length(content) > 0)`; the chat
  API additionally trims and enforces its 1–8000 character limit.
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

`profiles.email` is `UNIQUE` (one profile per email) and
`user_settings.user_id` is the primary key (one settings row per user),
so those lookups need no extra index.

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

## How to apply the migration (later — not done in Phase 2.6)

Prerequisites: a Supabase project must exist first. None exists yet,
and creating one is a later, user-approved step.

**Option A — Supabase dashboard:** open the SQL Editor, paste
`supabase/migrations/20261113000000_nexora_phase2_init.sql`, run it.

**Option B — Supabase CLI** (from the project root, after linking to a
real project):

```bash
supabase db push
```

The file already lives at the conventional path
`supabase/migrations/<timestamp>_nexora_phase2_init.sql`.

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

The migration is written to be safely re-runnable (`IF NOT EXISTS` /
`DROP POLICY IF EXISTS` / `CREATE OR REPLACE FUNCTION`), and it
creates **zero rows** — no seed data is included, and none should be
added. Rows are created by real users through the app once auth and
the API are wired up.

## What is intentionally NOT built yet

- No Supabase project, no `supabase link` / login, no Supabase client
  or CLI installed (`@supabase/supabase-js` is **not** a dependency).
- No auth flow (sign-up / sign-in / profile creation on first login).
- No server queries, no repository/data-access layer, no API route
  reads or writes these tables.
- No `.env.example` (Phase 2.7) — so no `SUPABASE_URL` / keys are
  referenced anywhere yet.
- No seed data and no real user data of any kind.
