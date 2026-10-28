# SEO: Pre-rendering, JSON-LD, and Per-page OG Image Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make public pages crawlable for social media bots (pre-rendered HTML with correct meta tags), add JSON-LD structured data for Google, and enable per-page OG images.

**Architecture:** A post-build Node.js script (`scripts/prerender.mjs`) reads `dist/index.html`, injects per-route title/description/OG tags/JSON-LD, and writes per-route HTML files (e.g. `dist/pricing/index.html`). No Puppeteer, no SSR framework — pure string manipulation on the Vite build output. Vercel serves static files before rewrite rules fire, so pre-rendered files are served to crawlers automatically. JSON-LD structured data is also injected at runtime via a new `useJsonLd` hook for Google's second-wave JS rendering.

**Tech Stack:** Node.js ESM (`.mjs`, no new dependencies), React hooks, `src/lib/usePageTitle.ts` extension

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Modify | `src/lib/usePageTitle.ts` | Add `image?` support for og:image + twitter:image |
| Create | `src/lib/useJsonLd.ts` | Hook that injects `<script type="application/ld+json">` |
| Modify | `src/App.tsx` | Add SoftwareApplication JSON-LD to HomePage |
| Modify | `src/data/blogPosts.ts` | Add `ogImage?` field to BlogPost interface |
| Modify | `src/pages/BlogPostPage.tsx` | Add BlogPosting JSON-LD + pass ogImage to usePageTitle |
| Create | `scripts/prerender.mjs` | Post-build HTML generator for all 10 public routes |
| Modify | `package.json` | Extend build script to run prerender after vite build |

---

## Task 1: Add image support to usePageTitle

**Files:**
- Modify: `src/lib/usePageTitle.ts`

- [ ] **Step 1: Open the file and read its current content**

File is at `src/lib/usePageTitle.ts`. Current interface is:
```ts
interface PageMeta {
  description?: string
}
```

- [ ] **Step 2: Apply the changes**

Replace the entire file content with:

```ts
import { useEffect } from 'react'

const SITE_NAME = 'OpenThorn'
const DEFAULT_TITLE = 'OpenThorn — The BYOK AI Website Builder'
const DEFAULT_DESCRIPTION =
  'OpenThorn is the BYOK AI website builder — describe what you want, get a complete, deployable website. No subscription, no lock-in.'
const SITE_URL = 'https://www.openthorn.app'
const DEFAULT_OG_IMAGE = 'https://www.openthorn.app/logo.png'

interface PageMeta {
  /** Meta description for this page. Falls back to the site default when omitted. */
  description?: string
  /** Absolute URL for og:image and twitter:image. Falls back to site logo when omitted. */
  image?: string
}

function setMetaContent(selector: string, value: string) {
  const el = document.head.querySelector<HTMLMetaElement>(selector)
  if (el) el.setAttribute('content', value)
}

function setCanonical(href: string) {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!link) {
    link = document.createElement('link')
    link.setAttribute('rel', 'canonical')
    document.head.appendChild(link)
  }
  link.setAttribute('href', href)
}

function applyMeta(title: string, description: string, url: string, image: string) {
  document.title = title
  setMetaContent('meta[name="description"]', description)
  setMetaContent('meta[property="og:title"]', title)
  setMetaContent('meta[property="og:description"]', description)
  setMetaContent('meta[property="og:url"]', url)
  setMetaContent('meta[property="og:image"]', image)
  setMetaContent('meta[name="twitter:title"]', title)
  setMetaContent('meta[name="twitter:description"]', description)
  setMetaContent('meta[name="twitter:image"]', image)
  setCanonical(url)
}

/**
 * Sets the document title and the full set of SEO/social meta tags
 * (description, Open Graph, Twitter card, canonical) for the current route.
 * This is a client-side SPA, so these update on navigation; on unmount the tags
 * are restored to the site defaults so a page that sets no meta never inherits
 * a previous route's values.
 */
export function usePageTitle(title?: string, meta?: PageMeta) {
  const description = meta?.description
  const image = meta?.image
  useEffect(() => {
    const fullTitle = title ? `${title} — ${SITE_NAME}` : DEFAULT_TITLE
    const desc = description || DEFAULT_DESCRIPTION
    const url = SITE_URL + window.location.pathname
    const img = image || DEFAULT_OG_IMAGE

    applyMeta(fullTitle, desc, url, img)

    return () => {
      applyMeta(DEFAULT_TITLE, DEFAULT_DESCRIPTION, SITE_URL + window.location.pathname, DEFAULT_OG_IMAGE)
    }
  }, [title, description, image])
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/usePageTitle.ts
git commit -m "feat(seo): add per-page og:image and twitter:image support to usePageTitle"
```

---

## Task 2: Create useJsonLd hook

**Files:**
- Create: `src/lib/useJsonLd.ts`

- [ ] **Step 1: Create the file**

```ts
import { useEffect } from 'react'

/**
 * Injects a JSON-LD structured data script tag into <head> for the current page.
 * Cleaned up on unmount so navigating away removes stale schema data.
 */
export function useJsonLd(schema: object) {
  const schemaString = JSON.stringify(schema)
  useEffect(() => {
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.textContent = schemaString
    document.head.appendChild(script)
    return () => script.remove()
  }, [schemaString])
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/useJsonLd.ts
git commit -m "feat(seo): add useJsonLd hook for structured data injection"
```

---

## Task 3: Add SoftwareApplication JSON-LD to HomePage

**Files:**
- Modify: `src/App.tsx:36-51`

- [ ] **Step 1: Add the import and hook call**

In `src/App.tsx`, add the import after the existing `usePageTitle` import:

```ts
import { useJsonLd } from './lib/useJsonLd'
```

Then update the `HomePage` function (currently lines 36–51) to call `useJsonLd`:

```tsx
function HomePage() {
  const { user, loading } = useAuth()
  usePageTitle()
  useJsonLd({
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'OpenThorn',
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Web',
    description:
      'OpenThorn is the BYOK AI website builder — describe what you want, get a complete, deployable website. No subscription, no lock-in.',
    url: 'https://www.openthorn.app',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      description: 'Free to use — bring your own API keys',
    },
  })

  if (loading) return null
  if (user) return <Navigate to="/dashboard" replace />

  return (
    <>
      <HeroSection />
      <MeetOpenThornSection />
      <BYOKSection />
      <BottomCTA />
    </>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat(seo): add SoftwareApplication JSON-LD schema to homepage"
```

---

## Task 4: Add ogImage field to BlogPost + BlogPosting JSON-LD to BlogPostPage

**Files:**
- Modify: `src/data/blogPosts.ts`
- Modify: `src/pages/BlogPostPage.tsx`

- [ ] **Step 1: Add ogImage to BlogPost interface and data**

Update `src/data/blogPosts.ts` to:

```ts
import introducingOpenThornContent from '../content/blog/introducing-openthorn.md?raw'

export interface BlogPost {
  slug: string
  title: string
  date: string
  excerpt: string
  coverVideo?: string
  /** Absolute URL for og:image. Falls back to site logo when omitted. */
  ogImage?: string
  content: string
}

export const blogPosts: BlogPost[] = [
  {
    slug: 'introducing-openthorn',
    title: 'Introducing OpenThorn — Build Full-Stack Apps from a Single Prompt',
    date: '2026-06-06',
    excerpt:
      'Most web apps still take weeks to build. We built OpenThorn to close that gap — describe your app in plain language and ship the same day.',
    coverVideo: '/videos/openthorn-ad.mp4',
    content: introducingOpenThornContent,
  },
]

export function getPostBySlug(slug: string): BlogPost | undefined {
  return blogPosts.find((p) => p.slug === slug)
}
```

(No `ogImage` set on the first post — it falls back to the site logo.)

- [ ] **Step 2: Add BlogPosting JSON-LD and ogImage to BlogPostPage**

Update `src/pages/BlogPostPage.tsx`. Add the `useJsonLd` import:

```ts
import { useJsonLd } from '../lib/useJsonLd'
```

Replace the existing `usePageTitle` call and add JSON-LD. The component body becomes:

```tsx
export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>()
  const post = slug ? getPostBySlug(slug) : undefined

  usePageTitle(post?.title, post ? { description: post.excerpt, image: post.ogImage } : undefined)

  useJsonLd(
    post
      ? {
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline: post.title,
          description: post.excerpt,
          datePublished: post.date,
          url: `https://www.openthorn.app/blog/${post.slug}`,
          author: { '@type': 'Organization', name: 'OpenThorn' },
          publisher: {
            '@type': 'Organization',
            name: 'OpenThorn',
            logo: {
              '@type': 'ImageObject',
              url: 'https://www.openthorn.app/logo.png',
            },
          },
          image: post.ogImage ?? 'https://www.openthorn.app/logo.png',
        }
      : {}
  )

  if (!post) return <Navigate to="/blog" replace />

  // rest of the JSX is unchanged from the current file
```

Keep the rest of the JSX (the `return` block with `div.page`, `div.container`, etc.) exactly as it is now.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/data/blogPosts.ts src/pages/BlogPostPage.tsx
git commit -m "feat(seo): add BlogPosting JSON-LD and ogImage support to blog post page"
```

---

## Task 5: Create the pre-render script

**Files:**
- Create: `scripts/prerender.mjs`

This script runs after `vite build`. It reads `dist/index.html`, injects per-route metadata (title, description, OG tags, JSON-LD) via string replacement, and writes `dist/{route}/index.html` for every public route.

- [ ] **Step 1: Create `scripts/prerender.mjs`**

```js
// scripts/prerender.mjs
// Post-build script: generates pre-rendered HTML for every public route.
// Run: node scripts/prerender.mjs
// Produces: dist/{route}/index.html with correct <head> metadata for each route.
// Social media crawlers (Twitter, LinkedIn, Slack) don't execute JS — they need
// these tags in the static HTML. Vercel serves static files before rewrite rules,
// so pre-rendered files are served automatically without any config changes.

import { readFileSync, mkdirSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distDir = join(__dirname, '..', 'dist')
const SITE_URL = 'https://www.openthorn.app'
const DEFAULT_OG_IMAGE = `${SITE_URL}/logo.png`

// Static metadata for every public route.
// Keep in sync with usePageTitle calls in each page component.
// title: the full <title> tag value (without the "— OpenThorn" suffix for blog posts
//        the suffix is already included below to match what usePageTitle produces).
const routes = [
  {
    path: '/',
    title: 'OpenThorn — The BYOK AI Website Builder',
    description:
      'OpenThorn is the BYOK AI website builder — describe what you want, get a complete, deployable website. No subscription, no lock-in.',
    ogImage: DEFAULT_OG_IMAGE,
    ogType: 'website',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'OpenThorn',
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Web',
      description:
        'OpenThorn is the BYOK AI website builder — describe what you want, get a complete, deployable website. No subscription, no lock-in.',
      url: SITE_URL,
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
        description: 'Free to use — bring your own API keys',
      },
    },
  },
  {
    path: '/pricing',
    title: 'Model Pricing — OpenThorn',
    description:
      'Compare per-token pricing across the AI providers OpenThorn supports. You pay your provider directly — OpenThorn charges no subscription.',
    ogImage: DEFAULT_OG_IMAGE,
    ogType: 'website',
    jsonLd: null,
  },
  {
    path: '/blog',
    title: 'Blog — OpenThorn',
    description:
      'Product updates, guides, and stories from the OpenThorn team on building and shipping websites with AI.',
    ogImage: DEFAULT_OG_IMAGE,
    ogType: 'website',
    jsonLd: null,
  },
  {
    path: '/blog/introducing-openthorn',
    title: 'Introducing OpenThorn — Build Full-Stack Apps from a Single Prompt — OpenThorn',
    description:
      'Most web apps still take weeks to build. We built OpenThorn to close that gap — describe your app in plain language and ship the same day.',
    ogImage: DEFAULT_OG_IMAGE,
    ogType: 'article',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: 'Introducing OpenThorn — Build Full-Stack Apps from a Single Prompt',
      description:
        'Most web apps still take weeks to build. We built OpenThorn to close that gap — describe your app in plain language and ship the same day.',
      datePublished: '2026-06-06',
      url: `${SITE_URL}/blog/introducing-openthorn`,
      author: { '@type': 'Organization', name: 'OpenThorn' },
      publisher: {
        '@type': 'Organization',
        name: 'OpenThorn',
        logo: { '@type': 'ImageObject', url: DEFAULT_OG_IMAGE },
      },
      image: DEFAULT_OG_IMAGE,
    },
  },
  {
    path: '/faq',
    title: 'FAQ — OpenThorn',
    description:
      'Answers to common questions about OpenThorn — how bring-your-own-key works, supported AI providers, costs, and deploying your generated site.',
    ogImage: DEFAULT_OG_IMAGE,
    ogType: 'website',
    jsonLd: null,
  },
  {
    path: '/terms',
    title: 'Terms of Service — OpenThorn',
    description: 'Terms of service for OpenThorn.',
    ogImage: DEFAULT_OG_IMAGE,
    ogType: 'website',
    jsonLd: null,
  },
  {
    path: '/privacy',
    title: 'Privacy Policy — OpenThorn',
    description: 'Privacy policy for OpenThorn.',
    ogImage: DEFAULT_OG_IMAGE,
    ogType: 'website',
    jsonLd: null,
  },
  {
    path: '/cookies',
    title: 'Cookie Policy — OpenThorn',
    description: 'Cookie policy for OpenThorn.',
    ogImage: DEFAULT_OG_IMAGE,
    ogType: 'website',
    jsonLd: null,
  },
  {
    path: '/imprint',
    title: 'Imprint — OpenThorn',
    description: 'Legal imprint for OpenThorn.',
    ogImage: DEFAULT_OG_IMAGE,
    ogType: 'website',
    jsonLd: null,
  },
  {
    path: '/moderation',
    title: 'Moderation and DSA — OpenThorn',
    description: 'Moderation policy and DSA compliance information for OpenThorn.',
    ogImage: DEFAULT_OG_IMAGE,
    ogType: 'website',
    jsonLd: null,
  },
]

function escapeAttr(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

function injectMeta(html, route) {
  let out = html

  // <title>
  out = out.replace(/<title>[^<]*<\/title>/, `<title>${escapeAttr(route.title)}</title>`)

  // meta description
  out = out.replace(
    /(<meta name="description" content=")[^"]*(")/,
    `$1${escapeAttr(route.description)}$2`
  )

  // OG tags
  out = out.replace(/(<meta property="og:title" content=")[^"]*(")/,
    `$1${escapeAttr(route.title)}$2`)
  out = out.replace(/(<meta property="og:description" content=")[^"]*(")/,
    `$1${escapeAttr(route.description)}$2`)
  out = out.replace(/(<meta property="og:url" content=")[^"]*(")/,
    `$1${SITE_URL}${route.path}$2`)
  out = out.replace(/(<meta property="og:image" content=")[^"]*(")/,
    `$1${route.ogImage}$2`)
  out = out.replace(/(<meta property="og:type" content=")[^"]*(")/,
    `$1${route.ogType}$2`)

  // Twitter tags
  out = out.replace(/(<meta name="twitter:title" content=")[^"]*(")/,
    `$1${escapeAttr(route.title)}$2`)
  out = out.replace(/(<meta name="twitter:description" content=")[^"]*(")/,
    `$1${escapeAttr(route.description)}$2`)
  out = out.replace(/(<meta name="twitter:image" content=")[^"]*(")/,
    `$1${route.ogImage}$2`)

  // JSON-LD
  if (route.jsonLd) {
    const scriptTag = `<script type="application/ld+json">${JSON.stringify(route.jsonLd)}</script>`
    out = out.replace('</head>', `  ${scriptTag}\n  </head>`)
  }

  return out
}

const baseHtml = readFileSync(join(distDir, 'index.html'), 'utf8')

for (const route of routes) {
  const html = injectMeta(baseHtml, route)

  let outPath
  if (route.path === '/') {
    outPath = join(distDir, 'index.html')
  } else {
    const dir = join(distDir, route.path.slice(1))  // strip leading /
    mkdirSync(dir, { recursive: true })
    outPath = join(dir, 'index.html')
  }

  writeFileSync(outPath, html, 'utf8')
  console.log(`✓ ${route.path}`)
}

console.log(`\nPre-rendered ${routes.length} routes.`)
```

- [ ] **Step 2: Verify the script is syntactically valid**

```bash
node --check scripts/prerender.mjs
```

Expected: exits 0 with no output.

- [ ] **Step 3: Commit**

```bash
git add scripts/prerender.mjs
git commit -m "feat(seo): add post-build pre-render script for static meta tag injection"
```

---

## Task 6: Wire up pre-render in the build

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Update the build script**

In `package.json`, change:

```json
"build": "tsc -b && vite build"
```

to:

```json
"build": "tsc -b && vite build && node scripts/prerender.mjs"
```

- [ ] **Step 2: Run a full build and verify output**

```bash
npm run build
```

Expected output ends with something like:
```
✓ /
✓ /pricing
✓ /blog
✓ /blog/introducing-openthorn
✓ /faq
✓ /terms
✓ /privacy
✓ /cookies
✓ /imprint
✓ /moderation

Pre-rendered 10 routes.
```

- [ ] **Step 3: Spot-check a pre-rendered file**

```bash
node -e "const fs = require('fs'); const h = fs.readFileSync('dist/pricing/index.html','utf8'); console.log(h.match(/<title>[^<]+<\/title>/)[0]); console.log(h.match(/<meta property=\"og:description\" content=\"[^\"]+\"/)[0])"
```

Expected:
```
<title>Model Pricing — OpenThorn</title>
<meta property="og:description" content="Compare per-token pricing across the AI providers OpenThorn supports. You pay your provider directly — OpenThorn charges no subscription."
```

- [ ] **Step 4: Check that JSON-LD is present in the home page and blog post**

```bash
node -e "const fs = require('fs'); const h = fs.readFileSync('dist/index.html','utf8'); console.log(h.includes('SoftwareApplication') ? 'HOME JSON-LD OK' : 'MISSING')"
node -e "const fs = require('fs'); const h = fs.readFileSync('dist/blog/introducing-openthorn/index.html','utf8'); console.log(h.includes('BlogPosting') ? 'BLOG JSON-LD OK' : 'MISSING')"
```

Expected: both print `OK`.

- [ ] **Step 5: Commit**

```bash
git add package.json
git commit -m "feat(seo): run pre-render script as part of production build"
```

---

## Task 7: Deploy and validate

- [ ] **Step 1: Push to trigger Vercel deployment**

```bash
git push
```

- [ ] **Step 2: Validate OG tags on a pre-rendered route**

Use the [OpenGraph debugger](https://www.opengraph.xyz) or curl to confirm social crawlers see the right tags:

```bash
curl -s https://www.openthorn.app/pricing | grep -E "<title>|og:description"
```

Expected (no JS execution needed — these are in the static HTML):
```html
<title>Model Pricing — OpenThorn</title>
<meta property="og:description" content="Compare per-token pricing...
```

- [ ] **Step 3: Validate JSON-LD with Google's Rich Results Test**

Visit `https://search.google.com/test/rich-results` and test:
- `https://www.openthorn.app/` — should show SoftwareApplication
- `https://www.openthorn.app/blog/introducing-openthorn` — should show BlogPosting

- [ ] **Step 4: Resubmit sitemap in Google Search Console**

In [Google Search Console](https://search.google.com/search-console), under the `www.openthorn.app` property, go to Sitemaps and submit:
```
https://www.openthorn.app/sitemap.xml
```

---

## Notes for future blog posts

When a new blog post is added to `src/data/blogPosts.ts`, also add an entry to the `routes` array in `scripts/prerender.mjs` to ensure it gets a pre-rendered HTML file with correct meta tags. The title format is `{post.title} — OpenThorn`.
