# Testing — Nexora AI (Phase 2.8)

How the project is tested, what is covered, and — honestly — what is
not covered yet.

## Commands

```bash
npm test        # Unit suite (Vitest, `vitest run`) — 158 tests, ~8 s
npm run build   # Production build (Next.js, includes TypeScript)
npm run lint    # ESLint
```

All three must pass before a phase is reported done. They need no API
key, no Supabase project, no network, and no running server — except
the live endpoint checks below, which need `npm run dev`.

## Unit suite (`npm test`)

Vitest 3.2.7 (devDependency, pinned) with `vitest.config.ts`. Tests
live next to the code they cover (`*.test.ts`), run in the Node
environment, and are deterministic: no network, no real keys, no fake
AI replies. `NODE_ENV=test` inside the suite.

| Test file | Tests | Covers |
| --- | --- | --- |
| `src/lib/validation/chat.schema.test.ts` | 15 | Chat validation rules from Phase 2.3: valid request, empty / 51 messages, >8000-char message, bad role, last message not user, no user message, missing modelId, unknown top-level and message fields, malformed types, non-object body, whitespace-only content, conversationId rules. Error messages never echo user content. |
| `src/lib/server/errors.test.ts` | 12 | Error factories (503 `PROVIDER_NOT_CONFIGURED` with the exact message, 400/404/429/500, 413 `PAYLOAD_TOO_LARGE`), the failure envelope, and the rule that unknown errors map to a generic 500 without leaking internals. Also `ok()` / `fail()` / `withErrorHandling()`. Since Phase 2.10: safe server logging — `ApiError` logs only code + status, unknown errors log only the constructor name; a planted fake key / user content appears in neither the log nor the response. |
| `src/lib/ai/registry.status.test.ts` | 5 | Model status derivation (Phase 2.10): dummy key → `not_implemented` (never `available`), `listAvailableModels()` stays `[]` with keys set, `isImplemented()` false for the stubs, and a test double with `implemented = true` is the only way to `available` (its `chat()` throws if called — no fake reply). |
| `src/lib/server/request-body.test.ts` | 6 | Size-capped body reading (Phase 2.10): small/empty/exactly-1 MB bodies read unchanged, `Content-Length` above the limit short-circuits to 413, a streamed body without `Content-Length` is capped and stops reading early, a lying `Content-Length` is still caught by the stream cap. |
| `src/app/api/v1/chat/route.test.ts` | 4 | Body limit at the route (Phase 2.10): small valid request → 503 (passed the size check), body over 1 MB → 413 `PAYLOAD_TOO_LARGE` in the standard envelope, >1 MB streamed body without `Content-Length` → 413, malformed JSON under the limit → 400. |
| `src/lib/api/history.test.ts` | 6 | History windowing (Phase 2.10): under-cap unchanged, over-cap capped at 20 in order, last user message always kept (even when older than the window), empty input, custom cap. |
| `src/lib/server/gitignore.test.ts` | 3 | `.gitignore` env coverage (Phase 2.10): all six env files protected, `.env.example` not ignored (no blanket rule), and the matcher is proven non-vacuous (`.env.local` IS ignored). |
| `src/lib/server/migration.test.ts` | 30 | Migration structure (Phase 2.11): v1 has 5 tables / 7 indexes / 7 policies / RLS on all 5 / zero GRANTs / no profile-creation path; v2 has the exact least-privilege GRANT matrix (nothing to `anon`/`PUBLIC`, never `GRANT ALL`), the `handle_new_user` trigger (`SECURITY DEFINER`, empty `search_path`, `ON CONFLICT DO NOTHING`, warning guard), the three new `messages` CHECKs, no profiles INSERT policy (deliberate), and idempotency markers. Phase 2.11.2 adds 9 v3 tests: `profiles.email` DROP NOT NULL (UNIQUE kept), the trigger guard is log-and-re-raise (bare `RAISE;` after the WARNING), the v2 trigger is NOT recreated, no table GRANTs/REVOKEs or policies in v3, exactly one `REVOKE EXECUTE` on the function, idempotency markers, and the `docs/database.md` sync (nullable email + log-and-re-raise). **Structural only** — see the limits below. |
| `src/lib/server/env.test.ts` | 4 | Env defaults with nothing set (public defaults, no provider configured, `REQUIRED_ENV_VARS` empty, all six optional vars missing), and with vars stubbed (provider + Supabase detection, Supabase needs BOTH URL and anon key, `validateEnv()` never returns a secret value — the only "key" used is the literal fake string `sk-test-only-fake-value`). Phase 3.1.1 removes the old `SUPABASE_URL` / `SUPABASE_ANON_KEY` names from the optional list (8 → 6); Supabase detection now reads the single `NEXT_PUBLIC_` pair. |
| `src/lib/validation/auth.schema.test.ts` | 9 | Auth validation (Phase 3.1): email / password (min 8) / confirmation rules, sign-in and sign-up form errors, and the `next` open-redirect guard — relative in-app paths allowed, absolute / protocol-relative / `javascript:` / backslash paths fall back to `/`. |
| `src/lib/supabase/route-guards.test.ts` | 10 | Route-protection decision table (Phase 3.1): `/` and `/app/*` protected, `/auth/sign-in` + `/auth/sign-up` send signed-in users to `/`, callback / forgot / reset always pass through, and everything passes through when Supabase is unconfigured. |
| `src/lib/supabase/auth-error.test.ts` | 7 | Supabase error mapping (Phase 3.1): wrong credentials, unconfirmed email, already-registered, rate limits, short password, invalid email, expired/invalid links — and unknown errors never surface raw text. |
| `src/app/api/v1/chat/route.auth.test.ts` | 5 | Chat auth gate (Phase 3.1, mocked Supabase server module): unconfigured → 503 as before; configured + anonymous → 401 `UNAUTHORIZED` (before validation); configured + authenticated → 503; a forged body `user_id` never becomes an identity (401 anonymous, 400 authenticated). |
| `src/app/auth/callback/route.test.ts` | 5 | Auth callback (Phase 3.1, mocked server client): valid code exchanges and redirects to the validated `next` path, open redirects fall back to `/`, missing code / unconfigured / failed exchange redirect to `/auth/sign-in` with allowlisted `error` values only — no raw error text in the URL. |
| `src/app/auth/sign-out/route.test.ts` | 3 | Sign-out route (Phase 3.1, mocked server client): server sign-out → 200 `{ signedOut: true }`, unconfigured → no-op 200, sign-out failure → generic 500 without leaking the error. |
| `src/lib/supabase/secrets.test.ts` | 6 | Secret-leakage grep tests (Phase 3.1): no service-role key in any client-facing file, the browser client reads only the `NEXT_PUBLIC_` Supabase pair, the server client reads only the same single `NEXT_PUBLIC_` pair (Phase 3.1.1 — the old "server never reads `NEXT_PUBLIC_`" rule is gone with the dual-pair design), no `profiles` write path exists anywhere in the app, and `.env.example` keeps the `NEXT_PUBLIC_SUPABASE_*` values empty with no `SERVICE`/`SECRET` in a `NEXT_PUBLIC_` name. |
| `src/lib/supabase/env-unification.test.ts` | 7 | Env unification (Phase 3.1.1): only the `NEXT_PUBLIC_` pair set → env, server and browser all configured (incl. a `sb_publishable_…` key value); only the old names set → nothing configured (old names are dead); nothing set → nothing configured and no client created; grep tests — no production source file and no `.env.example` line mentions the old names, and the removal is documented in exactly one place (`docs/environment.md`). |
| `src/lib/ai/registry.test.ts` | 6 | Six candidate models, all `not_configured`, zero available, no "Nexora 1.0" label as a real model, known/unknown model lookup, provider statuses. |
| `src/lib/ai/gateway.test.ts` | 5 | Unknown model → 400, missing modelId → 400, empty messages → 400, known model → 503 (never a reply), streaming fails eagerly with 503 before any chunk. |
| `src/lib/api/chat-client.test.ts` | 10 | Client envelope handling with stubbed `fetch`: success passthrough, 503 → typed `ApiClientError` (`PROVIDER_NOT_CONFIGURED`), network failure → `NETWORK_ERROR`, unreadable response → `INVALID_RESPONSE`, `fetchModels`, and the future-only SSE parser (deltas, `done`, `[DONE]`, error event, non-OK response). |

### The `server-only` note — read this before touching the config

Most server modules start with `import "server-only"`. That package
ships two files: `index.js` (throws, for client bundles) and `empty.js`
(a no-op, for server code), selected by its OWN `react-server` export
condition — the exact condition Next.js applies when bundling React
Server Components. Under default Vitest resolution the import throws:

> `This module cannot be imported from a Client Component module.`

Verified by probe during Phase 2.8: with a config that had only the
`@/*` alias, 5 of 6 test files failed at import with that error
(the client-only `chat-client.test.ts` passed).

`vitest.config.ts` therefore sets `ssr.resolve.conditions:
["react-server"]` (in Vite 6 the SSR conditions live under `ssr`,
top-level `resolve.conditions` only affects the client environment)
and inlines `server-only` so vite-node runs it through Vite's resolver
instead of Node's native loader. This is **not a mock**: no test
double is involved, the package's real files are used, and the guard
still throws for client-side resolution (the default condition). A
plain `vi.mock("server-only")` stub was deliberately NOT used.

One expected console line: the "unknown error → generic 500" test
deliberately passes an error into `toErrorResponse`, which logs it
server-side by design — since Phase 2.10 only the constructor name
(`[nexora-api] Unhandled error: Error`), never the message or stack.
That line in the test output is the feature working, not a failure.
Likewise, every `ApiError` now logs one safe line with only its code
and status (`[nexora-api] ApiError: VALIDATION_ERROR 400`); the
route tests therefore print several such lines, which is expected.

## Live endpoint checks (Part B of Phase 2.8)

With `npm run dev` running, the full curl suite is re-run by hand on
every phase and its results recorded in the phase report:

- `GET /api/v1/health` → 200, providers all `not_configured`
- `GET /api/v1/models` → 200, `total: 6`, `availableCount: 0`, all
  `not_configured`, no "Nexora 1.0" in the body
- `POST /api/v1/chat` (valid) → 503 `PROVIDER_NOT_CONFIGURED`, exact
  message, never a fabricated reply
- `POST /api/v1/chat` (unknown model, empty messages, 51 messages,
  >8000 chars, bad role, last message not user, malformed JSON,
  missing modelId) → 400 each
- `GET /api/v1/chat`, `POST /api/v1/models`, `POST /api/v1/health` →
  405 each
- `GET /` → 200
- **Auth live checks (Phase 3.1, dummy keys only, deleted afterwards):**
  with a temporary `.env.local` holding dummy Supabase values, `GET /`
  → 307 to `/auth/sign-in` (the proxy + redirect chain executes),
  `GET /auth/sign-in` → 200 (no loop), and `POST /api/v1/chat` (valid,
  anonymous) → 401 `UNAUTHORIZED`. No real project was involved.
- No-key-in-frontend check: the SSR homepage HTML and the built
  client chunks under `.next/static` are grepped for `sk-`,
  `OPENAI_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY` — zero matches required
- No-fake-reply check: the chat 503 body holds no assistant-style
  content and no model reports status `available`
- Light-theme check: `grep -r "dark:" src/` — zero matches required

## Honest limits

- **No live provider tests.** No API key exists, so no test ever calls
  OpenAI, Gemini, or Anthropic. The suite pins the *unconfigured*
  behaviour (503, `not_configured`, empty available list) instead.
- **The SQL migrations were never executed.** `supabase/migrations/…`
  were verified structurally (Phase 2.6 for v1; Phase 2.11 adds
  structural tests for v2; Phase 2.11.2 adds 9 more for v3 — the
  files say what they should say). Syntax IS validated: in Phase
  2.11.1 the SQL of v1+v2 and their PL/pgSQL bodies were parsed with
  pglast v8.8 (libpg_query, the real PostgreSQL parser) in `/tmp`,
  and the same check was re-run for v3. No Supabase project or local
  Postgres server exists, so the trigger firing, RLS behaviour under
  a real `auth.uid()`, GRANT effectiveness, and the CHECKs against
  real rows are all still untested. First live run must be a
  throwaway Supabase project — see `docs/database.md`.
- **No live Supabase tests.** No project exists, so no test ever signs
  up, signs in, or refreshes a real session. The suite pins the pure
  rules (validation, redirect table, error mapping), the route
  behaviour with a mocked server module, and the secret-leakage
  invariants. Untested live: real sign-up / sign-in / sign-out flows,
  session persistence across a browser refresh, cookie refresh in the
  proxy, the callback code exchange against a real Auth server, and
  the trigger firing on a real sign-up. First live run must be a
  throwaway Supabase project — see `docs/auth.md`.
- **No E2E / browser tests yet.** No Playwright or Cypress. The UI is
  checked by the live homepage request (200 + no secrets in SSR HTML)
  and by manual preview; interaction tests are a later phase.
- **Env is an import-time snapshot.** `env.ts` reads `process.env`
  once at import; tests that need a different env re-import the module
  fresh (`vi.resetModules()` + dynamic `import`) instead of mutating
  the snapshot.
