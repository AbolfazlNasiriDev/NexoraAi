-- ============================================================================
-- Nexora AI — Phase 2.6: Initial database schema
-- ============================================================================
-- Target: Supabase PostgreSQL 15+ (Postgres with the `auth` schema).
--
-- IMPORTANT: This migration has NOT been executed against a live database
-- yet. No Supabase project is connected to this repository, no Supabase
-- account was used, and no real URL or key appears anywhere in this file.
-- It is a reviewed, ready-to-apply schema: run it once a Supabase project
-- exists (see the "How to apply" block at the end of this file).
--
-- Safety / re-run behaviour:
-- - `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` so a
--   re-run does not fail on objects that already exist.
-- - `DROP POLICY IF EXISTS` before every `CREATE POLICY`, and
--   `CREATE OR REPLACE FUNCTION` / `DROP TRIGGER IF EXISTS` for the
--   `updated_at` trigger, so policies and triggers can be re-applied.
-- - No seed data: this migration creates ZERO rows. All data is created
--   later by real users through the app (or by server-side code).
--
-- Conventions:
-- - All ids are `uuid` with `gen_random_uuid()` (built into Postgres 13+,
--   no extension needed). Timestamps are `timestamptz`, `created_at`
--   defaults to `now()`.
-- - Column names are snake_case and are mirrored 1:1 by the TypeScript
--   row types in `src/types/database.ts`.
-- - `messages` and `usage_records` are append-only: they have no
--   `updated_at` column and no `updated_at` trigger. History is never
--   rewritten; corrections are new rows.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Helper: shared `updated_at` trigger function
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- profiles — one row per authenticated user
-- ----------------------------------------------------------------------------
-- `id` is the Supabase Auth user id (`auth.users.id`); deleting the auth
-- user cascades and removes the profile (and, through the chains below,
-- everything that user owned).
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  display_name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS
  'One row per authenticated user. id is the Supabase Auth user id.';

-- ----------------------------------------------------------------------------
-- conversations — a user's chat sessions
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New chat',
  model_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.conversations IS
  'Chat sessions. model_id is a registry model id (e.g. gpt-4o); it is a plain text reference, not a foreign key, because models live in the app registry, not in the database.';

-- Per-user conversation lists, newest first (the sidebar / history view).
CREATE INDEX IF NOT EXISTS conversations_user_id_idx
  ON public.conversations (user_id);
CREATE INDEX IF NOT EXISTS conversations_user_created_idx
  ON public.conversations (user_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- messages — the turns inside a conversation (append-only)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations (id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL CHECK (char_length(content) > 0),
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.messages IS
  'Append-only chat turns. role matches the ChatRole type in src/types/chat.ts. Token counts are nullable: they are recorded only when the provider actually reports them, never invented.';

-- Loading one conversation's history in order.
CREATE INDEX IF NOT EXISTS messages_conversation_id_idx
  ON public.messages (conversation_id);
CREATE INDEX IF NOT EXISTS messages_conversation_created_idx
  ON public.messages (conversation_id, created_at);

-- ----------------------------------------------------------------------------
-- user_settings — per-user preferences (one row per user)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  preferred_model text,
  theme text NOT NULL DEFAULT 'light' CHECK (theme = 'light'),
  notifications_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_settings IS
  'Per-user preferences. theme is light-only by product decision (the CHECK constraint enforces it); preferred_model is a registry model id or NULL when the user has not chosen one.';

-- ----------------------------------------------------------------------------
-- usage_records — per-reply usage accounting (append-only)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.usage_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.conversations (id) ON DELETE SET NULL,
  model_id text NOT NULL,
  input_tokens integer NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens integer NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.usage_records IS
  'One row per completed provider reply, for usage accounting. conversation_id is SET NULL (not CASCADE) so deleting a conversation keeps the accounting row. Token counts are real provider-reported numbers only.';

-- Per-user usage history, newest first; and per-model aggregation.
CREATE INDEX IF NOT EXISTS usage_records_user_id_idx
  ON public.usage_records (user_id);
CREATE INDEX IF NOT EXISTS usage_records_user_created_idx
  ON public.usage_records (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS usage_records_model_id_idx
  ON public.usage_records (model_id);

-- ----------------------------------------------------------------------------
-- updated_at triggers (only on tables that are meant to be updated)
-- ----------------------------------------------------------------------------
-- messages and usage_records are append-only and deliberately have no
-- trigger: their rows are written once and never modified.
DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS conversations_set_updated_at ON public.conversations;
CREATE TRIGGER conversations_set_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS user_settings_set_updated_at ON public.user_settings;
CREATE TRIGGER user_settings_set_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
-- Every table has RLS enabled. The rules below assume Supabase Auth
-- (`auth.uid()` returns the signed-in user's id, or NULL when anonymous).
-- An anonymous caller therefore matches no policy and sees nothing.
--
-- Key rules:
-- - Users can only touch their own rows — every policy is scoped to
--   `auth.uid()`. There is no policy that lets one user read another
--   user's conversations, messages, settings or usage.
-- - `usage_records` is SELECT-only for end users. Inserts happen
--   server-side with the service-role key, which bypasses RLS. The
--   service-role key must stay server-only and must NEVER be used from
--   the browser or shipped to the frontend.
-- - `messages` INSERT is allowed only when the target conversation is
--   owned by the caller (checked with EXISTS against `conversations`).
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_records ENABLE ROW LEVEL SECURITY;

-- profiles: read and update only your own profile row.
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- conversations: full access, but only to your own conversations.
DROP POLICY IF EXISTS conversations_all_own ON public.conversations;
CREATE POLICY conversations_all_own ON public.conversations
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- messages: read and insert only inside conversations you own.
DROP POLICY IF EXISTS messages_select_own ON public.messages;
CREATE POLICY messages_select_own ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS messages_insert_own ON public.messages;
CREATE POLICY messages_insert_own ON public.messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND c.user_id = auth.uid()
    )
  );

-- user_settings: full access, but only to your own settings row.
DROP POLICY IF EXISTS user_settings_all_own ON public.user_settings;
CREATE POLICY user_settings_all_own ON public.user_settings
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- usage_records: users may only READ their own usage. No INSERT/UPDATE/
-- DELETE policy exists for end users on purpose — usage is written
-- server-side with the service-role key, which bypasses RLS.
DROP POLICY IF EXISTS usage_records_select_own ON public.usage_records;
CREATE POLICY usage_records_select_own ON public.usage_records
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================================================
-- How to apply (once a Supabase project exists — NOT done in Phase 2.6)
-- ============================================================================
-- Option A — Supabase dashboard: open the SQL Editor, paste this file,
--            and run it.
-- Option B — Supabase CLI (from the project root, after `supabase link`
--            to a real project):
--              supabase db push
--            The file already lives at the conventional path
--            `supabase/migrations/<timestamp>_nexora_phase2_init.sql`.
--
-- Verify afterwards (SQL Editor):
--   SELECT tablename FROM pg_tables
--     WHERE schemaname = 'public'
--     ORDER BY tablename;
--   -- expect: conversations, messages, profiles, user_settings,
--   --         usage_records
--   SELECT table_name, rowsecurity FROM pg_tables
--     JOIN information_schema.tables USING (table_name)
--     WHERE table_name IN
--       ('profiles','conversations','messages','user_settings','usage_records');
--   -- expect: rowsecurity = true for all five tables.
--
-- No seed data is included, and none should be added here: rows are
-- created by real users through the app once auth and the API are wired
-- up in later phases.
-- ============================================================================
