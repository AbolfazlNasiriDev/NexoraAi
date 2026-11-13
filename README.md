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
- 💬 **Real local chat** — send a message and it appears as a bubble;
  the UI is honest that the AI backend arrives in Phase 2
- 📎 **File attach** — pick a file and see a removable chip with its name
  and size; nothing is uploaded anywhere
- 🎛️ **Model selector** — Nexora 1.0 Pro / Nexora 1.0 / Nexora Lite,
  stored as local UI state
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

## 🗂️ Project Structure

```text
nexora-ai/
├── public/                          # Static assets
├── src/
│   ├── app/
│   │   ├── layout.tsx               # Root layout, metadata, fonts
│   │   ├── page.tsx                 # Home workspace (client, holds state)
│   │   └── globals.css              # Tailwind v4 theme + Nexora tokens
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx          # Navigation, upgrade card, profile
│   │   │   └── TopBar.tsx           # Model selector, Config, Export
│   │   ├── home/
│   │   │   ├── Orb.tsx              # Floating glowing orb
│   │   │   ├── ModelSelector.tsx    # Model dropdown
│   │   │   ├── PromptInput.tsx      # Composer, attach, tone, send
│   │   │   ├── FeatureCards.tsx     # Image / Presentation / Dev cards
│   │   │   └── ChatMessages.tsx     # Local message transcript
│   │   └── ui/
│   │       ├── button.tsx           # shadcn-style Button
│   │       ├── badge.tsx            # shadcn-style Badge
│   │       └── input.tsx            # shadcn-style Input
│   └── lib/
│       ├── data.ts                  # Nav, models, features, chat types
│       └── utils.ts                 # cn() + file-size helper
├── package.json
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
