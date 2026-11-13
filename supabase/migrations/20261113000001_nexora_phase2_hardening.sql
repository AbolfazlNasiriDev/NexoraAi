-- ============================================================================
-- Nexora AI — Phase 2.11: Database & Supabase migration hardening
-- ============================================================================
-- Second migration. Applies AFTER
-- `20261113000000_nexora_phase2_init.sql` (v1) and fixes the problems the
-- Phase 2 technical audit found in v1. It does NOT edit v1: v1 is already
-- pushed history and may already have been applied somewhere, so this
-- file must fix a database that already applied v1, and must also be
-- safe on a fresh database that applies v1 then v2 in order.
--
-- What this file does (and nothing else):
--   1. Least-privilege GRANTs for the five tables (v1 had none — RLS
--      policies alone grant nothing, so every query would have failed
--      with "permission denied" on first apply).
--   2. An `auth.users` trigger that creates a profile row on sign-up
--      (v1 had no way to create a profile: no INSERT policy, no
--      trigger — so the FK chains depending on `profiles.id` could
--      never start).
--   3. Missing CHECK constraints on `messages` (token counts >= 0,
--      content not blank).
--
-- What this file does NOT do:
-- - No table/column is created, dropped, renamed, or retyped.
-- - No v1 policy is rewritten (they were reviewed and are correct).
-- - No seed data: this migration creates ZERO rows by itself.
-- - No Supabase client, auth flow, or server query code is added here.
--
-- IMPORTANT: This migration has NOT been executed against a live
-- database yet. No Supabase project is connected to this repository.
-- It is verified structurally only (see `src/lib/server/migration.test.ts`
-- and `docs/database.md`). The first live run must be on a THROWAWAY
-- Supabase project, not production.
--
-- Privilege note: the `auth.users` trigger in section 2 must be created
-- by a privileged role (Supabase SQL Editor / postgres). It will not
-- work from a restricted client connection.
--
-- Re-run safety: REVOKE / GRANT are naturally idempotent; the function
-- uses CREATE OR REPLACE, the trigger uses DROP TRIGGER IF EXISTS, and
-- each new CHECK is added only when its pg_constraint row is absent,
-- so re-running this file never errors on objects that already exist.
--
-- GRANTs alone do NOT replace RLS. RLS stays enabled on all five
-- tables (from v1) and is the actual access control; the GRANTs below
-- only give roles the underlying table privilege that RLS policies
-- are then checked against. A role with a GRANT but no matching policy
-- still sees nothing.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Least-privilege GRANTs
-- ----------------------------------------------------------------------------
-- Start from a clean slate: revoke everything from the roles that must
-- not have it, then grant exactly what each table needs to `authenticated`
-- and nothing to `anon` or PUBLIC. `service_role` is deliberately left
-- untouched: it bypasses RLS by design and already has the access it
-- needs (it is the only role that writes `usage_records`).
--
-- Per-table intent (enforced by the RLS policies from v1 on top):
-- - profiles:       SELECT, UPDATE — own row only. NO INSERT: profiles
--                    are created only by the trigger (section 2) and the
--                    service role, so a user can never forge a profile
--                    row for someone else (no user_id spoofing).
-- - conversations:  SELECT, INSERT, UPDATE, DELETE — own rows only.
-- - messages:       SELECT, INSERT — own conversations only. NO UPDATE /
--                    DELETE: messages are append-only.
-- - user_settings:  SELECT, INSERT, UPDATE, DELETE — own row only
--                    (upsert needs INSERT + UPDATE).
-- - usage_records:  SELECT only. NO INSERT / UPDATE / DELETE for
--                    `authenticated`: usage is written server-side with
--                    the service-role key only.
-- - anon:           NOTHING on any table. Anonymous callers match no
--                    RLS policy either, so they see nothing at all.
-- ----------------------------------------------------------------------------

REVOKE ALL ON TABLE public.profiles FROM PUBLIC;
REVOKE ALL ON TABLE public.profiles FROM anon;
REVOKE ALL ON TABLE public.profiles FROM authenticated;

REVOKE ALL ON TABLE public.conversations FROM PUBLIC;
REVOKE ALL ON TABLE public.conversations FROM anon;
REVOKE ALL ON TABLE public.conversations FROM authenticated;

REVOKE ALL ON TABLE public.messages FROM PUBLIC;
REVOKE ALL ON TABLE public.messages FROM anon;
REVOKE ALL ON TABLE public.messages FROM authenticated;

REVOKE ALL ON TABLE public.user_settings FROM PUBLIC;
REVOKE ALL ON TABLE public.user_settings FROM anon;
REVOKE ALL ON TABLE public.user_settings FROM authenticated;

REVOKE ALL ON TABLE public.usage_records FROM PUBLIC;
REVOKE ALL ON TABLE public.usage_records FROM anon;
REVOKE ALL ON TABLE public.usage_records FROM authenticated;

GRANT SELECT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.conversations TO authenticated;
GRANT SELECT, INSERT ON TABLE public.messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_settings TO authenticated;
GRANT SELECT ON TABLE public.usage_records TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. Automatic profile creation on sign-up
-- ----------------------------------------------------------------------------
-- Why a trigger, and why NO profiles INSERT policy:
-- `profiles.id` IS the auth user id, so a profile row must exist the
-- moment a user signs up — otherwise every FK chain that starts at
-- `profiles.id` (conversations, settings, usage) can never be used.
-- An INSERT policy would let any signed-in user insert a profile row
-- with ANY id, including another user's id (user_id spoofing). Instead
-- only two paths can create a profile row:
--   (a) this trigger — SECURITY DEFINER, runs as its owner and bypasses
--       RLS, and can only ever insert the row for NEW.id, the user who
--       actually just signed up; and
--   (b) the service-role key, server-side (bypasses RLS by design).
-- Users keep SELECT + UPDATE on their own row only (v1 policies).
--
-- Why the EXCEPTION guard: sign-up must NEVER fail because of a
-- profile problem. If the insert fails for any reason (e.g. a user
-- signed up with a method that provides no email — `profiles.email`
-- is NOT NULL, so a phone-only signup has nothing to store), the
-- failure is swallowed with a WARNING and the `auth.users` row is
-- still created. The missing profile is then visible in the Postgres
-- logs and can be backfilled server-side; the user can still sign in.
--
-- Minimal data only: id + email. No metadata payload, no display
-- name, no avatar — nothing unnecessary is copied out of auth.users.
-- Duplicate-proof: ON CONFLICT (id) DO NOTHING — a profile can never
-- be created twice, even if the trigger somehow fires twice.
--
-- `SET search_path = ''` (and schema-qualified `public.profiles`) is
-- a security requirement for SECURITY DEFINER functions: without it,
-- an attacker who can create objects in a schema earlier in the
-- search path could hijack the function.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  BEGIN
    INSERT INTO public.profiles (id, email)
    VALUES (NEW.id, NEW.email)
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user: could not create profile for user %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 3. Missing CHECK constraints on `messages`
-- ----------------------------------------------------------------------------
-- v1 left two gaps that `usage_records` did not have:
-- - `input_tokens` / `output_tokens` are nullable integers with no
--   lower bound, so a negative token count was storable. NULL still
--   passes a CHECK (NULL is not false), which matches the existing
--   nullable design — nullability and defaults are NOT changed here,
--   so no valid existing row is rejected.
-- - `content` only had `CHECK (char_length(content) > 0)`, which
--   passes whitespace-only text ("   "). The new CHECK is stricter
--   and additive; the v1 CHECK is left in place.
-- Each ADD is guarded by a pg_constraint lookup (scoped to the table
-- via conrelid), so re-running this file never errors with
-- "constraint already exists". On a database that already holds
-- violating rows, ADD CONSTRAINT will fail by design — those rows must
-- be cleaned up before applying, never silently accepted.
--
-- Deliberately NOT added here (reviewed, left out on purpose):
-- - `conversations.title` / `model_id` blank checks: the app always
--   sets them through validated API input; a DB-level btrim CHECK
--   could reject rows a future legitimate flow writes (e.g. an
--   explicitly empty title meaning "untitled"). Revisit if the app
--   ever writes these columns without validation.
-- - `user_settings.preferred_model` value check: model ids live in
--   the app registry, not in the database — there is nothing in SQL
--   to check them against.
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'messages_input_tokens_nonneg'
      AND conrelid = 'public.messages'::regclass
  ) THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_input_tokens_nonneg
      CHECK (input_tokens >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'messages_output_tokens_nonneg'
      AND conrelid = 'public.messages'::regclass
  ) THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_output_tokens_nonneg
      CHECK (output_tokens >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'messages_content_nonblank'
      AND conrelid = 'public.messages'::regclass
  ) THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_content_nonblank
      CHECK (char_length(btrim(content)) > 0);
  END IF;
END $$;

-- ============================================================================
-- How to apply (once a Supabase project exists — NOT done in Phase 2.11)
-- ============================================================================
-- Apply v1 first, then this file, in order (Supabase CLI runs them by
-- timestamp; the dashboard SQL Editor needs both pasted in order).
-- First live run must be a THROWAWAY Supabase project, never
-- production.
--
-- Verify afterwards (SQL Editor):
--   -- GRANTs: expect exactly the matrix from section 1, nothing to anon.
--   SELECT grantee, privilege_type
--     FROM information_schema.role_table_grants
--     WHERE table_schema = 'public'
--       AND table_name IN
--         ('profiles','conversations','messages','user_settings','usage_records')
--     ORDER BY table_name, grantee, privilege_type;
--   -- Trigger: expect one row, on_auth_user_created on auth.users.
--   SELECT trigger_name, event_object_table
--     FROM information_schema.triggers
--     WHERE trigger_name = 'on_auth_user_created';
--   -- CHECKs: expect the three new constraints on messages.
--   SELECT conname FROM pg_constraint
--     WHERE conrelid = 'public.messages'::regclass
--       AND conname LIKE 'messages_%';
--   -- Profile creation: create a test user in Auth and check that a
--   -- matching public.profiles row appears (and that signing up a
--   -- second user never creates a duplicate).
-- ============================================================================
