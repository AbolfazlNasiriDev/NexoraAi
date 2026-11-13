-- ============================================================================
-- Nexora AI — Phase 2.11.2: profiles.email nullable + loud trigger failures
-- ============================================================================
-- Third migration. Applies AFTER
-- `20261113000000_nexora_phase2_init.sql` (v1) and
-- `20261113000001_nexora_phase2_hardening.sql` (v2). It does NOT edit
-- v1 or v2: both are reviewed history, so fixes live only here.
--
-- Why this file exists (Phase 2.11.1 final review, Option A):
-- v1 defined `profiles.email` as `text NOT NULL UNIQUE`, and v2's
-- `handle_new_user()` wrapped its INSERT in `EXCEPTION WHEN OTHERS`
-- that swallowed every failure as a WARNING so sign-up would never
-- fail. For a phone-only (or OAuth-no-email) signup, `NEW.email` is
-- NULL, so the INSERT violated NOT NULL, was swallowed, and the user
-- ended up able to sign in but with zero profile rows — every FK
-- chain starting at `profiles.id` (conversations, settings, usage)
-- then failed, and no recovery path existed anywhere in the repo.
-- That is exactly the silent failure the project forbids: an error
-- swallowed only to make sign-up look successful, with no reliable,
-- documented recovery path behind it.
--
-- What this file does (and nothing else):
--   1. Makes `profiles.email` nullable (DROP NOT NULL). Email is
--      genuinely optional data — a phone signup has no email — so
--      the column must reflect that. The UNIQUE constraint stays:
--      PostgreSQL allows multiple NULLs under a UNIQUE constraint,
--      so NULL emails never collide with each other.
--   2. Replaces `handle_new_user()` with a log-and-re-raise guard:
--      the failure is still logged (WARNING with user id + SQLERRM)
--      but the error is re-raised, so the `auth.users` insert fails
--      LOUDLY instead of silently leaving a broken user. With email
--      nullable, the only remaining insert failures are config/infra
--      errors (missing table, lost privileges) and a duplicate-email
--      UNIQUE violation — exactly the failures that MUST be loud.
--   3. Revokes PUBLIC's EXECUTE privilege on the trigger function,
--      so it cannot be called directly by arbitrary roles (see the
--      note in section 3).
--
-- What this file does NOT do:
-- - No table/column is created, dropped, renamed, or retyped (only
--   the NOT NULL constraint on one column is dropped).
-- - No v1/v2 policy, GRANT, or CHECK is touched. No trigger is
--   created or dropped: the v2 trigger `on_auth_user_created` stands
--   unchanged — only the function body it calls is replaced, so no
--   DROP/CREATE TRIGGER is needed.
-- - No seed data: this migration creates ZERO rows by itself.
-- - v2's comments about the phone case are SUPERSEDED by this file:
--   the phone case no longer fails at all (the profile is created
--   with email NULL), and the "backfilled server-side" sentence in
--   v2's header is no longer the plan for that case.
--
-- Same-role requirement (found in the 2.11.1 review): v1, v2 and v3
-- must be run by the SAME privileged role (Supabase SQL Editor /
-- postgres). `handle_new_user()` is SECURITY DEFINER, so it runs as
-- its owner, and the owner needs INSERT on `public.profiles`. If a
-- different role applies v3, the function owner changes and the
-- trigger may lose its ability to insert profiles.
--
-- IMPORTANT: This migration has NOT been executed against a live
-- database yet. No Supabase project is connected to this repository.
-- It is verified structurally only (see
-- `src/lib/server/migration.test.ts` and `docs/database.md`) plus a
-- real-parser syntax check (pglast / libpg_query — see the test
-- file header). The first live run must be on a THROWAWAY Supabase
-- project, not production.
--
-- Re-run safety: `ALTER COLUMN ... DROP NOT NULL` is idempotent —
-- re-running it on an already-nullable column succeeds as a no-op.
-- `CREATE OR REPLACE FUNCTION` replaces the body; the REVOKE is
-- naturally idempotent.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. profiles.email becomes nullable
-- ----------------------------------------------------------------------------
-- Email is optional data: a phone-only signup (or an OAuth provider
-- that returns no email) has no email to store. Keeping NOT NULL
-- made that signup deterministically produce a profile-less user
-- (see the header). The UNIQUE constraint is intentionally KEPT:
-- PostgreSQL treats NULLs as distinct under UNIQUE, so any number of
-- NULL-email profiles can coexist and a real email still cannot be
-- shared by two profiles.
-- ----------------------------------------------------------------------------

ALTER TABLE public.profiles ALTER COLUMN email DROP NOT NULL;

-- ----------------------------------------------------------------------------
-- 2. handle_new_user(): log-and-re-raise instead of swallow-all
-- ----------------------------------------------------------------------------
-- Same signature, same SECURITY DEFINER + empty search_path, same
-- INSERT (id, email) with ON CONFLICT (id) DO NOTHING. The only
-- change is the error handling: the WARNING is still raised for
-- diagnostics (user id + SQLERRM in the Postgres log), but the error
-- is then RE-RAISED with a bare RAISE, so it propagates and the
-- `auth.users` insert fails LOUDLY. A legitimate signup can no
-- longer fail here (email is nullable since section 1), so anything
-- that still fails is a real misconfiguration — missing table, lost
-- privileges, duplicate-email UNIQUE violation — and must never be
-- swallowed into a silent, profile-less user.
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
    RAISE;
  END;
  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. Revoke PUBLIC's EXECUTE privilege on the trigger function
-- ----------------------------------------------------------------------------
-- The function takes no arguments and reads only NEW, so a direct
-- call could never forge an id — but there is no reason for arbitrary
-- roles to be able to call it at all (before this revoke, a direct
-- call only produced WARNING log spam). Revoking EXECUTE from PUBLIC
-- stops direct calls; the trigger itself keeps working, because
-- EXECUTE on a trigger function is checked only for the role that
-- CREATES the trigger, not when the trigger fires:
--
-- - PostgreSQL 18, CREATE TRIGGER docs
--   (https://www.postgresql.org/docs/current/sql-createtrigger.html):
--   "To create or replace a trigger on a table, the user must have
--   the TRIGGER privilege on the table. The user must also have
--   EXECUTE privilege on the trigger function." — a creation-time
--   requirement; nothing in the page imposes a firing-time check.
-- - PostgreSQL mailing-list discussion of the status quo
--   (https://www.postgresql.org/message-id/b1be2d05-b9fd-b9db-ea7f-38253e4e4bab%40anastigmatix.net):
--   "EXECUTE on the function checked at for the trigger's creator
--   at creation time, but not at run time."
--
-- The trigger `on_auth_user_created` was already created in v2 (by
-- the same privileged role), so this revoke does not affect it. The
-- function owner keeps EXECUTE implicitly (owners always hold all
-- privileges on their own objects). The throwaway run MUST still
-- confirm that a sign-up after this revoke creates exactly one
-- `profiles` row — if firing ever did require EXECUTE, the revoke
-- would break sign-ups loudly (the new log-and-re-raise guard makes
-- that failure visible instead of silent), and the revoke would have
-- to be dropped.
-- ----------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;

-- ============================================================================
-- How to apply (once a Supabase project exists — NOT done in Phase 2.11.2)
-- ============================================================================
-- Apply v1 first, then v2, then this file, in order (Supabase CLI runs
-- them by timestamp; the dashboard SQL Editor needs all three pasted
-- in order). First live run must be a THROWAWAY Supabase project,
-- never production.
--
-- Verify afterwards (SQL Editor):
--   -- Column: expect is_nullable = 'YES' for profiles.email.
--   SELECT column_name, is_nullable
--     FROM information_schema.columns
--     WHERE table_schema = 'public'
--       AND table_name = 'profiles'
--       AND column_name = 'email';
--   -- Function: expect the log-and-re-raise guard in the body.
--   SELECT pg_get_functiondef('public.handle_new_user()'::regprocedure);
--   -- EXECUTE: expect false for anon and authenticated.
--   SELECT has_function_privilege('anon', 'public.handle_new_user()', 'EXECUTE');
--   SELECT has_function_privilege('authenticated', 'public.handle_new_user()', 'EXECUTE');
--   -- Phone / no-email signup: sign up a user with no email and
--   -- check that exactly one public.profiles row appears with
--   -- email IS NULL — this is the case v2 failed silently.
--   -- Second user: sign up another user and confirm no duplicate
--   -- profile row is ever created (ON CONFLICT).
--   -- Loud failure: only if safely testable on the throwaway — a
--   -- misconfiguration-style failure (e.g. a duplicate-email
--   -- signup, if reachable) must now fail the signup loudly
--   -- instead of leaving a profile-less user.
-- ============================================================================
