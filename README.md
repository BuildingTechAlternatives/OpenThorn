# OpenThorn

**AI-powered website builder. Describe what you want — get a complete, deployable website.**

OpenThorn is a bring-your-own-key (BYOK) platform that generates full, production-ready websites from natural language prompts. Users connect their own LLM provider API keys, so there are no subscriptions and no lock-in.

---

## Features

- **Natural-language generation** — describe a website in plain language; the agent writes, bundles, and previews it in-browser
- **Multi-provider AI** — connect OpenAI, Anthropic, Google Gemini, DeepSeek, Mistral, Groq, Together AI, xAI, Cohere, Perplexity, OpenRouter, Ollama, Fireworks, Cerebras, Azure OpenAI, Amazon Bedrock, or Nvidia NIM
- **Live preview** — instant in-browser preview powered by esbuild-wasm (no server round-trip)
- **One-click deploy** — publish directly to Netlify via the integrated deployment API
- **Real-time collaboration** — multiplayer editing with presence indicators (Supabase Realtime)
- **Encrypted key storage** — API keys are encrypted at rest with AES-256-GCM and never exposed to the client
- **Templates & community** — start from curated templates or browse community-published projects

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, React Router v7, Vite 6 |
| Styling | CSS Modules, Framer Motion |
| Auth & Database | Supabase (PostgreSQL, Auth, Realtime, Storage) |
| AI agent | Custom agent runtime (`src/lib/agent.ts`) |
| In-browser bundler | esbuild-wasm |
| Serverless API | Vercel Functions |
| User site hosting | Netlify |
| Rate limiting | Upstash Redis (optional) |

---

## Getting Started

### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project
- A [Netlify](https://app.netlify.com/user/applications) personal access token
- At least one LLM provider API key (added in-app after sign-up)

### Installation

```bash
git clone https://github.com/thomastschinkel/OpenThorn.git
cd OpenThorn
npm install
```

### Environment Variables

Copy the example file and fill in your values:

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
| `KEY_ENCRYPTION_SECRET` | Yes | 48-byte secret for API key encryption — generate with `openssl rand -base64 48` |
| `UPSTASH_REDIS_REST_URL` | No | Upstash Redis URL for production rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | No | Upstash Redis token |

### Database Setup

Apply the Supabase migrations:

```bash
supabase db push
```

Or apply the SQL files in `supabase/migrations/` manually through the Supabase dashboard, in order.

### Development

```bash
npm run dev
```

Starts Vite on `http://localhost:5173` with local API shims for the serverless functions.

---

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start development server with HMR |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |
| `npm run test` | Run Vitest unit tests |

---

## Project Structure

```
├── src/
│   ├── components/        # Reusable UI components
│   ├── pages/             # Route-level pages (code-split)
│   ├── lib/               # Core utilities
│   │   ├── agent.ts       # AI agent orchestration
│   │   ├── crypto.ts      # AES-256-GCM key encryption
│   │   ├── deploy.ts      # Netlify deployment client
│   │   └── preview-bundle.ts  # In-browser esbuild bundler
│   └── data/              # Static content (blog posts)
├── api/
│   ├── _shared.ts         # JWT verification, rate limiting, encryption
│   ├── deploy-netlify.ts  # Netlify deployment endpoint
│   └── provider-keys.ts   # API key storage endpoint
├── supabase/
│   └── migrations/        # Database schema migrations
├── public/                # Static assets and provider logos
├── docs/                  # Security documentation
├── vercel.json            # Vercel deployment config (SPA routing + security headers)
└── .env.example           # Environment variable template
```

---

## Deployment

The project deploys on **Vercel** with the configuration in `vercel.json`.

### Deploy to Vercel

1. Import the repository in the [Vercel dashboard](https://vercel.com/new)
2. Set all required environment variables under **Project → Settings → Environment Variables**
3. Deploy — Vercel will run `npm run build` automatically

### Security Headers

`vercel.json` configures production security headers on every response:

- `Strict-Transport-Security` (HSTS, 1-year max-age)
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Content-Security-Policy` (strict allowlist — self, fonts, esm.sh, blob:, wss:)
- `Permissions-Policy` (camera, microphone, geolocation disabled)

---

## Security

- **Encrypted keys** — provider API keys are encrypted with AES-256-GCM before storage; the raw key never leaves the server
- **Row-level security** — all Supabase tables are protected by PostgreSQL RLS policies
- **Server-side JWT verification** — every API call validates the Supabase JWT before processing
- **Rate limiting** — per-user, per-endpoint limits (in-memory in development; Upstash Redis in production)
- **No source maps** — production builds omit source maps

See `docs/security-csp.md` for Content Security Policy details.

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m "feat: add your feature"`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a pull request

---

## License

This project is proprietary. All rights reserved.
