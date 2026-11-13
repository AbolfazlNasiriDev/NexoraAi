/**
 * Database row types (Phase 2.6).
 *
 * TypeScript mirrors of the tables created by
 * `supabase/migrations/20261113000000_nexora_phase2_init.sql` and
 * later migrations (`..._hardening.sql` in 2.11,
 * `..._profile_email_nullable.sql` in 2.11.2 — `ProfileRow.email`
 * is nullable since v3).
 *
 * - Types ONLY: there is no database client in this project yet, no
 *   connection is opened, and nothing here talks to Supabase. The types
 *   exist so future server code (Phases 2.7+) can be written against the
 *   real schema without guessing column names or shapes.
 * - Field names are snake_case and identical to the SQL columns.
 * - `timestamptz` columns come back as ISO 8601 strings, so they are
 *   typed as `string` here.
 * - `MessageRow.role` reuses `ChatRole` from `src/types/chat.ts`, so the
 *   API role values and the stored role values can never drift apart.
 */

import type { ChatRole } from "@/types/chat";

/**
 * `public.profiles` — one row per authenticated user.
 * `id` is the Supabase Auth user id (`auth.users.id`).
 * `email` is nullable since Phase 2.11.2 (v3 migration): a phone-only
 * signup (or an OAuth provider that returns no email) has no email
 * to store. The UNIQUE constraint still applies to real emails —
 * PostgreSQL allows multiple NULLs under UNIQUE.
 */
export interface ProfileRow {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

/** `public.conversations` — a user's chat sessions. */
export interface ConversationRow {
  id: string;
  user_id: string;
  title: string;
  /** Registry model id, e.g. "gpt-4o". Plain text reference, not a FK. */
  model_id: string;
  created_at: string;
  updated_at: string;
}

/**
 * `public.messages` — append-only chat turns.
 * Token counts are `null` when the provider did not report usage.
 */
export interface MessageRow {
  id: string;
  conversation_id: string;
  role: ChatRole;
  content: string;
  input_tokens: number | null;
  output_tokens: number | null;
  created_at: string;
}

/**
 * `public.user_settings` — per-user preferences, one row per user.
 * `theme` is light-only by product decision (enforced by a CHECK
 * constraint in the migration).
 */
export interface UserSettingsRow {
  user_id: string;
  /** Registry model id, or null when the user has not chosen one. */
  preferred_model: string | null;
  theme: "light";
  notifications_enabled: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * `public.usage_records` — one row per completed provider reply.
 * `conversation_id` is null when the conversation was deleted
 * (ON DELETE SET NULL keeps the accounting row).
 */
export interface UsageRecordRow {
  id: string;
  user_id: string;
  conversation_id: string | null;
  model_id: string;
  input_tokens: number;
  output_tokens: number;
  created_at: string;
}

/**
 * Plain type map of the Nexora schema: table name → row type.
 * This is NOT a supabase-js `Database` generic — no Supabase client is
 * installed, and this map must not be passed to one. It exists so code
 * can refer to a table's row shape by name, e.g.
 * `Database["messages"]`.
 */
export interface Database {
  profiles: ProfileRow;
  conversations: ConversationRow;
  messages: MessageRow;
  user_settings: UserSettingsRow;
  usage_records: UsageRecordRow;
}

/** The five table names in the Nexora schema. */
export type DatabaseTableName = keyof Database;
