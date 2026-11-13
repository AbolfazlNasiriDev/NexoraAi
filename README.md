<div align="center">

# ✨ Nexora AI

### Your premium AI workspace — beautifully light, calm and fast.

**Chat · Image Generation · AI Presentations · Dev Assistant**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Framer Motion](https://img.shields.io/badge/Framer_Motion-12-8054D9?style=for-the-badge&logo=framer&logoColor=white)](https://www.framer.com/motion/)
[![License: MIT](https://img.shields.io/badge/License-MIT-8054D9?style=for-the-badge)](LICENSE)

> One prompt away from writing, images, presentations and code —
> organised in a single light, calm workspace built for deep work.

</div>

---

## 🌟 What is Nexora AI?

**Nexora AI** is a premium, light-first AI platform. Phase 1 ships the complete
frontend experience: a polished sidebar workspace, a floating glowing orb,
a professional prompt composer, and feature cards for the tools that matter —
all in a soft lavender design system that feels like a world-class SaaS product.

> **Phase 1 is frontend-only.** Messages and files stay in your browser.
> No AI backend, no fake replies, no data leaves your device yet.
> The backend connects in Phase 2.

---

## 🎨 Design System

Light theme only — no dark mode, no black backgrounds. Soft shadows,
lavender gradients and subtle glassmorphism throughout.

| Token | Hex | Swatch | Usage |
| --- | --- | --- | --- |
| Background | `#F8F7FC` | 🟣 | Page background |
| Sidebar / Cards | `#FFFFFF` | ⬜ | Sidebar, cards, inputs |
| Primary Purple | `#8054D9` | 🟪 | Primary actions, active states |
| Secondary Purple | `#B69AEF` | 💜 | Gradients, glows, highlights |
| Accent Lavender | `#EDE5FC` | 🌸 | Selected states, soft fills |
| Text | `#242033` | ⬛ | Headings & body text |
| Borders | `#EAE5F3` | ▫️ | Dividers, card borders |

Tokens live in `src/app/globals.css` as Tailwind v4 `@theme` variables
(`bg-nexora-bg`, `text-nexora-text`, `bg-nexora-primary`, …), so the whole
palette can evolve from a single file.

---

## ✨ Features

- 🧭 **Premium sidebar** — logo, New Chat, Chat, Archived, Library,
  Workspaces, New Project, Image Generator, Presentation, Settings and an
  Upgrade to Premium card
- 🔮 **Floating glowing orb** — animated with Framer Motion, layered radial
  gradients, a rotating conic ring and drifting sparkles
- 💬 **Chat wired to the API** — sending a message calls
  `POST /api/v1/chat` and shows the result in the thread; with no
  provider configured yet, the API's 503 error is shown as a distinct
  system message — never a fabricated reply
- 📎 **File attach** — pick a file and see a removable chip with its name
  and size; nothing is uploaded anywhere
- 🎛️ **Model selector** — loads the real registry models from
  `GET /api/v1/models`, each with a live status badge (`Not configured`
  today); the old display labels are gone
- 🃏 **Feature cards** — Image Generator, AI Presentation and Dev Assistant;
  selecting one changes the prompt placeholder and highlights the card
- 🎬 **Motion everywhere** — page transitions, hover lifts, floating orb,
  smooth sidebar drawer on mobile
- 📱 **Fully responsive** — fixed sidebar on desktop, hamburger + overlay
  drawer on tablet and mobile, stacked cards and composer on small screens

---

## 🖥️ Backend (Phase 2.1)

Phase 2.1 adds the backend foundation using Next.js Route Handlers — no
external services, no API keys required to build or run.

- **API layer** — typed response envelope (`{ success, data }` /
  `{ success: false, error: { code, message } }`), centralized error
  handling (`ApiError` + standard codes) and a `withErrorHandling` wrapper
  for route handlers (`src/lib/server/`)
- **Environment config** — server-only `src/lib/server/env.ts`; all AI
  provider keys are optional and absent by default, public values have safe
  defaults, and secret values are never logged or returned
- **Health endpoint** — `GET /api/v1/health` returns `200` with the app
  status and honest provider statuses:

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "app": "Nexora AI",
    "version": "2.1.0-phase2.1",
    "timestamp": "2026-11-13T12:00:00.000Z",
    "providers": {
      "openai": "not_configured",
      "gemini": "not_configured",
      "anthropic": "not_configured"
    }
  }
}
```

> No AI provider is configured yet, and no model is claimed available.
> Chat, models, provider integrations, database and environment files
> arrive in the later Phase 2 subphases.

---

## 🤖 AI Providers (Phase 2.2)

Phase 2.2 adds the multi-provider architecture — interfaces and structure
only, no live provider connections yet.

- **Shared contract** — `AIProvider` (`src/lib/ai/provider.ts`): `id`,
  `displayName`, `isConfigured()`, `getModels()`, `chat()`,
  `chatStream()` and `identifyModel()`. Every provider implements this
  interface, so the gateway never talks to a provider directly.
- **Future providers** — thin classes in `src/lib/ai/providers/` for
  OpenAI, Google Gemini and Anthropic Claude, sharing the plumbing in
  `BaseProvider` (config check, live status derivation, rate-limit error
  mapping). No SDK is installed and no API key exists.
- **Model registry** — `src/lib/ai/registry.ts` is the single source of
  truth for models: `listModels()`, `getModel()`,
  `getProviderForModel()`, `listAvailableModels()` and
  `getProviderStatus()`. Every model's status is derived live from real
  configuration — a key present means `available`, otherwise
  `not_configured`.
- **Gateway** — `src/lib/ai/gateway.ts` is the single entry point for
  later phases: it resolves the model through the registry, rejects
  unknown model ids with a 400, and returns the standard 503
  ("AI provider is not configured yet.") when the provider has no key.
- **Types** — provider-neutral chat types in `src/lib/ai/types.ts`
  (`AiMessage`, `ChatCompletionRequest/Response`, `StreamChunk`) and
  shared model types in `src/types/ai.ts` (`ModelInfo`, `ModelStatus`,
  `ProviderId`).

> No provider is configured and **no model is available yet** —
> `listAvailableModels()` correctly returns `[]`. The Phase 1 display
> labels "Nexora 1.0 Pro", "Nexora 1.0" and "Nexora Lite" are UI labels
> only and are not listed as real AI models anywhere. Sending a chat
> request today returns the honest 503 instead of a fabricated reply.

---

## 💬 Chat API (Phase 2.3)

`POST /api/v1/chat` sends a chat completion request through the gateway
(`src/lib/ai/gateway.ts`), which resolves the model in the registry and
delegates to the matching provider. Input is validated strictly by
`src/lib/validation/chat.schema.ts` (types in `src/types/chat.ts`,
which re-uses the shared `AiMessage` type from `src/lib/ai/types.ts`).

Example request:

```json
{
  "conversationId": null,
  "modelId": "gpt-4o",
  "messages": [{ "role": "user", "content": "Hello Nexora AI" }]
}
```

Today no provider is configured, so every valid request answers with the
standard 503 — never a fabricated reply:

```json
{
  "success": false,
  "error": {
    "code": "PROVIDER_NOT_CONFIGURED",
    "message": "AI provider is not configured yet."
  }
}
```

Validation limits (any violation returns `400 VALIDATION_ERROR`):

| Rule | Limit |
| --- | --- |
| Body | JSON object, no unknown top-level fields |
| `conversationId` | `null`, or a non-empty string up to 128 chars (missing means `null`) |
| `modelId` | Required non-empty string up to 128 chars; unknown ids are rejected |
| `messages` | Required array of 1–50 messages |
| Message shape | Exactly `role` + `content`; no unknown fields |
| `role` | `"user"` \| `"assistant"` \| `"system"` |
| `content` | String of 1–8000 chars after trimming |
| Conversation | At least one `"user"` message, and the last message must be `"user"` |

Malformed JSON is also a `400`. Other methods on this path return `405`.
A provider that is configured but whose `chat()` is still a stub fails
loudly with a generic `500` — never a fake reply.

---

## 🧠 Model Management API (Phase 2.4)

`GET /api/v1/models` lists every model from the shared ModelRegistry
(`src/lib/ai/registry.ts`) — the single source of truth for which models
exist. Nothing is hardcoded, added, renamed, or filtered in the route.

Example response (today, with no provider configured):

```json
{
  "success": true,
  "data": {
    "models": [
      {
        "id": "gpt-4o",
        "name": "GPT-4o",
        "provider": "openai",
        "description": "OpenAI's flagship multimodal model — fast, capable general chat.",
        "capabilities": ["chat", "streaming"],
        "status": "not_configured"
      }
    ],
    "total": 6,
    "availableCount": 0
  }
}
```

Each `ModelInfo` has exactly these fields:

| Field | Description |
| --- | --- |
| `id` | Stable registry id, e.g. `"gpt-4o"` |
| `name` | Human-readable name, e.g. `"GPT-4o"` |
| `provider` | `"openai"` \| `"gemini"` \| `"anthropic"` |
| `description` | Short description of the model |
| `capabilities` | Capability tags, e.g. `["chat", "streaming"]` |
| `status` | See below — derived live from real configuration |

Model statuses:

| Status | Meaning |
| --- | --- |
| `available` | The provider has a real connection configured |
| `not_configured` | No API key (or other real connection) is set up |
| `disabled` | The model is known but deliberately switched off |

No model is ever reported `available` without a real connection — today
every model is `not_configured` and `availableCount` is `0`. The Phase 1
display labels "Nexora 1.0 Pro", "Nexora 1.0" and "Nexora Lite" are UI
labels only and never appear as models here. No query params are required;
any sent are ignored. Other methods on this path return `405`.

---

## 🔌 Frontend Integration (Phase 2.5)

Phase 2.5 wires the existing dashboard to the real API — same sidebar,
orb, hero, composer placement, feature cards and light theme; only the
send flow and the model list changed.

- **Chat API client** — `src/lib/api/chat-client.ts` (client-safe, no
  secrets): `sendChatMessage()` posts to `POST /api/v1/chat` and
  `fetchModels()` loads `GET /api/v1/models`, both parsing the standard
  envelope and throwing a typed `ApiClientError` (`status`, `code`,
  `message`) on failure. `isProviderNotConfiguredError()` detects the
  standard 503.
- **Conversation types** — `src/types/conversation.ts`: `Conversation`
  (`id`, `modelId`, `messages`) and `UiMessage` with kinds `"user"` |
  `"assistant"` | `"error"` | `"loading"`. `"error"` is a distinct system
  message, never an assistant reply; `"assistant"` exists only for real
  future provider replies.
- **Send flow** — `src/app/page.tsx` holds the `Conversation` and
  `isSending` state. On send it adds the user message, shows a
  "Nexora is thinking…" loading indicator, calls the API, then replaces
  the indicator with the real reply — or, on failure, with the distinct
  error bubble carrying the API error code and message. While sending,
  the composer is disabled and the send button spins.
- **Model selector** — `src/components/home/ModelSelector.tsx` fetches
  the real model list on mount. States: loading (disabled,
  "Loading models…"), error ("Couldn't load models" + retry, never a
  fake fallback list), loaded (dropdown with name, provider and a live
  status badge; the first model is selected by default). The Phase 1
  display models are gone from the selector entirely.
- **Message states** — `src/components/home/ChatMessages.tsx` renders
  each kind distinctly: user bubbles as before, assistant replies from
  real API output only, loading dots, and a rose-tinted error bubble
  (AlertTriangle, error code chip, "Your message was kept — nothing was
  answered.").
- **Streaming, prepared** — `parseSseStream()` in the chat client reads
  a future `text/event-stream` response into `onDelta` / `onDone` /
  `onError` callbacks. No streaming endpoint exists yet, so the UI does
  not call it and it never fabricates chunks.
- **Files stay local** — attached files are shown as a chip on the user
  bubble but are not sent to the API in 2.5 (text only); a file with no
  text gets an explanatory error instead of a call.

> Sending a message today returns the honest 503
> ("AI provider is not configured yet."), shown in the thread as a
> provider-not-configured error — never a fake reply. Database, history
> persistence and environment files arrive in the later Phase 2
> subphases.

---

## 🗄️ Database (Phase 2.6)

The database architecture is ready as a schema — **no Supabase project
is connected yet**, so nothing here talks to a live database.

- **Migration** — `supabase/migrations/20261113000000_nexora_phase2_init.sql`
  (Supabase PostgreSQL 15+, safely re-runnable, creates zero rows).
  Five tables: `profiles` (one row per auth user, `id` = `auth.users.id`),
  `conversations` (`user_id`, `title`, `model_id`), `messages`
  (append-only, `role` ∈ `user` / `assistant` / `system`), `user_settings`
  (one row per user, `theme` is light-only by a CHECK constraint), and
  `usage_records` (append-only, per-reply token accounting).
- **Row types** — `src/types/database.ts` mirrors every table 1:1
  (`ProfileRow`, `ConversationRow`, `MessageRow`, `UserSettingsRow`,
  `UsageRecordRow`); types only, no client, no connection.
- **Docs** — `docs/database.md` has the ERD, the reason for every
  index, and the full RLS model.
- **Row Level Security** — enabled on all five tables; every policy is
  scoped to `auth.uid()`, so users only touch their own rows.
  `usage_records` is read-only for end users — writes happen server-side
  with the service-role key, which stays server-only and never reaches
  the browser.
- **Applying it later** — once a Supabase project exists: paste the file
  into the Supabase SQL Editor, or run `supabase db push`. No auth flow,
  client, or server query code exists yet — that comes in later phases.

---

## ⚙️ Environment (Phase 2.7)

Environment is template-only — **nothing is configured yet**, and the
app builds and runs with an entirely empty env.

- **Template** — [`.env.example`](.env.example): all eight variables,
  every secret value empty. Copy it to start:
  `cp .env.example .env.local`, then fill in only the keys you have.
- **Docs** — [`docs/environment.md`](docs/environment.md) has the full
  table (required/optional, server-only/public, purpose) and the rules.
- **`.env.local` is gitignored** (`.env`, `.env.local`, `.env.*.local`)
  and must never be committed; `.env.example` is deliberately *not*
  ignored so the template stays in the repo.
- **Validation** — `src/lib/server/env.ts` now exports
  `REQUIRED_ENV_VARS` (today: none — everything has a default or is
  optional), `OPTIONAL_ENV_VARS`, `validateEnv()` (names only, never
  values), and `isSupabaseConfigured()` (false until both
  `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set).
- **Secrets stay server-only** — provider keys and the Supabase
  service-role key are read only through `env.ts` and never reach the
  client; the only `NEXT_PUBLIC_` variables are `NEXT_PUBLIC_APP_NAME`
  and `NEXT_PUBLIC_APP_URL`.
- **With nothing set** — providers are `not_configured`, chat answers
  503, and Supabase is not configured.

---

## 🧪 Testing (Phase 2.8)

Unit suite + live endpoint checks, no keys and no network needed.

- **Run it** — `npm test` (Vitest 3.2.7, 48 tests), `npm run build`,
  `npm run lint`. All three must pass.
- **Covered** — chat validation rules, error factories + envelope,
  env defaults and `validateEnv()`, registry (6 models, all
  `not_configured`), gateway 400/503 behaviour, and the browser API
  client with stubbed `fetch`.
- **Live checks** — health 200, models 200 (`total: 6`,
  `availableCount: 0`), chat 503 for valid requests, 400 for every
  validation case, 405 for wrong methods, homepage 200, plus
  no-key-in-frontend, no-fake-reply, and no-`dark:` greps.
- **Docs** — [`docs/testing.md`](docs/testing.md) has the full table,
  the `server-only` test setup (the package's real `react-server`
  export condition — not a mock), and the honest limits: no live
  provider tests (no keys), the SQL migration was never executed
  against a real database, and no E2E browser tests yet.

---

## 🗂️ Project Structure

```text
nexora-ai/
├── public/                          # Static assets
├── src/
│   ├── app/
│   │   ├── api/v1/
│   │   │   ├── chat/route.ts        # POST /api/v1/chat (Phase 2.3)
│   │   │   ├── health/route.ts      # GET /api/v1/health (Phase 2.1)
│   │   │   └── models/route.ts      # GET /api/v1/models (Phase 2.4)
│   │   ├── layout.tsx               # Root layout, metadata, fonts
│   │   ├── page.tsx                 # Home workspace (client, holds state)
│   │   └── globals.css              # Tailwind v4 theme + Nexora tokens
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx          # Navigation, upgrade card, profile
│   │   │   └── TopBar.tsx           # Model selector, Config, Export
│   │   ├── home/
│   │   │   ├── Orb.tsx              # Floating glowing orb
│   │   │   ├── ModelSelector.tsx    # Model dropdown (real API, Phase 2.5)
│   │   │   ├── PromptInput.tsx      # Composer, attach, tone, send
│   │   │   ├── FeatureCards.tsx     # Image / Presentation / Dev cards
│   │   │   └── ChatMessages.tsx     # Thread: user / loading / error / reply
│   │   └── ui/
│   │       ├── button.tsx           # shadcn-style Button
│   │       ├── badge.tsx            # shadcn-style Badge
│   │       └── input.tsx            # shadcn-style Input
│   ├── lib/
│   │   ├── api/
│   │   │   └── chat-client.ts       # Chat API client + SSE prep (2.5)
│   │   ├── ai/                      # Provider interface, registry, gateway
│   │   ├── server/                  # env, errors, response envelope
│   │   ├── validation/
│   │   │   └── chat.schema.ts       # Chat request validation (2.3)
│   │   ├── data.ts                  # Nav, features, placeholders
│   │   └── utils.ts                 # cn() + file-size helper
│   └── types/
│       ├── ai.ts                    # ModelInfo, ModelStatus, ProviderId
│       ├── api.ts                   # API envelope + error codes
│       ├── chat.ts                  # Chat request/response types
│       └── conversation.ts          # Conversation + UiMessage (2.5)
├── package.json
├── vitest.config.ts             # Vitest config (Phase 2.8)
└── README.md
```

---

## 🚀 Getting Started

**Requirements:** Node.js 20+ and npm.

```bash
# 1. Install dependencies
npm install

# 2. Start the dev server
npm run dev

# 3. Open in your browser
http://localhost:3000
```

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint |
| `npm test` | Run the Vitest unit suite |

---

## 🛣️ Roadmap

- [x] **Phase 1 — Frontend** · Next.js + Tailwind + Framer Motion workspace (this repo)
- [ ] **Phase 2 — AI backend** · Real model calls, streaming replies, chat history
- [ ] **Phase 3 — Image Generator** · Text-to-image, styles and history
- [ ] **Phase 4 — AI Presentations** · Outline → designed deck, export to PDF/PPTX
- [ ] **Phase 5 — Dev Assistant** · Code explanations, debugging, repo-aware help
- [ ] **Phase 6 — Workspaces & Premium** · Teams, projects, billing

---

## 🤝 Contributing

Contributions are welcome! Fork the repo, create a feature branch,
and open a pull request with a clear description of the change.

## 📄 License

MIT — see [LICENSE](LICENSE) for details.

---

<div align="center">

**Made with 💜 by [Abolfazl Nasiri](https://github.com/AbolfazlNasiriDev)**

*Nexora AI — think beautifully, build brilliantly.*

</div>
