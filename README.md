# OpenThorn

**AI website builder — bring your own API key, pay your provider directly.**

[![Live](https://img.shields.io/badge/live-openthorn.app-4f46e5?style=flat-square)](https://openthorn.app)
[![License](https://img.shields.io/badge/license-proprietary-gray?style=flat-square)](#license)

---

OpenThorn is a BYOK (bring-your-own-key) AI app builder. Describe what you want in plain language; the AI agent writes the code, previews it live in-browser, and deploys a working website to Netlify. **The platform is free** — you only pay your AI provider's raw per-token rates, with no subscription and no markup.

## Why OpenThorn?

Most AI builders charge $25–50/month for credits that resell API access at a markup. OpenThorn flips that model: you connect your own key from any of 18 providers and pay them directly. The platform itself is free.

| | OpenThorn | Others |
|---|---|---|
| Platform cost | Free | $25–50+/month |
| AI billing | Pay your provider directly | Pay the platform in credits |
| Model choice | Any of 18 providers | Platform-selected |
| Code export | Always, no paywall | Often paywalled |
| API key ownership | Yours | Platform-managed |

## Features

- **18 AI providers** — OpenAI, Anthropic, Google Gemini, DeepSeek, Mistral, Groq, Together AI, xAI, Cohere, Perplexity, OpenRouter, RodiumAi, Ollama, Fireworks AI, Cerebras, Azure OpenAI, Amazon Bedrock, NVIDIA NIM
- **In-browser preview** — generated code bundled with esbuild-wasm and rendered live; no server round-trip, no build wait
- **One-click Netlify deploy** — from preview to public URL without leaving the app
- **Full code export** — download the generated source at any point; no proprietary format, no paywall
- **Multi-provider fallback** — if one provider hits a rate limit, the agent switches automatically and continues mid-run
- **Real-time collaboration** — multiplayer presence via Supabase Realtime
- **Encrypted key storage** — provider API keys are encrypted at rest with AES-256-GCM; raw keys never reach the client
- **Templates & community** — start from curated templates or browse community-published projects

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite 6, CSS Modules, Framer Motion |
| Routing | React Router v7 |
| Auth / Database | Supabase (Postgres + RLS, Realtime, Storage) |
| Serverless API | Vercel Functions |
| In-browser bundler | esbuild-wasm |
| Deployment target | Netlify |
| Rate limiting | Upstash Redis (optional) |

## Getting started

### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project
- A [Netlify](https://app.netlify.com/user/applications) personal access token
- A [Vercel](https://vercel.com) project for the API functions

### 1. Clone and install

```bash
git clone https://github.com/BuildingTechAlternatives/OpenThorn.git
cd OpenThorn
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL (browser) |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon key (browser) |
| `SUPABASE_URL` | Yes | Supabase project URL (server) |
| `SUPABASE_ANON_KEY` | Yes | Supabase anon key (server) |
| `NETLIFY_TOKEN` | Yes | Netlify personal access token |
| `KEY_ENCRYPTION_SECRET` | Yes | 48-byte secret — generate with `openssl rand -base64 48` |
| `UPSTASH_REDIS_REST_URL` | No | Upstash Redis URL for production rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | No | Upstash Redis token |

### 3. Apply the database schema

```bash
supabase db push
```

Migrations live in `supabase/migrations/` and must be applied in order. All tables use Row Level Security.

### 4. Run

```bash
npm run dev       # http://localhost:5173
```

The dev server includes shims for `/api/*` so the full stack works locally without deploying to Vercel.

### Other commands

```bash
npm run build     # type-check + Vite build + SSR prerender
npm run test      # Vitest
npm run lint      # ESLint
npm run preview   # serve the production build locally
```

## Project structure

```
api/
  _shared.ts          JWT verification, rate limiting, AES-256-GCM encryption
  deploy-netlify.ts   Netlify deployment endpoint
  provider-keys.ts    API key storage endpoint
src/
  components/         UI components with co-located CSS Modules
  pages/              Route-level page components (all lazy-loaded except landing)
  lib/
    agent.ts          AI agent loop (~2,400 lines) — the core of the product
    agent-prompt.ts   System prompt, tool definitions, thinking params per provider
    agent-plan.ts     Persistent plan/requirements checklist
    agent-memory.ts   Cross-session lessons and changelog entries
    preview-bundle.ts In-browser esbuild-wasm bundler
    preview-runtime-check.ts  Smoke tests against the preview iframe
  data/               Static JSON (FAQ, blog metadata, glossary, comparisons)
supabase/
  migrations/         Ordered SQL migrations
scripts/              Build-time scripts (prerender, OG images, IndexNow, changelog)
```

## Deployment

The app deploys on **Vercel**. `vercel.json` includes SPA rewrites and a strict Content Security Policy.

1. Import the repo in the [Vercel dashboard](https://vercel.com/new)
2. Set all required environment variables under **Project > Settings > Environment Variables**
3. Deploy — Vercel runs `npm run build` automatically

User-generated sites deploy to Netlify via the `/api/deploy-netlify` endpoint using a shared platform token; end users do not need a Netlify account.

## Security

- **Encrypted keys** — provider API keys encrypted with AES-256-GCM; the raw key is never stored or returned to the client
- **Row-level security** — every Supabase table is protected by PostgreSQL RLS policies
- **JWT verification** — every API call validates the Supabase JWT server-side before processing
- **Rate limiting** — per-user, per-endpoint limits (in-memory in dev; Upstash Redis in production)
- **Strict CSP** — allowlists only `self`, fonts, `esm.sh`, `blob:`, and `wss:`; no inline scripts
- **No source maps** in production builds

### RodiumAi (OpenThorn browser calls)

OpenThorn calls `https://api.rodiumai.io/v1` directly from the browser. The RodiumAi gateway must allow CORS from OpenThorn origins — set `CORS_EXTRA_ORIGINS=https://openthorn.app,https://www.openthorn.app,http://localhost:5173` on the FastAPI gateway (see `rodiumai_fastapi/.env.example`).

## License

Copyright (c) 2026 Thomas Tschinkel. All rights reserved.

This source code is made available for reference and educational purposes. You may not use it to operate a competing commercial service without written permission.
