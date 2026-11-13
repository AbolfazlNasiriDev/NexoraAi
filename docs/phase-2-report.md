# Nexora AI — Phase 2 Final Report

**Backend Architecture & AI Infrastructure**

| | |
| --- | --- |
| Project | Nexora AI (`AbolfazlNasiriDev/NexoraAi`, `main` branch) |
| Stack | Next.js 16.4.6 (App Router, `--src-dir`), TypeScript, Tailwind CSS v4, React 19.3, Framer Motion, Lucide |
| Phase 2 scope | Subphases 2.1–2.9, built on the completed Phase 1 frontend |
| Date | 2026-11-13 |
| Status | **Complete.** Every subphase built, verified, and pushed to GitHub. |

---

## 1. Summary

Phase 2 set out to give the Phase 1 frontend a real backend: Next.js Route
Handlers, a shared provider interface and model registry for future OpenAI,
Google Gemini and Anthropic Claude connections, a chat endpoint, a models
endpoint, frontend integration, a Supabase/PostgreSQL schema, environment
configuration, automated tests, and this final report.

What was delivered is exactly that — **infrastructure, not a live AI
connection**. No API key exists, no provider SDK is installed, no Supabase
project exists, and no fake AI reply is ever produced. With nothing
configured, the app builds and runs, the health endpoint reports every
provider as `not_configured`, and a valid chat request answers with an
honest `503` instead of a fabricated reply.

### Subphase status

| Subphase | What it delivered | Commit |
| --- | --- | --- |
| 2.1 Backend Foundation | Server-only env/errors/response envelope, `GET /api/v1/health` | `519d871d` |
| 2.2 AI Provider Architecture | `AIProvider` interface, provider stubs, registry, gateway | `1e30525b` |
| 2.3 Chat API | `POST /api/v1/chat` with strict hand-written validation | `ed54c6d1` |
| 2.4 Model Management API | `GET /api/v1/models` from the registry | `ae06897d` |
| 2.5 Frontend Integration | Chat client, real model list, error/loading message states | `2b00cb91` |
| 2.6 Database Architecture | Supabase migration (5 tables, RLS), DB row types, docs | `92faa4e7` |
| 2.7 Environment Configuration | `.env.example`, required/optional validation, `.gitignore` fix | `f8b64fde` |
| 2.8 Testing & QA | Vitest suite (48 tests), full live re-verification, docs | `1bb17e71` |
| 2.9 Final Report | This document | pending |

Every subphase was reported and approved by the user before the next one
started, and every file written or rewritten was pushed to GitHub.

---

## 2. Architecture

Phase 2 adds a small, layered backend on top of the untouched Phase 1
frontend. The layers, bottom to top:

- **Server-only foundation** (`src/lib/server/`) — `env.ts` reads
  environment variables (server-only guard via `import "server-only"`,
  secrets never logged or returned, only booleans leave the module);
  `errors.ts` defines `ApiError` and typed factories
  (`providerNotConfiguredError` → 503, validation → 400, …);
  `response.ts` defines the single response envelope
  (`{ success, data }` / `{ success: false, error: { code, message,
  details? } }`) and the `withErrorHandling` route wrapper. Every API
  response in the app uses this envelope.
- **AI provider layer** (`src/lib/ai/`) — `provider.ts` is the shared
  `AIProvider` contract (`id`, `displayName`, `isConfigured()`,
  `getModels()`, `chat()`, `chatStream()`, `identifyModel()`).
  `providers/base.ts` holds the shared plumbing (config check, live
  status derivation, error mapping); `providers/openai.ts`,
  `gemini.ts`, `anthropic.ts` are thin **stubs** — they declare their
  models and refuse to chat until a real implementation exists.
  `registry.ts` (`ModelRegistry`) is the single source of truth for
  which models exist; `gateway.ts` (`AIGateway`) is the single entry
  point for chat — it resolves the model, rejects unknown ids with a
  400, and returns the standard 503 when the provider has no key.
- **Validation** (`src/lib/validation/chat.schema.ts`) — hand-written,
  no dependency: 1–50 messages, 1–8000 chars per message after
  trimming, roles `user` / `assistant` / `system`, at least one user
  message, last message must be `user`, strict unknown-field rejection,
  `modelId`/`conversationId` length limits (128 chars). Error details
  carry only field pointers, never user content.
- **Route Handlers** (`src/app/api/v1/`) — `health`, `chat` (POST
  only), `models` (GET only). Wrong methods return 405.
- **Chat client** (`src/lib/api/chat-client.ts`) — client-safe (no
  `server-only` import, no secrets): `sendChatMessage()`,
  `fetchModels()`, typed `ApiClientError` (`status`, `code`,
  `message`), `isProviderNotConfiguredError()`, and `parseSseStream()`
  prepared for a future streaming endpoint (uncalled today).
- **Database schema** (`supabase/migrations/…`, `src/types/database.ts`)
  — schema and types only; no client, no connection, no queries.

### Request flow (today)

```text
Browser (page.tsx)
  │  user sends a message
  ▼
src/lib/api/chat-client.ts  (sendChatMessage)
  │  POST /api/v1/chat  { modelId, messages }
  ▼
src/app/api/v1/chat/route.ts
  │  validate body (chat.schema.ts) ── invalid ──▶ 400 VALIDATION_ERROR
  ▼
src/lib/ai/gateway.ts
  │  resolve model in ModelRegistry ── unknown ──▶ 400 "Unknown model: …"
  ▼
src/lib/ai/providers/<openai|gemini|anthropic>.ts  (stub)
  │  isConfigured()? No key → 503 PROVIDER_NOT_CONFIGURED
  │  "AI provider is not configured yet."
  ▼
Error bubble in the thread (rose-tinted, code chip) — never a fake reply
```

### What is real vs. what is a stub

| Real (works today) | Stub / not built |
| --- | --- |
| Envelope, error handling, validation, routing, health, models listing, frontend send flow and error display, unit tests | Provider `chat()` / `chatStream()` (throw "not implemented" when configured), streaming endpoint (does not exist), Supabase client/auth/queries (do not exist), persistence (no data is stored) |

---

## 3. Files created & changed

File lists were verified against the real tree (`find src supabase docs`
+ root listing). Measured totals at the end of Phase 2: **43 files under
`src/`** and **65 project files** in total (excluding `node_modules/`,
`.next/`, `.git`; including this report). Phase 2 added **27 files under
`src/`** (5 + 9 + 3 + 1 + 2 + 1 + 0 + 6) and **7 files outside `src/`**
(migration, 4 docs, `.env.example`, `vitest.config.ts`); 4 more files
outside `src/` were modified (`README.md`, `.gitignore`,
`package.json`, `package-lock.json`).

> Note on counts: an earlier working note recorded "31 files after
> Phase 1" and "48 after 2.6". Those numbers do not reconcile with the
> real tree (16 files under `src/` at the end of Phase 1, 43 at the end
> of Phase 2). The counts in this report are the measured ones; the
> earlier note's arithmetic was wrong, not the tree.

### 2.1 Backend Foundation — 5 new files

| File | Purpose |
| --- | --- |
| `src/lib/server/env.ts` | Server-only env config, provider detection |
| `src/lib/server/errors.ts` | `ApiError` + typed error factories |
| `src/lib/server/response.ts` | Response envelope + `withErrorHandling` |
| `src/types/api.ts` | Envelope and error-code types |
| `src/app/api/v1/health/route.ts` | `GET /api/v1/health` |

Modified: `README.md` (backend section). New dependency:
`server-only@^0.0.1` (required for the `import "server-only"` guard).

### 2.2 AI Provider Architecture — 9 new files

| File | Purpose |
| --- | --- |
| `src/lib/ai/provider.ts` | Shared `AIProvider` interface |
| `src/lib/ai/types.ts` | Provider-neutral chat/stream types |
| `src/types/ai.ts` | Public model types (`ModelInfo`, `ModelStatus`) |
| `src/lib/ai/providers/base.ts` | Shared provider plumbing |
| `src/lib/ai/providers/openai.ts` | OpenAI stub (declares gpt-4o, gpt-4o-mini) |
| `src/lib/ai/providers/gemini.ts` | Gemini stub (declares gemini-2.0-flash, gemini-1.5-pro) |
| `src/lib/ai/providers/anthropic.ts` | Anthropic stub (declares claude-sonnet-4, claude-3-5-sonnet) |
| `src/lib/ai/registry.ts` | `ModelRegistry` — single source of truth for models |
| `src/lib/ai/gateway.ts` | `AIGateway` — single chat entry point |

Modified: `README.md` (providers section). No new dependencies, no SDKs.

### 2.3 Chat API — 3 new files

| File | Purpose |
| --- | --- |
| `src/app/api/v1/chat/route.ts` | `POST /api/v1/chat` (POST only) |
| `src/lib/validation/chat.schema.ts` | Hand-written request validation + limits |
| `src/types/chat.ts` | Chat request/response types (aliases `AiRole`/`AiMessage`) |

Modified: `README.md` (chat API section). No new dependencies.

### 2.4 Model Management API — 1 new file

| File | Purpose |
| --- | --- |
| `src/app/api/v1/models/route.ts` | `GET /api/v1/models`, reads only from the registry |

Modified: `README.md` (models section). No new dependencies.

### 2.5 Frontend Integration — 2 new files, 8 modified

| File | Change |
| --- | --- |
| `src/lib/api/chat-client.ts` | **New.** `sendChatMessage`, `fetchModels`, `ApiClientError`, `parseSseStream` (prepared, uncalled) |
| `src/types/conversation.ts` | **New.** `Conversation`, `UiMessage` (`user` / `assistant` / `error` / `loading`) |
| `src/components/home/ModelSelector.tsx` | Rewritten: fetches real models, loading/error/loaded states, "Not configured" badges |
| `src/components/home/ChatMessages.tsx` | Rewritten: user / loading / error / assistant bubbles |
| `src/components/home/PromptInput.tsx` | `isSending` state (disabled + spinner); files stay local-only |
| `src/app/page.tsx` | Wired send flow: user → loading → real reply or error bubble |
| `src/lib/data.ts` | Display-model list and old chat type removed |
| `src/components/layout/TopBar.tsx` | Badge now "Phase 2 · API" |
| `src/components/layout/Sidebar.tsx` | Copy only: "Unlock Nexora 1.0 Pro" → "Unlock Nexora Pro" |
| `README.md` | Frontend integration section |

No new dependencies. No `dark:` classes; "Nexora 1.0" survives only in
explanatory comments.

### 2.6 Database Architecture — 3 new files, 1 modified

| File | Purpose |
| --- | --- |
| `supabase/migrations/20261113000000_nexora_phase2_init.sql` | Initial migration, 265 lines, 5 tables, re-runnable, zero seed rows |
| `src/types/database.ts` | Row types mirroring the SQL 1:1 |
| `docs/database.md` | Schema doc: ERD, index rationale, RLS model |
| `README.md` | Modified: database section |

No Supabase client installed, no keys or URLs.

### 2.7 Environment Configuration — 2 new files, 3 modified

| File | Purpose |
| --- | --- |
| `.env.example` | Template: all 8 variables, every secret value empty |
| `docs/environment.md` | Environment guide (table, setup, rules) |
| `src/lib/server/env.ts` | Modified (additive): `REQUIRED_ENV_VARS`, `OPTIONAL_ENV_VARS`, `validateEnv()`, `isSupabaseConfigured()` |
| `.gitignore` | Modified: blanket `.env*` replaced with explicit `.env` / `.env.local` / `.env.*.local` so `.env.example` stays committable |
| `README.md` | Modified: environment section |

No `.env.local` created, no real keys, no Supabase client.

### 2.8 Testing & QA — 8 new files, 3 modified

| File | Purpose |
| --- | --- |
| `vitest.config.ts` | Vitest config (`@/*` alias, `react-server` condition for `server-only`) |
| `src/lib/validation/chat.schema.test.ts` | 15 tests — validation rules |
| `src/lib/server/errors.test.ts` | 8 tests — error factories + envelope |
| `src/lib/server/env.test.ts` | 4 tests — env defaults, `validateEnv()`, Supabase detection |
| `src/lib/ai/registry.test.ts` | 6 tests — 6 models, all `not_configured` |
| `src/lib/ai/gateway.test.ts` | 5 tests — 400s and the 503 path |
| `src/lib/api/chat-client.test.ts` | 10 tests — client envelope + SSE parser (stubbed `fetch`) |
| `docs/testing.md` | Testing guide, coverage table, honest limits |
| `package.json` | Modified: `"test": "vitest run"` script |
| `package-lock.json` | Modified: Vitest install |
| `README.md` | Modified: testing section |

New dependency: `vitest@3.2.7` (devDependency, exact pin). No production
code changed.

### 2.9 Final Report — 1 new file, 1 modified

| File | Purpose |
| --- | --- |
| `docs/phase-2-report.md` | This document |
| `README.md` | Modified: link to this report |

### Dependencies added in Phase 2 (verified in `package.json`)

| Package | Version | Scope | Added in |
| --- | --- | --- | --- |
| `server-only` | `^0.0.1` | runtime | 2.1 (required for the server-only guard) |
| `vitest` | `3.2.7` (exact) | dev only | 2.8 (test runner) |

No other package version was changed in Phase 2.

---

## 4. Endpoints

All three endpoints use the standard envelope and return `405` for
unsupported methods.

| Method | Path | Success today | Error behaviour |
| --- | --- | --- | --- |
| `GET` | `/api/v1/health` | `200` — `{ status: "ok", app: "Nexora AI", version: "2.1.0-phase2.1", timestamp, providers: { openai, gemini, anthropic } }`, all providers `not_configured` | `POST` → `405` |
| `GET` | `/api/v1/models` | `200` — `{ models: [6 × ModelInfo], total: 6, availableCount: 0 }`, every model `not_configured`, no "Nexora 1.0" in the body | `POST` → `405` |
| `POST` | `/api/v1/chat` | No success path yet: a valid request returns `503` `{ code: "PROVIDER_NOT_CONFIGURED", message: "AI provider is not configured yet." }` — never a fabricated reply | Validation failures → `400 VALIDATION_ERROR` (unknown model, empty/51 messages, >8000 chars, bad role, last message not `user`, malformed JSON, missing `modelId`); `GET` → `405`; a configured-but-unimplemented provider would fail with a loud generic `500` |

Validation limits (any violation → `400`): 1–50 messages, 1–8000
chars per message, roles `user` / `assistant` / `system`, at least one
user message, last message must be `user`, `modelId` required (≤128
chars), `conversationId` optional (≤128 chars), no unknown fields,
valid JSON.

---

## 5. Provider status

**No provider is connected. No model is available.**

| Model | Provider | Status |
| --- | --- | --- |
| `gpt-4o` | openai | `not_configured` |
| `gpt-4o-mini` | openai | `not_configured` |
| `gemini-2.0-flash` | gemini | `not_configured` |
| `gemini-1.5-pro` | gemini | `not_configured` |
| `claude-sonnet-4` | anthropic | `not_configured` |
| `claude-3-5-sonnet` | anthropic | `not_configured` |

- `listAvailableModels()` returns `[]`; `availableCount` is `0`.
- `chat()` / `chatStream()` throw `503 PROVIDER_NOT_CONFIGURED` when
  unconfigured, and throw a loud "not implemented" error if a key were
  set — never a fake reply.
- No provider SDK is installed and no API key exists anywhere in the
  repo.
- The Phase 1 display labels **Nexora 1.0 Pro / Nexora 1.0 / Nexora
  Lite are not real models**: they are no longer selectable in the UI
  and never appear in any API response. They survive only in
  explanatory code comments and in this report.

---

## 6. Database status

**Schema only — not connected.** The migration
`supabase/migrations/20261113000000_nexora_phase2_init.sql` (265 lines)
defines the full schema, but no Supabase project exists, no account
was used, and nothing in the repo connects to a database.

| Table | Purpose | Key facts |
| --- | --- | --- |
| `profiles` | One row per auth user (`id` = `auth.users.id`) | email `UNIQUE`; `updated_at` trigger |
| `conversations` | A user's chat sessions | `user_id` → profiles `CASCADE`; `title` default `'New chat'`; `model_id` plain text |
| `messages` | Turns in a conversation | Append-only; `role` CHECK `user`/`assistant`/`system`; `content` non-empty CHECK |
| `user_settings` | Per-user preferences | `user_id` is the PK; `theme` CHECK `= 'light'` (light-only enforced in the DB) |
| `usage_records` | Per-reply token accounting | Append-only; `conversation_id` → conversations `ON DELETE SET NULL`; token CHECKs ≥ 0 |

Counts (verified by reading the migration file): **5 tables, 7
indexes, RLS enabled on all 5 tables, 7 policies** (all scoped to
`auth.uid()`; `usage_records` is SELECT-only for end users — writes
are server-side with the service-role key). The migration is
re-runnable (`IF NOT EXISTS` / `DROP POLICY IF EXISTS`) and creates
**zero rows** — no seed data.

### Honest caveat

The SQL was **never executed against a live database**. No Supabase
project exists and no Postgres is available locally, so verification
was structural only (file read in full; counts confirmed). It may
contain a syntax or ordering problem that only a real run will reveal.
`src/types/database.ts` mirrors the SQL 1:1 as TypeScript row types.
No `@supabase/*` client is installed; no auth flow, repository layer,
or server query code exists.

---

## 7. Environment status

- `.env.example` holds all **8 variables**; all **6 secret values**
  are empty (verified by byte length, not by eye):
  `OPENAI_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`,
  `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
  The only set values are the public defaults
  `NEXT_PUBLIC_APP_NAME=Nexora AI` and
  `NEXT_PUBLIC_APP_URL=http://localhost:3000`.
- `REQUIRED_ENV_VARS` is **empty by design** — the app builds and runs
  with an entirely empty env. `OPTIONAL_ENV_VARS` lists the 6
  variables above; `validateEnv()` reports missing names only, never
  values; `isSupabaseConfigured()` is `false` today.
- `.env.local` is gitignored (`.env`, `.env.local`, `.env.*.local`)
  and no `.env.local` file exists in the project. `.env.example` is
  deliberately **not** ignored.
- Secrets are server-only: provider keys and the service-role key are
  read only through `src/lib/server/env.ts` and never reach the
  client. The only `NEXT_PUBLIC_` variables are the app name and URL.
- **No real key exists anywhere** in the repo (verified by grep in
  2.7 and 2.8).

---

## 8. Test results

### Unit suite — `npm test`: 48 / 48 passing

Vitest 3.2.7, 6 files, ~2 s, deterministic (no network, no keys, no
fake replies).

| Test file | Tests | Covers |
| --- | --- | --- |
| `src/lib/validation/chat.schema.test.ts` | 15 | Validation rules (valid, empty/51 messages, >8000 chars, bad role, last-not-user, missing modelId, unknown fields, malformed types) |
| `src/lib/server/errors.test.ts` | 8 | Error factories (503 exact message, 400/404/429/500), envelope, unknown → generic 500 |
| `src/lib/server/env.test.ts` | 4 | Defaults with nothing set, `validateEnv()`, Supabase detection (needs URL + anon key) |
| `src/lib/ai/registry.test.ts` | 6 | 6 models, all `not_configured`, zero available, no "Nexora 1.0" model |
| `src/lib/ai/gateway.test.ts` | 5 | Unknown/missing modelId → 400, empty messages → 400, known model → 503, streaming fails eagerly with 503 |
| `src/lib/api/chat-client.test.ts` | 10 | Client envelope with stubbed `fetch` (success, 503 → typed error, network error, invalid response, `fetchModels`, SSE parser) |

### Build & lint

`npm run build` and `npm run lint` both pass (verified after every
subphase, most recently in 2.8 and again after this report's README
edit in 2.9).

### Live endpoint suite — 15 cases, all correct (2.8)

Run by hand with `curl` against the dev server:

| # | Case | Result |
| --- | --- | --- |
| 1 | `GET /api/v1/health` | 200, providers all `not_configured` |
| 2 | `GET /api/v1/models` | 200, `total: 6`, `availableCount: 0`, all `not_configured` |
| 3 | `POST /api/v1/chat` (valid, gpt-4o) | 503 `PROVIDER_NOT_CONFIGURED`, "AI provider is not configured yet." |
| 4 | `POST /api/v1/chat` (unknown model) | 400 |
| 5 | `POST /api/v1/chat` (empty messages) | 400 |
| 6 | `POST /api/v1/chat` (51 messages) | 400 |
| 7 | `POST /api/v1/chat` (>8000 chars) | 400 |
| 8 | `POST /api/v1/chat` (bad role) | 400 |
| 9 | `POST /api/v1/chat` (last message not user) | 400 |
| 10 | `POST /api/v1/chat` (malformed JSON) | 400 |
| 11 | `POST /api/v1/chat` (missing modelId) | 400 |
| 12 | `GET /api/v1/chat` | 405 |
| 13 | `POST /api/v1/models` | 405 |
| 14 | `POST /api/v1/health` | 405 |
| 15 | `GET /` (homepage) | 200 |

### Security / honesty greps — 0 matches

- Key names (`OPENAI_API_KEY`, `GEMINI_API_KEY`,
  `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) in SSR homepage
  HTML: **0**. Key-shaped tokens (`sk-…`) in SSR HTML and in
  `.next/static`: **0**. (Broad `sk-` hits are Tailwind `mask-*`
  utility fragments from the Orb's radial-gradient class, not keys.)
- `"Nexora 1.0"` in the models response body: **0**. No model reports
  status `available`.
- Chat 503 body holds no assistant-style content.
- `dark:` variants in `src/`: **0**. The only `dark` match is the
  Phase 1 CSS token name `--color-nexora-primary-dark: #6a3fc4` in
  `src/app/globals.css` — a darker purple shade, not a dark-mode
  class. Light theme preserved.

---

## 9. Known limitations & potential problems

1. **Env-based status derivation (known since 2.2).** A model's
   status is derived from whether its key is set. If a key were set
   today, the registry would report the model `available` while
   `chat()` still throws "not implemented" — the gateway surfaces a
   loud generic 500, never a fake reply, but the status would be
   misleading until the provider is really implemented. Fixing this
   is the first step in §10.
2. **SQL migration never executed on a live database.** See §6. It
   may fail on first real application; apply it in a throwaway
   Supabase project first.
3. **No live provider tests.** No key exists, so no test ever calls
   OpenAI, Gemini, or Anthropic. The suite pins the *unconfigured*
   behaviour only.
4. **No E2E browser tests.** No Playwright or Cypress. The UI is
   checked by the live homepage request and manual preview;
   interaction tests (model switch, send flow, configuration panel)
   were never individually confirmed — the continuous orb animations
   made the preview probes time out.
5. **`parseSseStream` is prepared but uncalled.** No streaming
   endpoint exists; the helper is tested with stubbed responses only.
6. **Stale `.next` cache incident (2.7).** A temporary debug route
   was deleted, but the generated type cache in `.next/dev/types/`
   still referenced it and broke the next build. Fixed by deleting
   `.next` (it is gitignored and regenerates). Not a code bug, but a
   reminder: never leave generated caches in place after deleting a
   route — or just clear `.next` when a build fails with a
   "Cannot find module" for a file that no longer exists.
7. **Vitest 5.x could not be used.** `vitest@5.1.0` fails with
   `ERESOLVE` against the pinned `@types/node@^20`; `vitest@3.2.7`
   is pinned instead (no `--legacy-peer-deps`). Revisit when the
   Node types are upgraded.
8. **The frontend's `assistant` message kind is unreachable.** It
   exists in `src/app/page.tsx` (one occurrence) for real future
   replies only; until a provider is connected, the thread can only
   show user, loading, and error messages.
9. **Health version string is stale.** It still reads
   `"2.1.0-phase2.1"` — it was never bumped as subphases landed.
   Cosmetic only; the endpoint's shape and provider statuses are
   correct.
10. **`force-dynamic` is incompatible with this project's
    `cacheComponents: true`.** Found in 2.1: dynamic routes use
    `await headers()` instead of segment config. Do not reintroduce
    `export const dynamic = "force-dynamic"`.

---

## 10. Steps to connect a real API later

Nothing in this list is done in Phase 2, and none of it changes the
public API contract (`POST /api/v1/chat`, `GET /api/v1/models`,
`GET /api/v1/health`, the envelope, or the validation rules stay as
they are). Do the steps in order; each is user-approved separately.

1. **Create provider accounts and keys.** OpenAI, Google Gemini,
   and/or Anthropic — only the providers you actually want.
   No code touched.
2. **Set the keys locally.** `cp .env.example .env.local`, fill in
   only the keys you have, never commit `.env.local`. Files:
   `.env.local` (new, gitignored).
3. **Install the provider SDKs.** `npm install openai @google/genai
   @anthropic-ai/sdk` (or only the ones you need). Files:
   `package.json`, `package-lock.json`. No other versions change.
4. **Implement `chat()` and `chatStream()` in the three provider
   stubs** behind the existing `AIProvider` interface, using the
   SDK clients and the keys from `env.ts`. Files:
   `src/lib/ai/providers/openai.ts`, `gemini.ts`, `anthropic.ts`
   (and `base.ts` only if shared plumbing needs it). The interface,
   registry, gateway, routes, and validation do not change.
5. **Fix the env-based status caveat (§9.1).** Make a model's status
   reflect real capability — e.g. derive `available` from
   `isConfigured() && chatImplemented()` — so a key alone can never
   advertise a model that cannot answer. Files: `src/lib/ai/registry.ts`,
   `src/lib/ai/providers/base.ts`.
6. **Verify locally.** `npm test`, `npm run build`, `npm run lint`,
   then live `curl`: a valid `POST /api/v1/chat` should now return
   `200` with a real assistant reply, `GET /api/v1/models` should
   show the configured models as `available`, and `GET
   /api/v1/health` should report them configured. Check the reply
   is real provider output, not a local template.
7. **Add a streaming endpoint (optional, later).** Wire the prepared
   `parseSseStream()` client helper to a real `text/event-stream`
   route using the providers' `chatStream()`. Files: new route
   (e.g. `src/app/api/v1/chat/stream/route.ts`),
   `src/lib/api/chat-client.ts`, `src/app/page.tsx`.
8. **Create a Supabase project and apply the migration.** Paste
   `supabase/migrations/20261113000000_nexora_phase2_init.sql`
   into the SQL Editor (or `supabase db push`), verify the 5 tables
   and RLS with the queries in `docs/database.md`. Requires a
   user-approved Supabase account (free tier is enough to start).
9. **Add the Supabase client and wire auth.** Install
   `@supabase/supabase-js`, set `SUPABASE_URL` /
   `SUPABASE_ANON_KEY` in `.env.local`, add a server client helper
   (service-role key stays server-only), sign-up/sign-in flow, and
   profile creation on first login. Files: new
   `src/lib/server/supabase.ts` (or similar), auth UI, `src/types/database.ts`
   (already mirrors the schema).
10. **Wire persistence.** Save conversations/messages/usage through
    the API (server-side, RLS-respecting), then load history in the
    sidebar. Files: new repository layer, `src/app/api/v1/chat/route.ts`
    (add persistence after a successful reply), `src/app/page.tsx`,
    `src/components/layout/Sidebar.tsx`.

---

## 11. How to run & verify

```bash
# 1. Install dependencies (Node.js 20+, npm)
npm install

# 2. Unit tests (48 tests, ~2 s — no key, no network needed)
npm test

# 3. Production build (includes TypeScript) and lint
npm run build
npm run lint

# 4. Start the dev server
npm run dev
# → http://localhost:3000
```

Live checks (dev server running):

```bash
# Health — 200, providers all not_configured
curl http://localhost:3000/api/v1/health

# Models — 200, total 6, availableCount 0
curl http://localhost:3000/api/v1/models

# Chat, valid request — 503 today (no provider configured)
curl -X POST http://localhost:3000/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"modelId":"gpt-4o","messages":[{"role":"user","content":"Hello Nexora AI"}]}'

# Chat, unknown model — 400
curl -X POST http://localhost:3000/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"modelId":"nope","messages":[{"role":"user","content":"hi"}]}'
```

Expected while unconfigured: health `200`, models `200`, chat `503`
`PROVIDER_NOT_CONFIGURED` with the message "AI provider is not
configured yet." — and no reply content of any kind.

---

*Phase 2 is complete. The backend is honest, tested, and ready for a
real provider — whenever the user decides to connect one.*
