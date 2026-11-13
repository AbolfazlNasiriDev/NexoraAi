# Authentication (Phase 3.1)

Nexora AI signs users in with Supabase Auth (email + password for v1).
The whole system is built to work with **no Supabase project
configured**: every piece has an explicit unconfigured state, nothing
crashes, and no user is ever faked.

## Architecture

```
Browser                          Server
─────────────────────────────────────────────────────────────────
Auth pages (/auth/*)             src/proxy.ts (Next.js proxy)
  sign-in / sign-up                ├─ updateSession() refreshes
  forgot-password                    the session cookies
  reset-password                   └─ getAuthRedirect() decides:
  UserChip (TopBar)                     guest on "/" → /auth/sign-in
    └─ createClient()                   signed-in on /auth/sign-in
       (browser client)                 or /auth/sign-up → "/"
            │                           callback/forgot/reset pass
            │                           through (no loops)
            ▼
Supabase Auth ── session cookies ──▶ src/lib/supabase/server.ts
   (when a project exists)              ├─ createClient() (per request)
                                        ├─ getAuthenticatedUser()
                                        │    (supabase.auth.getUser(),
                                        │     never a client claim)
                                        └─ POST /api/v1/chat gate
```

No service-role client exists in this phase. `SUPABASE_SERVICE_ROLE_KEY`
is never read by any code path here — profile rows are created by the
database trigger on `auth.users` (see `docs/database.md`), never by
the app.

## Environment variables

| Variable | Public / Server-only | Read by |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Browser client (`src/lib/supabase/client.ts`) **and** server client + proxy (`src/lib/supabase/server.ts`, `src/lib/supabase/middleware.ts`) — one pair for both sides since Phase 3.1.1 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public (publishable key) | Browser client **and** server client + proxy — same single pair |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-only, secret — NOT used in this phase** | Nothing (do not create a service-role client without a separate decision) |

There is exactly **one** Supabase pair. The browser and server clients
both read `NEXT_PUBLIC_SUPABASE_URL` /
`NEXT_PUBLIC_SUPABASE_ANON_KEY` — the `NEXT_PUBLIC_` prefix only means
the values are inlined into the browser bundle; the anon key is a
publishable key by design, so the server reading the same pair is safe.
Its value may be either a legacy anon JWT (`eyJ…`) or a new
publishable key (`sb_publishable_…`); both are accepted in the same
slot by the installed SDKs (`@supabase/supabase-js` 2.119.0,
`@supabase/ssr` 0.12.7). The old server-only pair was removed in
Phase 3.1.1 — setting it does nothing. See `docs/environment.md`
for the rules.

## Routes

| Route | Purpose |
| --- | --- |
| `/auth/sign-in` | Email + password. Success → `/`. `?reset=success` shows the reset confirmation; `?error=callback` / `?error=not_configured` show safe, allowlisted messages. |
| `/auth/sign-up` | Email + password + confirmation. If the project requires email confirmation, the page honestly says "Check your email" — the account is not treated as working until confirmed. Only a real session redirects to `/`. |
| `/auth/forgot-password` | Sends a recovery link. The success message is neutral ("If an account exists…") so it never reveals whether an email is registered. |
| `/auth/reset-password` | Verifies a recovery session exists first (`getUser()`); without one it shows the invalid/expired state. On success → `/auth/sign-in?reset=success`. |
| `/auth/callback` (GET) | Exchanges the emailed `code` for a session, then redirects to the validated `next` path (open-redirect guard: relative in-app paths only, default `/`). Failures redirect to `/auth/sign-in?error=callback` with no raw error text in the URL. |
| `/auth/sign-out` (POST) | Server-side sign-out (clears cookies). The UserChip calls this — the one real sign-out path. Unconfigured → no-op success. |

Protected routes: `/` (the workspace) and any future `/app/*` path.
Guests are redirected to `/auth/sign-in` by the proxy; signed-in users
visiting `/auth/sign-in` or `/auth/sign-up` are redirected to `/`.
`/auth/callback`, `/auth/forgot-password` and `/auth/reset-password`
always pass through so those flows cannot loop. API routes are NOT
matched by the proxy — they enforce auth themselves (see below).

## The chat 401 rule

`POST /api/v1/chat` checks identity server-side, before reading the
body, using only `getAuthenticatedUser()`:

- **(a) Supabase NOT configured:** today's exact behaviour — valid
  request → 503 `PROVIDER_NOT_CONFIGURED`, validation errors unchanged.
  There is no auth to enforce and no AI to protect.
- **(b) Configured + anonymous:** 401 `UNAUTHORIZED`
  ("Authentication is required.") in the standard envelope.
- **(c) Configured + authenticated:** existing behaviour (503 until a
  provider is implemented).

A `user_id` sent in the request body is never read or trusted: the
validator rejects unknown fields, so a forged `user_id` is a 400
(authenticated) or a 401 (anonymous) — never an identity.
`GET /api/v1/health` and `GET /api/v1/models` stay ungated (health
must stay public; models is public metadata).

## Account area

The TopBar hosts a `UserChip`: the signed-in user's email, or the
neutral fallback `Signed in · <first 8 chars of id>…` when the user
has no email (phone sign-up — `profiles.email` is nullable, and no
email is ever invented). Plus a real Sign out button. The chip is
display-only; it never decides access. The Sidebar footer still shows
the static Phase 1 placeholder and is not a live account area.

## Profiles

Profile creation is trigger-owned: `handle_new_user()` on `auth.users`
creates the `profiles` row (see `docs/database.md`, migrations v2+v3).
The app has **no profile-write path** in this phase — there is no
`supabase.from("profiles")` call anywhere (pinned by a test), and no
profile reads either; those belong to a later phase. `profiles.email`
is nullable since v3, so no code may assume an email exists.

## Phone / OAuth

Architecture only. Nothing in this phase configures SMS or any OAuth
provider, and nothing claims they are active. The email+password flow
is the only one that works; the trigger already handles a phone user
(a profile with `email NULL`), so the data side is ready when a later
phase adds those sign-in methods.

## What still needs a real Supabase project

- Creating the project and applying migrations v1 → v2 → v3 (throwaway
  first, never production — see `docs/database.md`).
- Setting the five variables above in `.env.local` (never committed).
- Enabling email confirmation / recovery email templates in the
  Supabase dashboard (the app only calls the Auth APIs; delivery is
  the project's configuration).
- A live verification pass: real sign-up (with confirmation), sign-in,
  session persistence across refresh, sign-out, forgot/reset flow,
  guest redirect, and the chat 401 rule with a real session.

## Honest limits

- **No live Supabase test exists.** Everything above is verified by
  unit tests with mocked modules, structural grep tests, and live
  checks with dummy keys only (see `docs/testing.md`). Real flows
  are untested until a throwaway project exists.
- **Session persistence is by construction** (`@supabase/ssr` cookies
  + proxy refresh), not by a live test — a browser refresh test needs
  a real project.
- **No rate limiting on auth endpoints** beyond Supabase's own
  built-in limits and the friendly error mapping.
- **No profile reads/writes, no admin panel, no payments** — all out
  of scope for 3.1.
