# Testing — Nexora AI (Phase 2.8)

How the project is tested, what is covered, and — honestly — what is
not covered yet.

## Commands

```bash
npm test        # Unit suite (Vitest, `vitest run`) — 48 tests, ~2 s
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
| `src/lib/server/errors.test.ts` | 8 | Error factories (503 `PROVIDER_NOT_CONFIGURED` with the exact message, 400/404/429/500), the failure envelope, and the rule that unknown errors map to a generic 500 without leaking internals. Also `ok()` / `fail()` / `withErrorHandling()`. |
| `src/lib/server/env.test.ts` | 4 | Env defaults with nothing set (public defaults, no provider configured, `REQUIRED_ENV_VARS` empty, all six optional vars missing), and with vars stubbed (provider + Supabase detection, Supabase needs BOTH URL and anon key, `validateEnv()` never returns a secret value — the only "key" used is the literal fake string `sk-test-only-fake-value`). |
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
server-side by design (`[nexora-api] Unhandled error:`). That line in
the test output is the feature working, not a failure.

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
- **The SQL migration was never executed.** `supabase/migrations/…`
  was verified structurally only (Phase 2.6); no Supabase project or
  local Postgres exists, so no test applies it.
- **No E2E / browser tests yet.** No Playwright or Cypress. The UI is
  checked by the live homepage request (200 + no secrets in SSR HTML)
  and by manual preview; interaction tests are a later phase.
- **Env is an import-time snapshot.** `env.ts` reads `process.env`
  once at import; tests that need a different env re-import the module
  fresh (`vi.resetModules()` + dynamic `import`) instead of mutating
  the snapshot.
