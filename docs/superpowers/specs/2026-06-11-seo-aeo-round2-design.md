# SEO/AEO Round 2 — Design

**Date:** 2026-06-11
**Status:** Approved by Thomas (pending spec review)

## Goal

Round 1 (2026-06-10 plan) shipped prerendered `<head>` metadata, JSON-LD (Organization, WebSite, SoftwareApplication, BlogPosting, FAQPage), a generated sitemap, AI-crawler-friendly `robots.txt`, and `llms.txt`. But the page **body** is still an empty `<div id="root">` — most AI/answer-engine crawlers (GPTBot, ClaudeBot, PerplexityBot) do not execute JavaScript, so they cannot read or cite any actual page content.

Round 2 makes the content itself crawlable and citable:

1. Real body prerendering via React SSR at build time
2. `llms-full.txt` + deeper structured data
3. New AEO content pages (comparisons, listicle, how-tos, glossary)
4. Per-page OG images + IndexNow distribution

## Non-goals

- No SSR framework migration (no Next.js); the app stays a Vite SPA with a build-time prerender step.
- App pages (dashboard, builder, project pages) stay client-only — only public marketing/content routes are prerendered.
- No new runtime serverless functions: OG images are build-time static files, IndexNow is a build/deploy script.
- No per-term glossary pages (thin-content risk); one glossary page with anchors.

## 1. Real body prerendering (SSR at build time)

**Architecture:** add a Vite SSR build producing a Node-renderable bundle, consumed by the existing `scripts/prerender.mjs`.

- **New `src/entry-ssr.tsx`:** exports `render(path: string): string` that returns the HTML for a public route using `react-dom/server` `renderToString`, wrapping the route tree in React Router's `StaticRouter`. Built with `vite build --ssr src/entry-ssr.tsx` (output e.g. `dist-ssr/entry-ssr.js`). Vite's SSR build handles CSS modules, `?raw` imports, and Framer Motion — plain Node cannot import the page components directly.
- **Route scope:** exactly the public routes already listed in `scripts/prerender.mjs` (home, pricing, blog index, blog posts, FAQ, changelog, legal pages) plus the new content routes from section 3.
- **Auth decoupling:** public pages call `useAuth()`; `HomePage` returns `null` while `loading=true`. The SSR entry wraps routes in a stub auth provider with `{ user: null, loading: false }` so pages render logged-out marketing content. The Supabase client must not be constructed during SSR — gate its creation behind `typeof window !== 'undefined'` (or ensure the stub provider prevents the import from executing browser-only code at module load).
- **Injection:** `prerender.mjs` imports the SSR bundle, calls `render(path)` per route, and replaces `<div id="root"></div>` with `<div id="root">{html}</div>` in the per-route HTML it already writes. Head metadata injection is unchanged.
- **Hydration:** `src/main.tsx` uses `hydrateRoot` when `#root` has child nodes, else `createRoot`. Dev server and non-prerendered routes are unaffected. Hydration mismatches must not break the page (React recovers by re-rendering; we avoid known mismatch sources: no `Date.now()`/random values in public page render output).
- **Browser-only code:** any component in the public tree touching `window`/`document` at render time must be guarded or deferred to effects. Found cases are fixed as part of this work.
- **Verification:** `scripts/verify-prerender.mjs` is extended to assert each prerendered route contains expected **visible body text** (e.g. a known FAQ question, the hero headline), not just meta tags.

## 2. llms-full.txt + schema depth

- **`dist/llms-full.txt`** generated at build time by the prerender step: the key-facts block from `llms.txt`, full markdown of every blog post (sources in `src/content/blog/*.md`), all FAQ questions and answers, and a pricing-model explanation. `public/llms.txt` gains a link to `https://www.openthorn.app/llms-full.txt`.
- **Schema additions:**
  - `BreadcrumbList` on blog posts and legal pages (runtime via `useJsonLd` + build-time via prerender, matching the existing dual pattern).
  - `HowTo` JSON-LD on the new how-to guides.
  - `dateModified` on `BlogPosting` — new optional field in `blog-meta.json`, defaulting to `datePublished`.
  - `<lastmod>` per URL in the generated sitemap: blog posts use their `dateModified`/`date`; other routes use the build date.

## 3. AEO content pages

All copy drafted by Claude, edited by Thomas afterward. Competitor claims (pricing, features) are verified against current public sources via web search at writing time — no invented claims, honest comparisons.

- **Comparison hub:** `/compare/lovable`, `/compare/bolt`, `/compare/v0`. One `ComparePage` component + `src/data/compare-meta.json` (mirroring the `blog-meta.json` pattern so `prerender.mjs` reads the same source). Each page: feature/pricing comparison table centered on BYOK vs subscription, prose sections, and 2–3 "is X better than Y"-style Q&As emitted as FAQPage JSON-LD.
- **Listicle:** blog post "Best BYOK AI website builders in 2026" with `ItemList` JSON-LD.
- **How-to guides:** two blog posts — "How to build a website with AI using your own API key" and "How to get an API key (OpenAI, Anthropic, Gemini)" — each with `HowTo` JSON-LD steps.
- **Glossary:** `/glossary` route, single page with anchor-linked definitions (BYOK, AI agent, token, context window, system prompt, subscription vs BYOK pricing), `DefinedTermSet`/`DefinedTerm` JSON-LD.
- **Wiring:** every new route is added to the prerender route list, sitemap, `llms.txt`, and `llms-full.txt`; internal links added from FAQ/blog/footer where natural.

## 4. OG images + distribution

- **Build-time OG cards:** `satori` + `@resvg/resvg-js` as devDependencies. A branded template (dark token background, Fraunces title text, OpenThorn mark) rendered to `dist/og/<slug>.png` (1200×630) for every public route and blog post during prerender. Each prerendered page's `og:image`/`twitter:image` points to its card; `usePageTitle` runtime values updated to match. Font data for satori comes from the existing Fontsource package files.
- **IndexNow:** a static key file in `public/` plus `scripts/indexnow.mjs` that submits the sitemap's URLs to the IndexNow endpoint. Run manually after deploys (documented), optionally wired to a Vercel deploy hook later.
- **Manual checklist (not code):** resubmit sitemap in Google Search Console after first deploy of this work.

## Build pipeline after this work

```
tsc -b && vite build && vite build --ssr && node scripts/prerender.mjs
```

`prerender.mjs` then performs: SSR body injection, head metadata injection, JSON-LD injection, OG card generation, sitemap (with lastmod), and `llms-full.txt` generation.

## Testing

- `verify-prerender.mjs` asserts visible body text per route, valid JSON-LD blocks, og:image paths existing in `dist/og/`, and `llms-full.txt` containing each blog post title.
- Existing vitest suite must stay green; new pure logic (e.g. llms-full assembly, sitemap lastmod) gets unit tests where it lives in importable modules.
- Manual: Google Rich Results test on home, one blog post, one compare page; OpenGraph debugger on one route.

## Risks

- **Hydration mismatches** on public pages (e.g. auth-dependent nav). Mitigation: stub auth state matches the client's initial logged-out state; verify in browser console after build.
- **SSR import crashes** from browser-only globals in the public-page module graph. Mitigation: fix with guards; the SSR build will surface these at build time, not in production.
- **Competitor pages going stale.** Mitigation: comparison copy avoids volatile specifics where possible and states a "last verified" date on each compare page.
