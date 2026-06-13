# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git

Never add `Co-Authored-By` lines to commit messages. Thomas is the sole developer on this project.

## Project

**OpenThorn** (package/repo name: `bloom`) — a BYOK (bring-your-own-key) AI website builder. Users connect their own LLM provider API keys; a custom agent generates complete websites, previews them in-browser via esbuild-wasm, and deploys them to Netlify. The product name is OpenThorn; internal naming (package, dev plugin, some paths) still uses "bloom". Custom DOM events are namespaced `openthorn:` (e.g. `openthorn:require-auth`).

## Commands

```bash
npm run dev        # Vite dev server (http://localhost:5173) with local /api/* shims
npm run build      # tsc -b && vite build
npm run lint       # ESLint
npm run test       # vitest run (all tests)
npx vitest run src/lib/__tests__/deploy.test.ts   # single test file
npm run preview    # serve production build (localhost:4173)
```

Tests live in `src/lib/__tests__/`. There is no test watcher script; use `npx vitest` for watch mode.

## Architecture

React 19 + TypeScript + Vite 6 SPA. React Router v7, CSS Modules per component/page, Framer Motion for animation. Supabase provides auth, Postgres (with RLS on every table), Realtime (collaboration presence), and storage. Serverless API runs on Vercel Functions; user-generated sites deploy to Netlify.

### The agent (the core of the product)

`src/lib/agent.ts` (~2,400 lines) orchestrates the AI agent loop. It is supported by sibling modules:

- `agent-prompt.ts` — system prompt, tool definitions, skill loading, thinking-budget/reasoning params per provider, loop-break and turn-budget prompts
- `agent-plan.ts` — persistent plan/requirements checklist (`PLAN.md`-style working memory surfaced in the UI); guard against empty `set_requirements` wiping the checklist
- `agent-memory.ts` — cross-session lessons and changelog entries
- `agent-thinking.ts` — thinking-level profiles per provider
- `agent-vision.ts` — screenshot-based visual verification

Key behaviors to preserve when modifying the agent: multi-provider support (18 providers incl. OpenAI, Anthropic, Gemini, RodiumAi, Bedrock, Ollama) with provider fallback and a circuit breaker; per-call retry with exponential backoff + Retry-After on transient failures (429/5xx/network/timeout — user aborts are never retried) and mid-run provider failover (failed providers excluded for the rest of the run, max 2 switches); loop detection that only tracks *failing* tool calls (counting successes causes false positives); a deterministic verification gate on the `done` tool (files unchanged since last compile, plan complete, interactive smoke test passes); conversation-prefix prompt caching with per-run token/cache usage telemetry (`RunUsage`, emitted as `usage` progress events); malformed tool-call JSON surfaced back to the model as structured error results (never silently dropped); `dirtySinceCompile` tracking when files change.

### In-browser preview pipeline

`preview-bundle.ts` bundles generated project files with esbuild-wasm using `virtualFsPlugin.ts` (virtual filesystem; npm packages resolved via esm.sh, restricted by `allowed-packages.ts`). `preview-runtime-check.ts` runs runtime/interactive smoke tests against the preview iframe; `preview-screenshot.ts` captures it with html2canvas. `compiler.ts`/`typecheck.ts` handle compile checking. No server round-trip is involved.

### API layer — dual implementation

The serverless endpoints in `api/` (`deploy-netlify.ts`, `provider-keys.ts`) share logic through `api/_shared.ts` (Supabase JWT verification, per-user rate limiting — in-memory in dev, Upstash Redis in prod — and AES-256-GCM encryption with per-user derived keys from `KEY_ENCRYPTION_SECRET`).

**Important:** `vite.config.ts` contains dev middleware shims that re-implement these endpoints by importing from `api/_shared.ts`, so `/api/*` behaves identically in `vite dev` and on Vercel. When changing endpoint behavior, update both the `api/` function and the corresponding shim in `vite.config.ts`, and keep shared logic in `_shared.ts`.

Provider API keys are encrypted server-side and never exposed raw to the client.

### Routing and code-splitting

All routes are defined in `src/App.tsx`. Every page except the landing page is lazy-loaded so the heavy builder stack (esbuild-wasm, jszip, html2canvas, the agent) stays out of the initial bundle. `vite.config.ts` also defines manual vendor chunks. Keep new heavy dependencies out of eagerly-loaded modules.

### Database

Schema lives in `supabase/migrations/` (applied via `supabase db push` or the dashboard, in order). All tables use RLS; past migrations fixed RLS infinite recursion and locked down profiles/deployments SELECT — be careful with cross-table policies.

### Other directories

- `src/components/` — one folder per component with co-located `.module.css`
- `src/data/`, `src/content/` — static content (blog posts)
- `docs/superpowers/plans/` — dated implementation plans for past features
- `remotion/` — separate Remotion project (promotional video); has its own package.json, not part of the app build
- `vercel.json` — SPA rewrites + security headers (strict CSP allowlisting self, fonts, esm.sh, blob:, wss:); update CSP when adding external origins

## Environment

Required: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `NETLIFY_TOKEN`, `KEY_ENCRYPTION_SECRET` (48 bytes, `openssl rand -base64 48`). Optional: `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` for production rate limiting. See `.env.example`.

## Conventions

- Fonts are self-hosted via Fontsource packages (`@fontsource-variable/fraunces`, `@fontsource/roboto`) — do not add Google Fonts CDN links (privacy/CSP requirement)
- Styling uses CSS custom-property design tokens defined in `src/index.css` (`--color-bg`, `--color-text`, `--color-accent`, shared keyframes like `pageRise`/`pageFade`); use tokens instead of hardcoded hex colors
- Production builds have source maps disabled
