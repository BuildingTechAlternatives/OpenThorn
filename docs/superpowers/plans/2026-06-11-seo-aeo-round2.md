# SEO/AEO Round 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make OpenThorn's public pages fully readable and citable by non-JS AI crawlers (real SSR body content), add `llms-full.txt` and deeper structured data, ship AEO content pages (comparisons, listicle, how-tos, glossary), and generate per-page OG images plus IndexNow pings.

**Architecture:** A Vite SSR build (`src/entry-ssr.tsx`, built to `dist-ssr/`) exports an async `render(path)` using React 19's `prerender` from `react-dom/static` (it waits for `React.lazy`/Suspense, which `renderToString` does not). `scripts/prerender.mjs` calls it per public route and injects real HTML into `#root`, replacing today's hand-written `contentHtml` snapshots. New content (compare pages, glossary, 3 blog posts) rides the existing JSON-meta + markdown pipeline so prerender/sitemap/llms files derive from the same sources. OG cards are rendered at build time with satori + resvg. Spec: `docs/superpowers/specs/2026-06-11-seo-aeo-round2-design.md`.

**Tech Stack:** React 19 (`react-dom/static`), React Router v7 `StaticRouter`, Vite 6 SSR build, satori + `@resvg/resvg-js` + `@fontsource/fraunces` (devDeps), Node ESM scripts.

**Verified competitor facts (2026-06-11)** — used in Tasks 8–9; sources: [Lovable docs](https://docs.lovable.dev/introduction/plans-and-credits), [bolt.new/pricing](https://bolt.new/pricing), [v0.app/pricing](https://v0.app/pricing):
- Lovable: credit-based; Free ≈ 5 credits/day (~30/mo); Pro from $25/mo for 100 credits; Business from $50/mo; no BYOK.
- Bolt.new: token packs; Free 1M tokens/mo (300K/day cap); Pro $25/mo (~10–13M tokens); Teams $30/member/mo; no BYOK.
- v0 (Vercel): credit metering over tokens; Free $5/mo included credits; Premium $20/mo; Team $30/user/mo; no BYOK; Next.js/Vercel-centric.

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Modify | `src/lib/AuthContext.tsx` | Export `StaticAuthProvider` for SSR |
| Create | `src/entry-ssr.tsx` | SSR entry: `render(path)` via `react-dom/static` |
| Modify | `src/main.tsx` | `hydrateRoot` when `#root` has prerendered children |
| Modify | `package.json` | SSR build step, new devDeps, `indexnow` script |
| Modify | `.gitignore` | Ignore `dist-ssr/` |
| Modify | `scripts/prerender.mjs` | SSR body injection, new routes, OG wiring, llms-full |
| Modify | `scripts/verify-prerender.mjs` | Body-text, OG, llms-full assertions |
| Create | `src/content/blog/how-to-build-a-website-with-ai-byok.md` | How-to post 1 |
| Create | `src/content/blog/how-to-get-an-ai-api-key.md` | How-to post 2 |
| Create | `src/content/blog/best-byok-ai-website-builders-2026.md` | Listicle post |
| Modify | `src/data/blog-meta.json` | New posts + `dateModified`/`howTo`/`itemList` fields |
| Modify | `src/data/blogPosts.ts` | Map new content files; extend interface |
| Modify | `src/pages/BlogPostPage.tsx` | Emit HowTo/ItemList JSON-LD when present |
| Create | `src/data/compare-meta.json` | Comparison page content (3 competitors) |
| Create | `src/pages/ComparePage.tsx` + `ComparePage.module.css` | `/compare/:slug` |
| Create | `src/data/glossary.json` | Glossary terms |
| Create | `src/pages/GlossaryPage.tsx` + `GlossaryPage.module.css` | `/glossary` |
| Modify | `src/App.tsx` | Routes for compare + glossary |
| Modify | `src/components/Footer/Footer.tsx` | Links to new pages |
| Create | `scripts/llms-full.mjs` | Builds `dist/llms-full.txt` |
| Modify | `public/llms.txt` | Link llms-full.txt + new pages |
| Create | `scripts/og-cards.mjs` | satori/resvg card generator |
| Create | `public/7f3a9c2e5b8d4f6a1c0e9b7d3a5f8c2e.txt` | IndexNow key file |
| Create | `scripts/indexnow.mjs` | Submit sitemap URLs to IndexNow |

---

# Phase A — Real SSR body prerendering

### Task 1: StaticAuthProvider for SSR

**Files:**
- Modify: `src/lib/AuthContext.tsx`

- [ ] **Step 1: Add the provider**

Append to `src/lib/AuthContext.tsx` (after `SupabaseAuthProvider`, before `useAuth`):

```tsx
/**
 * Auth provider for build-time SSR (src/entry-ssr.tsx): renders children in the
 * logged-out, non-loading state so public pages emit their full marketing
 * content. All actions are no-ops — nothing interactive runs during prerender.
 */
export function StaticAuthProvider({ children }: { children: ReactNode }) {
  return (
    <AuthContext.Provider
      value={{
        user: null,
        session: null,
        loading: false,
        signIn: async () => ({}),
        signUp: async () => ({}),
        signInWithGoogle: async () => {},
        signInWithGitHub: async () => {},
        resetPassword: async () => ({}),
        signOut: async () => {},
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc -b`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/lib/AuthContext.tsx
git commit -m "feat(seo): add StaticAuthProvider for build-time SSR"
```

### Task 2: SSR entry + build wiring

**Files:**
- Create: `src/entry-ssr.tsx`
- Modify: `package.json` (build script)
- Modify: `.gitignore`

- [ ] **Step 1: Create `src/entry-ssr.tsx`**

```tsx
import { StrictMode } from 'react'
import { prerender } from 'react-dom/static'
// StaticRouter lives in the core react-router package in v7 (react-router-dom
// re-exports only the DOM/browser APIs).
import { StaticRouter } from 'react-router'
import { StaticAuthProvider } from './lib/AuthContext'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary'

/**
 * Build-time SSR used by scripts/prerender.mjs. react-dom/static's prerender
 * (unlike renderToString) waits for Suspense — including the React.lazy route
 * pages — so the returned HTML contains the fully rendered page body.
 */
export async function render(path: string): Promise<string> {
  const { prelude } = await prerender(
    <StrictMode>
      <ErrorBoundary>
        <StaticRouter location={path}>
          <StaticAuthProvider>
            <App />
          </StaticAuthProvider>
        </StaticRouter>
      </ErrorBoundary>
    </StrictMode>
  )

  const reader = prelude.getReader()
  const decoder = new TextDecoder()
  let html = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    html += decoder.decode(value, { stream: true })
  }
  return html
}
```

- [ ] **Step 2: Add the SSR build to the pipeline**

In `package.json`, change:

```json
"build": "node scripts/generate-changelog.mjs && tsc -b && vite build && node scripts/prerender.mjs"
```

to:

```json
"build": "node scripts/generate-changelog.mjs && tsc -b && vite build && vite build --ssr src/entry-ssr.tsx --outDir dist-ssr && node scripts/prerender.mjs"
```

- [ ] **Step 3: Ignore the SSR bundle**

Append to `.gitignore`:

```
dist-ssr
```

- [ ] **Step 4: Verify the SSR build and render work end to end**

```bash
npx tsc -b && npx vite build --ssr src/entry-ssr.tsx --outDir dist-ssr
node -e "import('./dist-ssr/entry-ssr.js').then(async (m) => { const h = await m.render('/faq'); console.log(h.includes('Questions,') ? 'SSR OK' : 'MISSING CONTENT'); console.log(h.length, 'chars') })"
```

Expected: `SSR OK` and a length in the tens of thousands.

**If this fails with a browser-global error** (`window is not defined`, `document is not defined`, etc.): the stack trace names the component. Fix by moving the browser access into `useEffect` or guarding with `typeof window !== 'undefined'`. Known-safe: `App.tsx`, `Layout`, `usePageTitle`, `useJsonLd` only touch `window`/`document` inside effects. Re-run until it passes.

- [ ] **Step 5: Commit**

```bash
git add src/entry-ssr.tsx package.json .gitignore
git commit -m "feat(seo): add Vite SSR build entry for build-time page rendering"
```

### Task 3: Inject SSR HTML in prerender.mjs

**Files:**
- Modify: `scripts/prerender.mjs`

- [ ] **Step 1: Load the SSR renderer**

In `scripts/prerender.mjs`, add to the imports:

```js
import { pathToFileURL } from 'url'
```

and after the `const changelog = ...` line:

```js
const { render } = await import(pathToFileURL(join(rootDir, 'dist-ssr', 'entry-ssr.js')).href)
```

- [ ] **Step 2: Replace snapshot injection with SSR injection**

In `injectMeta(html, route)`, replace the `contentHtml` block:

```js
  // Static content snapshot inside #root: real text for crawlers that don't run
  // JS. React's createRoot wipes it when the app hydrates, so users only see it
  // for a moment on slow connections.
  if (route.contentHtml) {
    out = out.replace(
      '<div id="root"></div>',
      `<div id="root"><div style="max-width:720px;margin:0 auto;padding:48px 24px;line-height:1.6">${route.contentHtml}\n</div></div>`
    )
  }
```

with a new `appHtml` parameter:

```js
  // Real SSR body: the actual React page rendered at build time, so non-JS
  // crawlers (GPTBot, ClaudeBot, PerplexityBot) read the same content users see.
  // src/main.tsx hydrates this markup with hydrateRoot.
  if (appHtml) {
    out = out.replace('<div id="root"></div>', `<div id="root">${appHtml}</div>`)
  }
```

Change the signature to `function injectMeta(html, route, appHtml)` and the main loop to:

```js
for (const route of routes) {
  const appHtml = await render(route.path)
  const html = injectMeta(baseHtml, route, appHtml)
  ...
}
```

(The loop is already at module top level in an ESM file, so `await` is legal.)

- [ ] **Step 3: Delete dead code**

Remove from `prerender.mjs`: the `markdownToHtml` function, the `escapeHtml` function **if** no longer referenced (blog/FAQ `contentHtml` templates were its only users), and every `contentHtml:` property in the `routes` array. Keep `escapeAttr`, all meta/JSON-LD injection, and the sitemap section unchanged.

- [ ] **Step 4: Full build + spot-check**

```bash
npm run build
node -e "const h = require('fs').readFileSync('dist/faq/index.html','utf8'); console.log(h.includes('aria-expanded') && h.includes('17 AI providers') ? 'FAQ SSR BODY OK' : 'FAIL')"
node -e "const h = require('fs').readFileSync('dist/blog/what-is-a-byok-ai-website-builder/index.html','utf8'); console.log(h.includes('What does BYOK mean?') ? 'BLOG SSR BODY OK' : 'FAIL')"
```

Expected: `FAQ SSR BODY OK`, `BLOG SSR BODY OK`.

- [ ] **Step 5: Run the existing verifier**

Run: `node scripts/verify-prerender.mjs`
Expected: the two content-snapshot checks (`<h3>What does BYOK mean?</h3>`, `<h3>The problem with AI builders</h3>`) may FAIL because SSR markup wraps text in component markup instead of bare `<h3>` — that is fixed in Task 5. All other checks must pass.

- [ ] **Step 6: Commit**

```bash
git add scripts/prerender.mjs
git commit -m "feat(seo): prerender real SSR page bodies instead of hand-written snapshots"
```

### Task 4: Hydration in main.tsx

**Files:**
- Modify: `src/main.tsx`

- [ ] **Step 1: Switch to conditional hydrateRoot**

Replace the `createRoot(...)` call at the bottom of `src/main.tsx` with:

```tsx
const container = document.getElementById('root')!
const app = (
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <SupabaseAuthProvider>
          <App />
        </SupabaseAuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>
)

// Prerendered routes ship real SSR markup inside #root — hydrate it. The dev
// server and any non-prerendered entry HTML have an empty root — render fresh.
// A hydration mismatch (e.g. visiting /dashboard, which is served the
// prerendered home shell by the SPA rewrite) makes React discard the server
// DOM and client-render — same end state as createRoot.
if (container.hasChildNodes()) {
  hydrateRoot(container, app)
} else {
  createRoot(container).render(app)
}
```

and change the import: `import { createRoot, hydrateRoot } from 'react-dom/client'`.

- [ ] **Step 2: Verify dev server still works**

Run: `npm run dev` (background), open `http://localhost:5173/` — page renders, no console errors. Stop the server.

- [ ] **Step 3: Verify the production build hydrates**

```bash
npm run build
npm run preview
```

Open `http://localhost:4173/faq` — page is interactive (accordion opens). Console may log a hydration mismatch warning (auth `loading` differs); the page must still work. Stop the server.

- [ ] **Step 4: Commit**

```bash
git add src/main.tsx
git commit -m "feat(seo): hydrate prerendered SSR markup with hydrateRoot"
```

### Task 5: Verifier covers SSR bodies

**Files:**
- Modify: `scripts/verify-prerender.mjs`

- [ ] **Step 1: Update body-content checks**

In the `checks` array, replace the two snapshot checks:

```js
  ['dist/blog/what-is-a-byok-ai-website-builder/index.html', '<h3>What does BYOK mean?</h3>', 'byok post: content snapshot'],
  ['dist/blog/introducing-openthorn/index.html', '<h3>The problem with AI builders</h3>', 'intro post: content snapshot'],
```

with SSR-tolerant text checks plus new body assertions:

```js
  ['dist/blog/what-is-a-byok-ai-website-builder/index.html', 'What does BYOK mean?', 'byok post: SSR body'],
  ['dist/blog/introducing-openthorn/index.html', 'The problem with AI builders', 'intro post: SSR body'],
  ['dist/index.html', 'deploy anywhere', 'home: hero subtitle SSR body'],
  ['dist/faq/index.html', 'aria-expanded', 'faq: interactive markup SSR body'],
  ['dist/pricing/index.html', '<div id="root"><', 'pricing: non-empty root'],
  ['dist/changelog/index.html', '<div id="root"><', 'changelog: non-empty root'],
```

Also update the existing `'home: content snapshot'` label/needle pair `['dist/index.html', 'Build with OpenThorn', ...]` — the needle still matches the SSR hero `<h1>`; just rename the label to `'home: hero SSR body'`.

- [ ] **Step 2: Run it**

```bash
npm run build && node scripts/verify-prerender.mjs
```

Expected: all checks `OK`, exit 0.

- [ ] **Step 3: Commit**

```bash
git add scripts/verify-prerender.mjs
git commit -m "test(seo): verify SSR page bodies in prerender output"
```

---

# Phase B — AEO content pages

### Task 6: Two how-to blog posts (with HowTo JSON-LD)

**Files:**
- Create: `src/content/blog/how-to-build-a-website-with-ai-byok.md`
- Create: `src/content/blog/how-to-get-an-ai-api-key.md`
- Modify: `src/data/blog-meta.json`
- Modify: `src/data/blogPosts.ts`
- Modify: `src/pages/BlogPostPage.tsx`
- Modify: `scripts/prerender.mjs`

- [ ] **Step 1: Write `src/content/blog/how-to-build-a-website-with-ai-byok.md`**

```markdown
Building a website with AI no longer requires a subscription. With a BYOK (bring-your-own-key) builder like OpenThorn, you connect an API key from an AI provider you already trust, describe what you want, and pay only for the tokens you use — typically cents to a few dollars per site.

Here is the full process, start to finish.

## Step 1: Choose an AI provider and get an API key

Any of OpenThorn's 17 supported providers works: OpenAI, Anthropic, Google Gemini, DeepSeek, Mistral AI, Groq, Together AI, xAI, Cohere, Perplexity, OpenRouter, Ollama, Fireworks AI, Cerebras, Azure OpenAI, Amazon Bedrock, or NVIDIA NIM. If you are unsure, OpenAI or Anthropic are the easiest starting points. See our guide on [how to get an API key](/blog/how-to-get-an-ai-api-key) for exact steps.

## Step 2: Create a free OpenThorn account

Sign up at [openthorn.app](https://www.openthorn.app). The platform itself is free — there is no trial, no credit card, and no subscription tier to pick.

## Step 3: Connect your API key

Open the Providers page in the app and paste your key. Keys are encrypted server-side with AES-256-GCM and never exposed raw to the browser. You stay in control through your provider's dashboard: set spend limits, watch usage, rotate the key any time.

## Step 4: Describe the website you want

Create a project and write a plain-language description: the kind of site, the pages it needs, the tone, anything you care about. OpenThorn's agent plans the build, generates real React code, and compiles it in your browser as it works.

## Step 5: Preview and iterate

The live preview runs entirely in your browser. Ask for changes the same way you asked for the site — "make the hero darker", "add a contact form" — and the agent edits the code. The agent verifies its own work with compile checks and an interactive smoke test before it reports done.

## Step 6: Deploy or export

One click deploys to Netlify on a public URL. Or export the full source as a zip — it is standard React + Vite code that runs anywhere. There is no export paywall and no proprietary format.

## What it costs

OpenThorn charges nothing. Your provider bills you for tokens at their published rates — compare models on the [pricing page](/pricing). A typical site costs between a few cents (budget models like DeepSeek or Gemini Flash) and a few dollars (flagship models like Claude or GPT).
```

- [ ] **Step 2: Write `src/content/blog/how-to-get-an-ai-api-key.md`**

```markdown
Every BYOK tool — including OpenThorn — needs an API key from an AI provider. Getting one takes about five minutes. This guide covers the three most popular providers; the pattern is the same everywhere: create an account, add a payment method, generate a key, and set a spend limit.

## OpenAI

1. Go to [platform.openai.com](https://platform.openai.com) and sign up (this is separate from a ChatGPT account subscription).
2. Add a payment method under Settings → Billing. New accounts may need a small prepaid credit.
3. Open **API keys**, click **Create new secret key**, and copy it — it is shown only once.
4. Under **Limits**, set a monthly budget so usage can never surprise you.

## Anthropic (Claude)

1. Go to [console.anthropic.com](https://console.anthropic.com) and create an account.
2. Add billing under **Plans & billing** — Claude API usage is prepaid or invoiced depending on tier.
3. Open **API keys**, create a key, and copy it.
4. Set a workspace spend limit under the workspace settings.

## Google Gemini

1. Go to [aistudio.google.com](https://aistudio.google.com) and sign in with a Google account.
2. Click **Get API key** — Google offers a free tier with rate limits, so you can start without billing.
3. For higher limits, enable billing on the associated Google Cloud project.

## Using the key

Paste the key into OpenThorn's Providers page — it is encrypted server-side and never exposed raw. Then describe the website you want and build. Full walkthrough: [how to build a website with AI using your own API key](/blog/how-to-build-a-website-with-ai-byok).

Three safety habits worth keeping: set a spend limit before you build anything, never commit a key to a public repo, and rotate keys occasionally from your provider dashboard.
```

- [ ] **Step 3: Add meta entries with HowTo data**

In `src/data/blog-meta.json`, append after the existing two entries:

```json
  {
    "slug": "how-to-build-a-website-with-ai-byok",
    "title": "How to Build a Website with AI Using Your Own API Key",
    "date": "2026-06-12",
    "excerpt": "Build and deploy a complete website with AI for cents, not subscriptions: get an API key, connect it to OpenThorn, describe what you want, and ship — in six steps.",
    "howTo": {
      "name": "Build a website with AI using your own API key",
      "steps": [
        { "name": "Choose an AI provider and get an API key", "text": "Pick any of the 17 supported providers (OpenAI, Anthropic, Google Gemini, and more) and generate an API key in its developer console." },
        { "name": "Create a free OpenThorn account", "text": "Sign up at openthorn.app — free, no credit card, no subscription." },
        { "name": "Connect your API key", "text": "Paste the key on the Providers page; it is encrypted server-side with AES-256-GCM." },
        { "name": "Describe the website you want", "text": "Create a project and describe the site in plain language; the agent generates real React code." },
        { "name": "Preview and iterate", "text": "Use the in-browser live preview and ask for changes conversationally until it is right." },
        { "name": "Deploy or export", "text": "Deploy to Netlify in one click, or export the full source code and host it anywhere." }
      ]
    }
  },
  {
    "slug": "how-to-get-an-ai-api-key",
    "title": "How to Get an AI API Key (OpenAI, Anthropic, Google Gemini)",
    "date": "2026-06-12",
    "excerpt": "A five-minute guide to creating an API key with OpenAI, Anthropic, or Google Gemini — including billing setup and the spend limits that keep costs predictable.",
    "howTo": {
      "name": "Get an AI API key",
      "steps": [
        { "name": "Create a provider account", "text": "Sign up at platform.openai.com, console.anthropic.com, or aistudio.google.com." },
        { "name": "Add billing", "text": "Add a payment method or prepaid credit (Gemini offers a free tier without billing)." },
        { "name": "Generate the key", "text": "Create a new secret key in the provider's API keys section and copy it — it is shown only once." },
        { "name": "Set a spend limit", "text": "Configure a monthly budget in the provider dashboard so usage can never surprise you." }
      ]
    }
  }
```

- [ ] **Step 4: Map content + extend the interface in `src/data/blogPosts.ts`**

Add imports and map entries:

```ts
import howToBuildContent from '../content/blog/how-to-build-a-website-with-ai-byok.md?raw'
import howToKeyContent from '../content/blog/how-to-get-an-ai-api-key.md?raw'
```

In `contentBySlug` add:

```ts
  'how-to-build-a-website-with-ai-byok': howToBuildContent,
  'how-to-get-an-ai-api-key': howToKeyContent,
```

Extend the interface (after `ogImage?`):

```ts
  /** Optional HowTo structured data emitted as JSON-LD on the post page. */
  howTo?: { name: string; steps: { name: string; text: string }[] }
  /** Optional ItemList structured data (for listicle posts). */
  itemList?: string[]
```

- [ ] **Step 5: Emit the schemas at runtime in `src/pages/BlogPostPage.tsx`**

Read the file first. After the existing `useJsonLd(...)` call for BlogPosting, add a second hook call:

```tsx
  useJsonLd(
    post?.howTo
      ? {
          '@context': 'https://schema.org',
          '@type': 'HowTo',
          name: post.howTo.name,
          step: post.howTo.steps.map((s, i) => ({
            '@type': 'HowToStep',
            position: i + 1,
            name: s.name,
            text: s.text,
          })),
        }
      : post?.itemList
        ? {
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            itemListElement: post.itemList.map((name, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              name,
            })),
          }
        : {}
  )
```

(Hooks must be called unconditionally; an empty object schema is harmless and matches the existing `: {}` pattern in this file.)

- [ ] **Step 6: Emit the same schemas at build time**

In `scripts/prerender.mjs`, the blog routes are built from `blogMeta.map(...)`. Extend that mapping's `jsonLd` array:

```js
  ...blogMeta.map((post) => ({
    /* unchanged fields */
    jsonLd: [
      blogPostingJsonLd(post),
      breadcrumbJsonLd(post),
      ...(post.howTo
        ? [{
            '@context': 'https://schema.org',
            '@type': 'HowTo',
            name: post.howTo.name,
            step: post.howTo.steps.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, name: s.name, text: s.text })),
          }]
        : []),
      ...(post.itemList
        ? [{
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            itemListElement: post.itemList.map((name, i) => ({ '@type': 'ListItem', position: i + 1, name })),
          }]
        : []),
    ],
  })),
```

- [ ] **Step 7: dateModified support**

Also in `scripts/prerender.mjs`, update `blogPostingJsonLd` to include modification dates, and make blog route `lastmod` prefer them:

```js
function blogPostingJsonLd(post) {
  return {
    /* existing fields unchanged */
    datePublished: post.date,
    dateModified: post.dateModified ?? post.date,
    /* ... */
  }
}
```

and in the blog route mapping: `lastmod: post.dateModified ?? post.date`. Add the matching optional field to `src/data/blogPosts.ts`:

```ts
  /** ISO date of the last substantive edit; defaults to the publish date. */
  dateModified?: string
```

(No `dateModified` values are set in `blog-meta.json` yet — the field exists so future edits can declare freshness.)

- [ ] **Step 8: Build and verify**

```bash
npm run build
node -e "const h = require('fs').readFileSync('dist/blog/how-to-build-a-website-with-ai-byok/index.html','utf8'); console.log(h.includes('HowToStep') && h.includes('Choose an AI provider') ? 'HOWTO OK' : 'FAIL')"
npx vitest run
```

Expected: `HOWTO OK`; all tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/content/blog/how-to-build-a-website-with-ai-byok.md src/content/blog/how-to-get-an-ai-api-key.md src/data/blog-meta.json src/data/blogPosts.ts src/pages/BlogPostPage.tsx scripts/prerender.mjs
git commit -m "feat(aeo): add two how-to guides with HowTo JSON-LD"
```

### Task 7: Listicle post

**Files:**
- Create: `src/content/blog/best-byok-ai-website-builders-2026.md`
- Modify: `src/data/blog-meta.json`, `src/data/blogPosts.ts`

- [ ] **Step 1: Write `src/content/blog/best-byok-ai-website-builders-2026.md`**

```markdown
BYOK — bring your own key — means an AI builder runs on an API key you get directly from a provider like OpenAI or Anthropic. You pay the provider's raw per-token rates; the tool itself adds no markup and needs no subscription. Most popular AI builders (Lovable, Bolt.new, v0) do **not** work this way: they resell AI usage as credits or token packs.

If you specifically want BYOK, the field is small. Here are the options worth knowing in 2026.

## 1. OpenThorn

[OpenThorn](https://www.openthorn.app) is a free, browser-based BYOK website builder. You connect a key from any of 17 providers (OpenAI, Anthropic, Google Gemini, DeepSeek, Mistral, Groq, and more), describe the site you want, and an agent generates complete React code with a live in-browser preview. One-click Netlify deploy, full code export, no platform fee of any kind. Disclosure: this is our product — the rest of this list is genuinely worth a look if it fits you better.

**Best for:** building and deploying complete websites without a subscription.

## 2. bolt.diy

[bolt.diy](https://github.com/stackblitz-labs/bolt.diy) is the open-source sibling of Bolt.new. You run it yourself (locally or self-hosted) and plug in keys for the model of your choice. Powerful and free, but it is a developer tool: expect to clone a repo and manage your own environment, and hosting the result is on you.

**Best for:** developers who want full control and don't mind self-hosting.

## 3. Dyad

[Dyad](https://www.dyad.sh) is a local, open-source AI app builder that runs on your machine with your own keys. Strong for building full-stack apps privately; less streamlined than hosted tools for going from prompt to a live deployed website.

**Best for:** local-first builders who want everything on their own machine.

## What about Lovable, Bolt.new, and v0?

They are capable builders, but none of them supports BYOK as of June 2026: Lovable sells monthly credits (Pro from $25/month), Bolt.new sells token packs (Pro $25/month), and v0 meters credits on its own plans (Premium $20/month). If predictable subscription billing suits you, they work well — see our detailed comparisons: [OpenThorn vs Lovable](/compare/lovable), [OpenThorn vs Bolt.new](/compare/bolt), [OpenThorn vs v0](/compare/v0).

## How to choose

- Want a hosted, zero-setup builder with no subscription → OpenThorn.
- Want open source and full control, comfortable with setup → bolt.diy.
- Want everything local and private → Dyad.

New to BYOK? Start with [what a BYOK AI website builder is](/blog/what-is-a-byok-ai-website-builder) and [how to get an API key](/blog/how-to-get-an-ai-api-key).
```

- [ ] **Step 2: Add the meta entry**

Append to `src/data/blog-meta.json`:

```json
  {
    "slug": "best-byok-ai-website-builders-2026",
    "title": "The Best BYOK AI Website Builders in 2026",
    "date": "2026-06-12",
    "excerpt": "Most AI builders resell AI usage as credits. These tools let you bring your own API key instead — OpenThorn, bolt.diy, and Dyad compared, plus how they differ from Lovable, Bolt.new, and v0.",
    "itemList": ["OpenThorn", "bolt.diy", "Dyad"]
  }
```

- [ ] **Step 3: Map the content**

In `src/data/blogPosts.ts` add the import and `contentBySlug` entry:

```ts
import bestByokContent from '../content/blog/best-byok-ai-website-builders-2026.md?raw'
```

```ts
  'best-byok-ai-website-builders-2026': bestByokContent,
```

- [ ] **Step 4: Build and verify**

```bash
npm run build
node -e "const h = require('fs').readFileSync('dist/blog/best-byok-ai-website-builders-2026/index.html','utf8'); console.log(h.includes('ItemList') && h.includes('bolt.diy') ? 'LISTICLE OK' : 'FAIL')"
```

Expected: `LISTICLE OK`. (The ItemList JSON-LD comes from Task 6 Step 6's generic `itemList` handling.)

- [ ] **Step 5: Commit**

```bash
git add src/content/blog/best-byok-ai-website-builders-2026.md src/data/blog-meta.json src/data/blogPosts.ts
git commit -m "feat(aeo): add best-BYOK-builders listicle with ItemList JSON-LD"
```

### Task 8: Comparison pages (`/compare/:slug`)

**Files:**
- Create: `src/data/compare-meta.json`
- Create: `src/pages/ComparePage.tsx`, `src/pages/ComparePage.module.css`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create `src/data/compare-meta.json`**

```json
[
  {
    "slug": "lovable",
    "competitor": "Lovable",
    "title": "OpenThorn vs Lovable",
    "description": "Lovable charges $25+/month for credits; OpenThorn is free and you pay your AI provider directly. An honest comparison of pricing, model choice, and code ownership.",
    "lastVerified": "2026-06-11",
    "intro": "Lovable is one of the most popular AI app builders — and a genuinely good product. The fundamental difference is the business model: Lovable resells AI usage as monthly credits, while OpenThorn is BYOK — you bring an API key from any of 17 providers and pay that provider's raw per-token rates. No subscription, no markup.",
    "rows": [
      { "feature": "Platform price", "openthorn": "Free — no subscription, no platform fee", "competitor": "Pro from $25/month (100 credits); Business from $50/month" },
      { "feature": "AI usage billing", "openthorn": "You pay your provider directly at raw per-token rates", "competitor": "Credits per edit (~0.5–1.2+ credits each), bought from Lovable" },
      { "feature": "Bring your own API key", "openthorn": "Yes — built around it (17 providers)", "competitor": "No" },
      { "feature": "Model choice", "openthorn": "Any model from OpenAI, Anthropic, Gemini, DeepSeek, Groq, and 12 more", "competitor": "Models selected by Lovable" },
      { "feature": "Code export", "openthorn": "Full source export, no paywall; deploy anywhere", "competitor": "GitHub sync available" },
      { "feature": "Free tier", "openthorn": "Whole platform is free; you only pay provider API usage", "competitor": "~5 credits/day (~30/month)" }
    ],
    "faqs": [
      { "question": "Is OpenThorn a free alternative to Lovable?", "answer": "Yes. The OpenThorn platform is completely free — you connect your own AI provider API key and pay only that provider's per-token rates, typically cents to a few dollars per website. Lovable requires a subscription from $25/month for meaningful usage." },
      { "question": "Can I use my own OpenAI or Anthropic API key with Lovable?", "answer": "No. As of June 2026 Lovable does not support bring-your-own-key; AI usage is billed in Lovable credits. OpenThorn is built entirely around BYOK with 17 supported providers." },
      { "question": "Which is cheaper, OpenThorn or Lovable?", "answer": "For most usage, OpenThorn — you pay raw provider token prices with no markup or subscription. A typical website costs cents to a few dollars in API usage versus a $25+/month Lovable subscription. Lovable can be simpler if you prefer one predictable monthly bill." }
    ],
    "verdict": "Choose Lovable if you want a polished all-in-one subscription and don't want to think about API keys. Choose OpenThorn if you want to pick your own models, pay raw token prices with no subscription, and keep full ownership of the exported code."
  },
  {
    "slug": "bolt",
    "competitor": "Bolt.new",
    "title": "OpenThorn vs Bolt.new",
    "description": "Bolt.new sells AI tokens in monthly packs from $25/month; OpenThorn is free and BYOK — you pay your AI provider directly. Pricing, model choice, and ownership compared.",
    "lastVerified": "2026-06-11",
    "intro": "Bolt.new (by StackBlitz) is a strong in-browser AI builder. Like Lovable it resells AI usage — you buy token packs from Bolt. OpenThorn takes the BYOK route: connect your own provider key and pay raw per-token rates with no subscription. Bolt's own team also maintains bolt.diy, an open-source BYOK variant — which says something about the demand for this model.",
    "rows": [
      { "feature": "Platform price", "openthorn": "Free — no subscription, no platform fee", "competitor": "Pro $25/month; Teams $30/member/month" },
      { "feature": "AI usage billing", "openthorn": "You pay your provider directly at raw per-token rates", "competitor": "Token packs from Bolt (~10–13M tokens/month on Pro)" },
      { "feature": "Bring your own API key", "openthorn": "Yes — 17 providers", "competitor": "No (the separate open-source bolt.diy supports it, self-hosted)" },
      { "feature": "Model choice", "openthorn": "Any model from OpenAI, Anthropic, Gemini, DeepSeek, Groq, and 12 more", "competitor": "Models selected by Bolt" },
      { "feature": "Free tier", "openthorn": "Whole platform is free; you only pay provider API usage", "competitor": "1M tokens/month with a 300K daily cap" },
      { "feature": "Code export", "openthorn": "Full source export, no paywall; deploy anywhere", "competitor": "Download/GitHub available" }
    ],
    "faqs": [
      { "question": "Is OpenThorn a free alternative to Bolt.new?", "answer": "Yes. OpenThorn charges nothing — you connect your own provider API key and pay raw token rates. Bolt.new's free tier is capped at 1M tokens/month (300K/day); meaningful usage needs the $25/month Pro plan." },
      { "question": "Can I use my own API key with Bolt.new?", "answer": "Not with the hosted Bolt.new — it bills in its own token packs. The open-source bolt.diy project supports BYOK but you must run it yourself. OpenThorn is hosted, free, and BYOK out of the box." },
      { "question": "What is the difference between buying Bolt tokens and BYOK?", "answer": "Bolt sells you a monthly allotment of tokens it buys from providers. With BYOK you skip the middleman: your key, your provider's prices, your spend limits, and unused budget simply stays unspent — there is no monthly pack to use up." }
    ],
    "verdict": "Choose Bolt.new for its polished StackBlitz-powered dev environment and a single monthly bill. Choose OpenThorn to pay raw provider prices with no subscription — or bolt.diy if you want open source and are happy self-hosting."
  },
  {
    "slug": "v0",
    "competitor": "v0 by Vercel",
    "title": "OpenThorn vs v0 (Vercel)",
    "description": "v0 meters AI usage in credits on plans from $20/month; OpenThorn is free and BYOK. How the two compare on pricing, model choice, scope, and code ownership.",
    "lastVerified": "2026-06-11",
    "intro": "v0 by Vercel is excellent at generating React/Next.js UI and ships tight Vercel integration. It bills AI usage in credits metered over tokens, on plans from $20/month. OpenThorn is a free BYOK website builder: bring a key from any of 17 providers, pay raw token rates, and deploy or export wherever you like.",
    "rows": [
      { "feature": "Platform price", "openthorn": "Free — no subscription, no platform fee", "competitor": "Free tier ($5/month credits); Premium $20/month; Team $30/user/month" },
      { "feature": "AI usage billing", "openthorn": "You pay your provider directly at raw per-token rates", "competitor": "Credits metered over input/output tokens, bought from Vercel" },
      { "feature": "Bring your own API key", "openthorn": "Yes — 17 providers", "competitor": "No" },
      { "feature": "Model choice", "openthorn": "Any model from OpenAI, Anthropic, Gemini, DeepSeek, Groq, and 12 more", "competitor": "v0's own model tiers (Mini, Pro, Max)" },
      { "feature": "Ecosystem", "openthorn": "Provider-agnostic; deploy to Netlify or export and host anywhere", "competitor": "Optimized for Next.js and Vercel deployment" },
      { "feature": "Code export", "openthorn": "Full source export, no paywall", "competitor": "Code visible/exportable; Git integration" }
    ],
    "faqs": [
      { "question": "Is OpenThorn a free alternative to v0?", "answer": "Yes. OpenThorn's platform is free and you pay your AI provider directly per token. v0's free tier includes about $5/month in credits; sustained use needs Premium at $20/month." },
      { "question": "Can I use my own OpenAI or Anthropic key with v0?", "answer": "No — v0 bills usage in its own credits as of June 2026. OpenThorn is built around bring-your-own-key with 17 supported providers." },
      { "question": "Should I use v0 or OpenThorn?", "answer": "If you live in the Vercel/Next.js ecosystem and want best-in-class UI generation with a subscription, v0 is a great fit. If you want a free, provider-agnostic builder where you control the model and pay raw token prices, use OpenThorn." }
    ],
    "verdict": "v0 is the strongest choice for Next.js teams already on Vercel. OpenThorn is the choice for BYOK: free platform, 17 providers, raw token pricing, and no ecosystem lock-in."
  }
]
```

- [ ] **Step 2: Create `src/pages/ComparePage.module.css`**

```css
.page {
  min-height: 100vh;
  padding: 120px 0 80px;
  animation: pageRise 0.5s ease both;
}

.container {
  max-width: 880px;
  margin: 0 auto;
  padding: 0 24px;
}

.eyebrow {
  font-size: 0.85rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-accent);
  margin-bottom: 12px;
}

.title {
  font-family: 'Fraunces Variable', serif;
  font-size: clamp(2rem, 5vw, 3rem);
  margin-bottom: 16px;
}

.lastVerified {
  font-size: 0.85rem;
  opacity: 0.6;
  margin-bottom: 24px;
}

.intro {
  font-size: 1.05rem;
  line-height: 1.7;
  opacity: 0.85;
  margin-bottom: 40px;
}

.tableWrap {
  overflow-x: auto;
  margin-bottom: 48px;
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.95rem;
}

.table th,
.table td {
  text-align: left;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  vertical-align: top;
  line-height: 1.5;
}

.table th {
  color: var(--color-accent);
  font-weight: 600;
}

.sectionTitle {
  font-family: 'Fraunces Variable', serif;
  font-size: 1.5rem;
  margin: 40px 0 16px;
}

.faqItem {
  margin-bottom: 24px;
}

.faqItem h3 {
  font-size: 1.05rem;
  margin-bottom: 8px;
}

.faqItem p {
  line-height: 1.7;
  opacity: 0.85;
}

.verdict {
  line-height: 1.7;
  padding: 20px 24px;
  border-left: 3px solid var(--color-accent);
  background: rgba(255, 255, 255, 0.03);
  margin-bottom: 40px;
}

.links {
  line-height: 1.8;
}
```

(Before committing, check `src/index.css` for the shared `pageRise` keyframe name and the exact Fraunces `font-family` value used by other pages — match them.)

- [ ] **Step 3: Create `src/pages/ComparePage.tsx`**

```tsx
import { Link, Navigate, useParams } from 'react-router-dom'
import { usePageTitle } from '../lib/usePageTitle'
import { useJsonLd } from '../lib/useJsonLd'
import compareMeta from '../data/compare-meta.json'
import styles from './ComparePage.module.css'

interface CompareEntry {
  slug: string
  competitor: string
  title: string
  description: string
  lastVerified: string
  intro: string
  rows: { feature: string; openthorn: string; competitor: string }[]
  faqs: { question: string; answer: string }[]
  verdict: string
}

const entries = compareMeta as CompareEntry[]

export default function ComparePage() {
  const { slug } = useParams<{ slug: string }>()
  const entry = entries.find((e) => e.slug === slug)

  usePageTitle(entry?.title, entry ? { description: entry.description } : undefined)

  useJsonLd(
    entry
      ? {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: entry.faqs.map((f) => ({
            '@type': 'Question',
            name: f.question,
            acceptedAnswer: { '@type': 'Answer', text: f.answer },
          })),
        }
      : {}
  )

  if (!entry) return <Navigate to="/" replace />

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <p className={styles.eyebrow}>Comparison</p>
        <h1 className={styles.title}>{entry.title}</h1>
        <p className={styles.lastVerified}>
          Facts last verified: <time dateTime={entry.lastVerified}>{entry.lastVerified}</time>.
          Competitor pricing changes — check their site for current numbers.
        </p>
        <p className={styles.intro}>{entry.intro}</p>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Feature</th>
                <th scope="col">OpenThorn</th>
                <th scope="col">{entry.competitor}</th>
              </tr>
            </thead>
            <tbody>
              {entry.rows.map((row) => (
                <tr key={row.feature}>
                  <th scope="row">{row.feature}</th>
                  <td>{row.openthorn}</td>
                  <td>{row.competitor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className={styles.sectionTitle}>Common questions</h2>
        {entry.faqs.map((f) => (
          <div key={f.question} className={styles.faqItem}>
            <h3>{f.question}</h3>
            <p>{f.answer}</p>
          </div>
        ))}

        <h2 className={styles.sectionTitle}>Verdict</h2>
        <p className={styles.verdict}>{entry.verdict}</p>

        <p className={styles.links}>
          New to BYOK? Read{' '}
          <Link to="/blog/what-is-a-byok-ai-website-builder">what a BYOK AI website builder is</Link>,
          compare <Link to="/pricing">model pricing</Link>, or see the other comparisons:{' '}
          {entries
            .filter((e) => e.slug !== entry.slug)
            .map((e, i) => (
              <span key={e.slug}>
                {i > 0 && ' · '}
                <Link to={`/compare/${e.slug}`}>{e.title}</Link>
              </span>
            ))}
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Register the route**

In `src/App.tsx` add the lazy import with the others:

```ts
const ComparePage = lazy(() => import('./pages/ComparePage'))
```

and the route after the `/changelog` route:

```tsx
<Route path="/compare/:slug" element={<Layout><ComparePage /></Layout>} />
```

- [ ] **Step 5: Verify in dev**

Run `npx tsc -b` (expect exit 0), then `npm run dev` and open `http://localhost:5173/compare/lovable` — table, FAQs, and verdict render. Stop the server.

- [ ] **Step 6: Commit**

```bash
git add src/data/compare-meta.json src/pages/ComparePage.tsx src/pages/ComparePage.module.css src/App.tsx
git commit -m "feat(aeo): add /compare pages for Lovable, Bolt.new, and v0"
```

### Task 9: Glossary page (`/glossary`)

**Files:**
- Create: `src/data/glossary.json`
- Create: `src/pages/GlossaryPage.tsx`, `src/pages/GlossaryPage.module.css`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create `src/data/glossary.json`**

```json
[
  { "id": "byok", "term": "BYOK (bring your own key)", "definition": "A model where a tool runs on an API key you obtain directly from an AI provider, instead of reselling AI usage. You pay the provider's raw per-token rates; the tool adds no markup and needs no subscription. OpenThorn is a BYOK website builder." },
  { "id": "ai-website-builder", "term": "AI website builder", "definition": "A tool that turns a plain-language description into a working website. Modern builders use an AI agent that plans the site, writes real code, previews it, and deploys it — rather than filling templates." },
  { "id": "ai-agent", "term": "AI agent", "definition": "An AI system that works toward a goal in steps: it plans, calls tools (like writing files or running a compiler), checks the results, and keeps iterating until the task is done. OpenThorn's agent builds websites this way." },
  { "id": "llm", "term": "LLM (large language model)", "definition": "The AI model that powers text and code generation — for example GPT (OpenAI), Claude (Anthropic), or Gemini (Google). Accessed programmatically through an API, billed per token." },
  { "id": "api-key", "term": "API key", "definition": "A secret credential from an AI provider that lets software call its models on your account. You create one in the provider's console, set spend limits there, and can revoke it at any time." },
  { "id": "token", "term": "Token", "definition": "The unit AI providers bill by — roughly three-quarters of a word of text or code. Providers price input and output tokens separately, usually per million tokens. Generating a typical website costs cents to a few dollars in tokens." },
  { "id": "context-window", "term": "Context window", "definition": "The maximum amount of text (in tokens) a model can consider at once — the conversation, instructions, and code it can 'see'. Larger windows let an agent work on bigger projects without losing track." },
  { "id": "system-prompt", "term": "System prompt", "definition": "Standing instructions given to a model before any user input — defining its role, rules, and tools. An AI website builder's system prompt is a large part of what makes its agent reliable." }
]
```

- [ ] **Step 2: Create `src/pages/GlossaryPage.module.css`**

```css
.page {
  min-height: 100vh;
  padding: 120px 0 80px;
  animation: pageRise 0.5s ease both;
}

.container {
  max-width: 760px;
  margin: 0 auto;
  padding: 0 24px;
}

.eyebrow {
  font-size: 0.85rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-accent);
  margin-bottom: 12px;
}

.title {
  font-family: 'Fraunces Variable', serif;
  font-size: clamp(2rem, 5vw, 3rem);
  margin-bottom: 16px;
}

.subtitle {
  line-height: 1.7;
  opacity: 0.85;
  margin-bottom: 48px;
}

.entry {
  margin-bottom: 36px;
  scroll-margin-top: 100px;
}

.entry h2 {
  font-family: 'Fraunces Variable', serif;
  font-size: 1.35rem;
  margin-bottom: 8px;
}

.entry p {
  line-height: 1.7;
  opacity: 0.85;
}

.links {
  margin-top: 48px;
  line-height: 1.8;
}
```

(Same check as Task 8 Step 2: match the real keyframe and font-family names from `src/index.css`.)

- [ ] **Step 3: Create `src/pages/GlossaryPage.tsx`**

```tsx
import { Link } from 'react-router-dom'
import { usePageTitle } from '../lib/usePageTitle'
import { useJsonLd } from '../lib/useJsonLd'
import glossary from '../data/glossary.json'
import styles from './GlossaryPage.module.css'

const SITE_URL = 'https://www.openthorn.app'

export default function GlossaryPage() {
  usePageTitle('AI Website Builder Glossary', {
    description:
      'Plain-English definitions of the terms behind AI website building: BYOK, AI agents, tokens, context windows, API keys, and more.',
  })

  useJsonLd({
    '@context': 'https://schema.org',
    '@type': 'DefinedTermSet',
    name: 'AI Website Builder Glossary',
    url: `${SITE_URL}/glossary`,
    hasDefinedTerm: glossary.map((g) => ({
      '@type': 'DefinedTerm',
      name: g.term,
      description: g.definition,
      url: `${SITE_URL}/glossary#${g.id}`,
    })),
  })

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <p className={styles.eyebrow}>Glossary</p>
        <h1 className={styles.title}>AI website building, defined</h1>
        <p className={styles.subtitle}>
          Short, plain-English definitions of the terms you will meet when building websites with
          AI — no jargon required to get started.
        </p>

        {glossary.map((g) => (
          <section key={g.id} id={g.id} className={styles.entry}>
            <h2>{g.term}</h2>
            <p>{g.definition}</p>
          </section>
        ))}

        <p className={styles.links}>
          Go deeper: <Link to="/blog/what-is-a-byok-ai-website-builder">what is a BYOK AI website builder?</Link>{' '}
          · <Link to="/blog/how-to-get-an-ai-api-key">how to get an API key</Link> ·{' '}
          <Link to="/faq">FAQ</Link>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Register the route**

In `src/App.tsx`:

```ts
const GlossaryPage = lazy(() => import('./pages/GlossaryPage'))
```

```tsx
<Route path="/glossary" element={<Layout><GlossaryPage /></Layout>} />
```

- [ ] **Step 5: Verify in dev**

`npx tsc -b` (exit 0); `npm run dev`; open `http://localhost:5173/glossary` and `http://localhost:5173/glossary#token` (scrolls to the entry). Stop the server.

- [ ] **Step 6: Commit**

```bash
git add src/data/glossary.json src/pages/GlossaryPage.tsx src/pages/GlossaryPage.module.css src/App.tsx
git commit -m "feat(aeo): add /glossary page with DefinedTermSet JSON-LD"
```

### Task 10: Prerender + sitemap + links for the new routes

**Files:**
- Modify: `scripts/prerender.mjs`
- Modify: `src/components/Footer/Footer.tsx`
- Modify: `public/llms.txt`
- Modify: `scripts/verify-prerender.mjs`

- [ ] **Step 1: Add compare + glossary routes to `scripts/prerender.mjs`**

After the `const changelog = ...` line, load the new data:

```js
const compareMeta = JSON.parse(readFileSync(join(rootDir, 'src', 'data', 'compare-meta.json'), 'utf8'))
const glossary = JSON.parse(readFileSync(join(rootDir, 'src', 'data', 'glossary.json'), 'utf8'))
```

In the `routes` array, after the `/faq` entry, insert:

```js
  ...compareMeta.map((entry) => ({
    path: `/compare/${entry.slug}`,
    title: `${entry.title} — OpenThorn`,
    description: entry.description,
    ogType: 'website',
    lastmod: entry.lastVerified,
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: entry.faqs.map((f) => ({
          '@type': 'Question',
          name: f.question,
          acceptedAnswer: { '@type': 'Answer', text: f.answer },
        })),
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
          { '@type': 'ListItem', position: 2, name: entry.title },
        ],
      },
    ],
  })),
  {
    path: '/glossary',
    title: 'AI Website Builder Glossary — OpenThorn',
    description:
      'Plain-English definitions of the terms behind AI website building: BYOK, AI agents, tokens, context windows, API keys, and more.',
    ogType: 'website',
    lastmod: '2026-06-12',
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'DefinedTermSet',
        name: 'AI Website Builder Glossary',
        url: `${SITE_URL}/glossary`,
        hasDefinedTerm: glossary.map((g) => ({
          '@type': 'DefinedTerm',
          name: g.term,
          description: g.definition,
          url: `${SITE_URL}/glossary#${g.id}`,
        })),
      },
    ],
  },
```

- [ ] **Step 2: BreadcrumbList on legal pages**

Still in `prerender.mjs`, for each legal route (`/terms`, `/privacy`, `/cookies`, `/imprint`, `/moderation`) change `jsonLd: []` to:

```js
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
          { '@type': 'ListItem', position: 2, name: '<PAGE TITLE WITHOUT SUFFIX>' },
        ],
      },
    ],
```

using the page name for each (`Terms of Service`, `Privacy Policy`, `Cookie Policy`, `Imprint`, `Moderation and DSA`).

- [ ] **Step 3: Footer links**

In `src/components/Footer/Footer.tsx`, replace the `resourcesRouteLinks` array:

```ts
const resourcesRouteLinks = [
  { label: 'Docs & FAQs', to: '/faq' },
  { label: 'Glossary', to: '/glossary' },
  { label: 'vs Lovable', to: '/compare/lovable' },
  { label: 'vs Bolt.new', to: '/compare/bolt' },
  { label: 'vs v0', to: '/compare/v0' },
]
```

- [ ] **Step 4: Update `public/llms.txt`**

In the `## Pages` section, add after the FAQ line:

```markdown
- [Glossary](https://www.openthorn.app/glossary): Plain-English definitions of BYOK, AI agent, token, context window, and other key terms
- [OpenThorn vs Lovable](https://www.openthorn.app/compare/lovable): Honest comparison — BYOK vs credit subscription
- [OpenThorn vs Bolt.new](https://www.openthorn.app/compare/bolt): Honest comparison — BYOK vs token packs
- [OpenThorn vs v0](https://www.openthorn.app/compare/v0): Honest comparison — BYOK vs metered credits
- [Best BYOK AI website builders in 2026](https://www.openthorn.app/blog/best-byok-ai-website-builders-2026): The BYOK field compared
- [How to build a website with AI (BYOK)](https://www.openthorn.app/blog/how-to-build-a-website-with-ai-byok): Six-step guide
- [How to get an AI API key](https://www.openthorn.app/blog/how-to-get-an-ai-api-key): OpenAI, Anthropic, and Gemini key setup
```

- [ ] **Step 5: Verifier additions**

Add to the `checks` array in `scripts/verify-prerender.mjs`:

```js
  ['dist/compare/lovable/index.html', 'FAQPage', 'compare/lovable: FAQPage JSON-LD'],
  ['dist/compare/lovable/index.html', 'Is OpenThorn a free alternative to Lovable?', 'compare/lovable: SSR body'],
  ['dist/compare/bolt/index.html', 'token packs', 'compare/bolt: SSR body'],
  ['dist/compare/v0/index.html', 'OpenThorn vs v0', 'compare/v0: SSR body'],
  ['dist/glossary/index.html', 'DefinedTermSet', 'glossary: DefinedTermSet JSON-LD'],
  ['dist/glossary/index.html', 'context window', 'glossary: SSR body'],
  ['dist/sitemap.xml', '/compare/lovable', 'sitemap: compare pages'],
  ['dist/sitemap.xml', '/glossary', 'sitemap: glossary'],
  ['dist/terms/index.html', 'BreadcrumbList', 'terms: BreadcrumbList JSON-LD'],
```

- [ ] **Step 6: Build + verify + test**

```bash
npm run build && node scripts/verify-prerender.mjs && npx vitest run
```

Expected: all `OK`, exit 0, tests pass.

- [ ] **Step 7: Commit**

```bash
git add scripts/prerender.mjs scripts/verify-prerender.mjs src/components/Footer/Footer.tsx public/llms.txt
git commit -m "feat(aeo): prerender, sitemap, footer, and llms.txt wiring for compare + glossary pages"
```

---

# Phase C — llms-full.txt

### Task 11: Generate `dist/llms-full.txt`

**Files:**
- Create: `scripts/llms-full.mjs`
- Modify: `scripts/prerender.mjs`
- Modify: `public/llms.txt`
- Modify: `scripts/verify-prerender.mjs`

- [ ] **Step 1: Create `scripts/llms-full.mjs`**

```js
// Builds llms-full.txt: the complete public content of openthorn.app in one
// markdown file, for AI assistants and answer engines that prefer a single
// fetch over crawling. Linked from llms.txt per the llms.txt convention.
import { readFileSync } from 'fs'
import { join } from 'path'

export function buildLlmsFull({ rootDir, blogMeta, faqData, compareMeta, glossary }) {
  const sections = []

  sections.push(readFileSync(join(rootDir, 'public', 'llms.txt'), 'utf8').trim())

  sections.push('\n\n---\n\n# Frequently Asked Questions\n')
  for (const category of faqData) {
    sections.push(`\n## ${category.label}\n`)
    for (const item of category.items) {
      sections.push(`\n### ${item.question}\n\n${item.answer}\n`)
    }
  }

  sections.push('\n\n---\n\n# Glossary\n')
  for (const g of glossary) {
    sections.push(`\n### ${g.term}\n\n${g.definition}\n`)
  }

  sections.push('\n\n---\n\n# Comparisons\n')
  for (const entry of compareMeta) {
    sections.push(`\n## ${entry.title} (facts last verified ${entry.lastVerified})\n\n${entry.intro}\n`)
    for (const row of entry.rows) {
      sections.push(`- ${row.feature}: OpenThorn — ${row.openthorn}; ${entry.competitor} — ${row.competitor}`)
    }
    for (const f of entry.faqs) {
      sections.push(`\n### ${f.question}\n\n${f.answer}\n`)
    }
    sections.push(`\nVerdict: ${entry.verdict}\n`)
  }

  sections.push('\n\n---\n\n# Blog posts\n')
  for (const post of blogMeta) {
    const md = readFileSync(join(rootDir, 'src', 'content', 'blog', `${post.slug}.md`), 'utf8')
    sections.push(`\n## ${post.title} (${post.date})\n\n${md.trim()}\n`)
  }

  return sections.join('\n')
}
```

- [ ] **Step 2: Call it from `scripts/prerender.mjs`**

Add the import at the top:

```js
import { buildLlmsFull } from './llms-full.mjs'
```

After the sitemap is written, add:

```js
writeFileSync(
  join(distDir, 'llms-full.txt'),
  buildLlmsFull({ rootDir, blogMeta, faqData, compareMeta, glossary }),
  'utf8'
)
console.log('✓ llms-full.txt')
```

- [ ] **Step 3: Link it from `public/llms.txt`**

Add at the end of the key-facts list (before `## Pages`):

```markdown
- Full machine-readable site content: https://www.openthorn.app/llms-full.txt
```

- [ ] **Step 4: Verifier checks**

Add to `scripts/verify-prerender.mjs`:

```js
  ['dist/llms-full.txt', 'Frequently Asked Questions', 'llms-full: FAQ section'],
  ['dist/llms-full.txt', 'Best BYOK AI Website Builders', 'llms-full: blog content'],
  ['dist/llms-full.txt', 'OpenThorn vs Lovable', 'llms-full: comparisons'],
  ['dist/llms.txt', 'llms-full.txt', 'llms.txt links llms-full'],
```

- [ ] **Step 5: Build + verify**

```bash
npm run build && node scripts/verify-prerender.mjs
```

Expected: all `OK`.

- [ ] **Step 6: Commit**

```bash
git add scripts/llms-full.mjs scripts/prerender.mjs public/llms.txt scripts/verify-prerender.mjs
git commit -m "feat(aeo): generate llms-full.txt with complete public site content"
```

---

# Phase D — OG cards + IndexNow

### Task 12: Build-time OG card generation

**Files:**
- Create: `scripts/og-cards.mjs`
- Modify: `scripts/prerender.mjs`, `package.json` (devDeps), `scripts/verify-prerender.mjs`

- [ ] **Step 1: Install devDependencies**

```bash
npm install -D satori @resvg/resvg-js @fontsource/fraunces
```

(`@fontsource/fraunces` is the static-weight package — satori cannot use the variable `@fontsource-variable/fraunces` woff2; satori needs ttf/otf/woff.)

- [ ] **Step 2: Create `scripts/og-cards.mjs`**

```js
// Renders 1200x630 Open Graph cards at build time with satori (JSX-object →
// SVG) and resvg (SVG → PNG). Colors mirror the design tokens in src/index.css
// (--color-bg #09070B, --color-text #F4EFF8, --color-accent #A78BFA).
import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'
import { readFileSync } from 'fs'
import { join } from 'path'

export function loadFonts(rootDir) {
  return [
    {
      name: 'Fraunces',
      data: readFileSync(join(rootDir, 'node_modules', '@fontsource', 'fraunces', 'files', 'fraunces-latin-600-normal.woff')),
      weight: 600,
      style: 'normal',
    },
    {
      name: 'Roboto',
      data: readFileSync(join(rootDir, 'node_modules', '@fontsource', 'roboto', 'files', 'roboto-latin-400-normal.woff')),
      weight: 400,
      style: 'normal',
    },
  ]
}

export async function renderOgCard({ title, eyebrow }, fonts) {
  const svg = await satori(
    {
      type: 'div',
      props: {
        style: {
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 72,
          backgroundColor: '#09070B',
          backgroundImage: 'radial-gradient(circle at 85% 15%, rgba(167,139,250,0.25), transparent 55%)',
          color: '#F4EFF8',
          fontFamily: 'Roboto',
        },
        children: [
          {
            type: 'div',
            props: {
              style: { fontSize: 30, letterSpacing: 4, textTransform: 'uppercase', color: '#A78BFA', display: 'flex' },
              children: eyebrow,
            },
          },
          {
            type: 'div',
            props: {
              style: {
                fontSize: title.length > 55 ? 56 : 72,
                fontFamily: 'Fraunces',
                fontWeight: 600,
                lineHeight: 1.15,
                display: 'flex',
                maxWidth: 1000,
              },
              children: title,
            },
          },
          {
            type: 'div',
            props: {
              style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 32 },
              children: [
                { type: 'div', props: { style: { fontFamily: 'Fraunces', fontWeight: 600, display: 'flex' }, children: 'OpenThorn' } },
                { type: 'div', props: { style: { color: '#A78BFA', display: 'flex' }, children: 'openthorn.app' } },
              ],
            },
          },
        ],
      },
    },
    { width: 1200, height: 630, fonts }
  )

  return new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng()
}
```

- [ ] **Step 3: Wire into `scripts/prerender.mjs`**

Imports:

```js
import { loadFonts, renderOgCard } from './og-cards.mjs'
```

Before the main route loop:

```js
const ogFonts = loadFonts(rootDir)
mkdirSync(join(distDir, 'og'), { recursive: true })

function ogSlug(path) {
  return path === '/' ? 'home' : path.slice(1).replace(/\//g, '-')
}

function ogEyebrow(path) {
  if (path.startsWith('/blog/')) return 'Blog'
  if (path.startsWith('/compare/')) return 'Comparison'
  if (path === '/glossary') return 'Glossary'
  if (path === '/faq') return 'FAQ'
  return 'BYOK AI Website Builder'
}
```

Inside the route loop, before `injectMeta` is called, generate the card and point the route at it (explicit `ogImage` values from blog-meta keep priority):

```js
for (const route of routes) {
  if (!route.ogImage) {
    const slug = ogSlug(route.path)
    const cardTitle = route.title.replace(/ — OpenThorn$/, '')
    const png = await renderOgCard({ title: cardTitle, eyebrow: ogEyebrow(route.path) }, ogFonts)
    writeFileSync(join(distDir, 'og', `${slug}.png`), png)
    route.ogImage = `${SITE_URL}/og/${slug}.png`
  }
  const appHtml = await render(route.path)
  ...
}
```

- [ ] **Step 4: Verifier checks**

Add to `scripts/verify-prerender.mjs`:

```js
  ['dist/og/home.png', null, 'og: home card generated'],
  ['dist/og/compare-lovable.png', null, 'og: compare card generated'],
  ['dist/og/blog-best-byok-ai-website-builders-2026.png', null, 'og: listicle card generated'],
```

and update the existing home og check `['dist/index.html', 'og-card.png', 'home: og-card image']` to:

```js
  ['dist/index.html', '/og/home.png', 'home: generated og card'],
```

- [ ] **Step 5: Build, verify, eyeball**

```bash
npm run build && node scripts/verify-prerender.mjs
```

All `OK`. Then open `dist/og/home.png` in an image viewer (or Read it) — title legible, no overflow, colors match the site.

Note: the runtime `usePageTitle` og:image default is intentionally left unchanged (`og-card.png`) — social/AI crawlers read the static prerendered HTML, never the SPA's runtime meta updates, so per-card runtime wiring would add complexity with no crawler-visible effect. This deviates from one sentence in the spec, deliberately.

- [ ] **Step 6: Commit**

```bash
git add scripts/og-cards.mjs scripts/prerender.mjs scripts/verify-prerender.mjs package.json package-lock.json
git commit -m "feat(seo): generate per-page OG cards at build time with satori"
```

### Task 13: IndexNow

**Files:**
- Create: `public/7f3a9c2e5b8d4f6a1c0e9b7d3a5f8c2e.txt`
- Create: `scripts/indexnow.mjs`
- Modify: `package.json` (script)

- [ ] **Step 1: Create the key file**

`public/7f3a9c2e5b8d4f6a1c0e9b7d3a5f8c2e.txt` containing exactly:

```
7f3a9c2e5b8d4f6a1c0e9b7d3a5f8c2e
```

- [ ] **Step 2: Create `scripts/indexnow.mjs`**

```js
// Submits all public URLs (from the live sitemap) to IndexNow so Bing and the
// answer engines that consume IndexNow re-crawl promptly after a deploy.
// Run manually after deploying: npm run indexnow
const SITE_URL = 'https://www.openthorn.app'
const KEY = '7f3a9c2e5b8d4f6a1c0e9b7d3a5f8c2e'

const sitemap = await (await fetch(`${SITE_URL}/sitemap.xml`)).text()
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])

if (urls.length === 0) {
  console.error('No URLs found in sitemap — aborting')
  process.exit(1)
}

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({
    host: 'www.openthorn.app',
    key: KEY,
    keyLocation: `${SITE_URL}/${KEY}.txt`,
    urlList: urls,
  }),
})

console.log(`Submitted ${urls.length} URLs to IndexNow — HTTP ${res.status}`)
process.exit(res.ok ? 0 : 1)
```

- [ ] **Step 3: Add the npm script**

In `package.json` scripts:

```json
"indexnow": "node scripts/indexnow.mjs"
```

- [ ] **Step 4: Syntax check**

Run: `node --check scripts/indexnow.mjs`
Expected: exit 0. (A live submit only makes sense after the deploy in Task 14.)

- [ ] **Step 5: Commit**

```bash
git add public/7f3a9c2e5b8d4f6a1c0e9b7d3a5f8c2e.txt scripts/indexnow.mjs package.json
git commit -m "feat(seo): add IndexNow key and submission script"
```

### Task 14: Deploy and validate

- [ ] **Step 1: Final full check**

```bash
npm run build && node scripts/verify-prerender.mjs && npx vitest run && npm run lint
```

Expected: everything green.

- [ ] **Step 2: Push**

```bash
git push
```

Wait for the Vercel deployment to finish.

- [ ] **Step 3: Validate the live SSR bodies**

```bash
curl -s https://www.openthorn.app/compare/lovable | grep -c "Is OpenThorn a free alternative to Lovable?"
curl -s https://www.openthorn.app/faq | grep -c "aria-expanded"
curl -s https://www.openthorn.app/llms-full.txt | head -5
curl -s -o /dev/null -w "%{http_code}" https://www.openthorn.app/og/home.png
```

Expected: counts ≥ 1, llms-full content prints, `200`.

- [ ] **Step 4: Submit to IndexNow**

```bash
npm run indexnow
```

Expected: `Submitted N URLs to IndexNow — HTTP 200` (202 also OK).

- [ ] **Step 5: Manual validation (report links to Thomas)**

- Google Rich Results Test (`https://search.google.com/test/rich-results`) on `/`, `/blog/how-to-build-a-website-with-ai-byok` (HowTo), `/compare/lovable` (FAQPage).
- OpenGraph debugger (`https://www.opengraph.xyz`) on `/blog/best-byok-ai-website-builders-2026` — generated card shows.
- Reminder for Thomas: resubmit `https://www.openthorn.app/sitemap.xml` in Google Search Console.
