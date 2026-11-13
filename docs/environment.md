# Environment Configuration (Phase 2.7)

Nexora AI needs **no** environment variables to build or run. Every
secret is optional: with nothing set, the app works, all AI providers
report `not_configured`, and Supabase reports not configured. Set a
variable only when you actually have the service it unlocks.

## Variables

| Variable | Required / Optional | Server-only / Public | Purpose | Used by |
| --- | --- | --- | --- | --- |
| `OPENAI_API_KEY` | Optional | Server-only | OpenAI API key (future provider) | `src/lib/server/env.ts` |
| `GEMINI_API_KEY` | Optional | Server-only | Google Gemini API key (future provider) | `src/lib/server/env.ts` |
| `ANTHROPIC_API_KEY` | Optional | Server-only | Anthropic Claude API key (future provider) | `src/lib/server/env.ts` |
| `NEXT_PUBLIC_APP_NAME` | Optional (default `Nexora AI`) | Public | App name shown in the UI | `src/lib/server/env.ts` |
| `NEXT_PUBLIC_APP_URL` | Optional (default `http://localhost:3000`) | Public | Base URL of the app | `src/lib/server/env.ts` |
| `SUPABASE_URL` | Optional | Server-only | Supabase project URL (future) | `src/lib/server/env.ts` |
| `SUPABASE_ANON_KEY` | Optional | Public (publishable key) | Supabase anon key (future client) | `src/lib/server/env.ts` |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional | **Server-only, secret** | Bypasses Row Level Security; server-side writes only | `src/lib/server/env.ts` |

Required variables today: **none**. `REQUIRED_ENV_VARS` in
`src/lib/server/env.ts` is an empty list by design — if a future phase
adds a variable the server cannot run without, it goes there and
`validateEnv()` will report it as missing.

## Local setup

```bash
# 1. Copy the template (it contains no real values — all secrets empty)
cp .env.example .env.local

# 2. Fill in only the keys you actually have, in .env.local
# 3. Start the app as usual
npm run dev
```

## Rules

- **`.env.local` is gitignored and must never be committed.** It is the
  only place real keys go. (`.gitignore` ignores `.env`, `.env.local`
  and `.env.*.local` — but deliberately **not** `.env.example`.)
- **`.env.example` stays empty of secrets** and is safe to commit. It
  is the template other developers copy from.
- **Never put a secret in a `NEXT_PUBLIC_` variable.** Anything
  `NEXT_PUBLIC_` is shipped to the browser. The only public variables
  are `NEXT_PUBLIC_APP_NAME` and `NEXT_PUBLIC_APP_URL`.
- **Server-only secrets** (the three provider API keys and
  `SUPABASE_SERVICE_ROLE_KEY`) are read only through
  `src/lib/server/env.ts`, which never logs or returns their values —
  only booleans like `isProviderConfigured()` leave that module.
- **Validation:** `validateEnv()` in `src/lib/server/env.ts` returns
  `{ ok, missingRequired, missingOptional }` — variable *names* only,
  never values. `isSupabaseConfigured()` is true only when both
  `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set.

## What happens with nothing set

- The app builds and runs normally.
- `GET /api/v1/health` reports all three providers as
  `not_configured`; `POST /api/v1/chat` answers 503
  ("AI provider is not configured yet.").
- `GET /api/v1/models` lists all six models as `not_configured`.
- Supabase is not configured: no database client exists yet (Phase 2.6
  prepared the schema and types only).
