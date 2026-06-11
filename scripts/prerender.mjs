// Post-build script: generates pre-rendered HTML + sitemap.xml for every public route.
// Run: node scripts/prerender.mjs
//
// Produces:
//   - dist/{route}/index.html with correct <head> metadata for each route
//   - a static content snapshot inside #root (replaced on React hydration) so
//     non-JS crawlers see real text, not an empty shell
//   - dist/sitemap.xml with <lastmod>, derived from the same route list
//
// Social media crawlers (Twitter, LinkedIn, Slack) don't execute JS — they need
// these tags in the static HTML. Vercel serves static files before rewrite rules,
// so pre-rendered files are served automatically without any config changes.
//
// Blog routes are derived from src/data/blog-meta.json and FAQ structured data
// from src/data/faq.json — the same sources the app imports — so new blog posts
// and FAQ edits are picked up here automatically.

import { readFileSync, mkdirSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { buildLlmsFull } from './llms-full.mjs'
import { loadFonts, renderOgCard } from './og-cards.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')
const distDir = join(rootDir, 'dist')
const SITE_URL = 'https://www.openthorn.app'
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-card.png`
const LOGO_URL = `${SITE_URL}/logo.png`

const blogMeta = JSON.parse(readFileSync(join(rootDir, 'src', 'data', 'blog-meta.json'), 'utf8'))
const faqData = JSON.parse(readFileSync(join(rootDir, 'src', 'data', 'faq.json'), 'utf8'))
const changelog = JSON.parse(readFileSync(join(rootDir, 'src', 'data', 'changelog.json'), 'utf8'))
const compareMeta = JSON.parse(readFileSync(join(rootDir, 'src', 'data', 'compare-meta.json'), 'utf8'))
const glossary = JSON.parse(readFileSync(join(rootDir, 'src', 'data', 'glossary.json'), 'utf8'))

// Build-time SSR renderer (vite build --ssr src/entry-ssr.tsx --outDir dist-ssr)
const { render } = await import(pathToFileURL(join(rootDir, 'dist-ssr', 'entry-ssr.js')).href)

// ---------------------------------------------------------------------------
// Helpers

function escapeAttr(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

function blogPostingJsonLd(post) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt,
    datePublished: post.date,
    dateModified: post.dateModified ?? post.date,
    url: `${SITE_URL}/blog/${post.slug}`,
    author: { '@type': 'Organization', name: 'OpenThorn' },
    publisher: {
      '@type': 'Organization',
      name: 'OpenThorn',
      logo: { '@type': 'ImageObject', url: LOGO_URL },
    },
    image: post.ogImage ?? DEFAULT_OG_IMAGE,
  }
}

function pageBreadcrumbJsonLd(name) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name },
    ],
  }
}

function breadcrumbJsonLd(post) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_URL}/blog` },
      { '@type': 'ListItem', position: 3, name: post.title },
    ],
  }
}

// ---------------------------------------------------------------------------
// Routes

const routes = [
  {
    path: '/',
    title: 'OpenThorn — The BYOK AI Website Builder',
    description:
      'OpenThorn is the BYOK AI website builder — describe what you want, get a complete, deployable website. No subscription, no lock-in.',
    ogType: 'website',
    lastmod: '2026-06-11',
    jsonLd: [
      {
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
    ],
  },
  {
    path: '/pricing',
    title: 'Model Pricing — OpenThorn',
    description:
      'Compare per-token pricing across the AI providers OpenThorn supports. You pay your provider directly — OpenThorn charges no subscription.',
    ogType: 'website',
    lastmod: '2026-06-11',
    jsonLd: [],
  },
  {
    path: '/blog',
    title: 'Blog — OpenThorn',
    description:
      'Product updates, guides, and stories from the OpenThorn team on building and shipping websites with AI.',
    ogType: 'website',
    lastmod: blogMeta.map((p) => p.date).sort().at(-1),
    jsonLd: [],
  },
  ...blogMeta.map((post) => ({
    path: `/blog/${post.slug}`,
    title: `${post.title} — OpenThorn`,
    description: post.excerpt,
    ogImage: post.ogImage,
    ogType: 'article',
    lastmod: post.dateModified ?? post.date,
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
  {
    path: '/faq',
    title: 'FAQ — OpenThorn',
    description:
      'Answers to common questions about OpenThorn — how bring-your-own-key works, supported AI providers, costs, and deploying your generated site.',
    ogType: 'website',
    lastmod: '2026-06-11',
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqData.flatMap((category) =>
          category.items.map((item) => ({
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: { '@type': 'Answer', text: item.answer },
          }))
        ),
      },
    ],
  },
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
      pageBreadcrumbJsonLd(entry.title),
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
  {
    path: '/changelog',
    title: 'Changelog — OpenThorn',
    description:
      'Every OpenThorn update, generated automatically from our GitHub commit history — new features, fixes, and improvements as they ship.',
    ogType: 'website',
    lastmod: changelog.days[0]?.date,
    jsonLd: [],
  },
  {
    path: '/terms',
    title: 'Terms of Service — OpenThorn',
    description: 'Terms of service for OpenThorn.',
    ogType: 'website',
    jsonLd: [pageBreadcrumbJsonLd('Terms of Service')],
  },
  {
    path: '/privacy',
    title: 'Privacy Policy — OpenThorn',
    description: 'Privacy policy for OpenThorn.',
    ogType: 'website',
    lastmod: '2026-06-10',
    jsonLd: [pageBreadcrumbJsonLd('Privacy Policy')],
  },
  {
    path: '/cookies',
    title: 'Cookie Policy — OpenThorn',
    description: 'Cookie policy for OpenThorn.',
    ogType: 'website',
    lastmod: '2026-06-10',
    jsonLd: [pageBreadcrumbJsonLd('Cookie Policy')],
  },
  {
    path: '/imprint',
    title: 'Imprint — OpenThorn',
    description: 'Legal imprint for OpenThorn.',
    ogType: 'website',
    jsonLd: [pageBreadcrumbJsonLd('Imprint')],
  },
  {
    path: '/moderation',
    title: 'Moderation and DSA — OpenThorn',
    description: 'Moderation policy and DSA compliance information for OpenThorn.',
    ogType: 'website',
    jsonLd: [pageBreadcrumbJsonLd('Moderation and DSA')],
  },
]

// ---------------------------------------------------------------------------
// HTML generation

function injectMeta(html, route, appHtml) {
  let out = html
  const ogImage = route.ogImage || DEFAULT_OG_IMAGE

  out = out.replace(/<title>[^<]*<\/title>/, `<title>${escapeAttr(route.title)}</title>`)

  out = out.replace(
    /(<meta name="description" content=")[^"]*(")/,
    `$1${escapeAttr(route.description)}$2`
  )

  out = out.replace(/(<meta property="og:title" content=")[^"]*(")/,
    `$1${escapeAttr(route.title)}$2`)
  out = out.replace(/(<meta property="og:description" content=")[^"]*(")/,
    `$1${escapeAttr(route.description)}$2`)
  out = out.replace(/(<meta property="og:url" content=")[^"]*(")/,
    `$1${SITE_URL}${route.path}$2`)
  out = out.replace(/(<meta property="og:image" content=")[^"]*(")/,
    `$1${ogImage}$2`)
  out = out.replace(/(<meta property="og:type" content=")[^"]*(")/,
    `$1${route.ogType}$2`)

  out = out.replace(/(<meta name="twitter:title" content=")[^"]*(")/,
    `$1${escapeAttr(route.title)}$2`)
  out = out.replace(/(<meta name="twitter:description" content=")[^"]*(")/,
    `$1${escapeAttr(route.description)}$2`)
  out = out.replace(/(<meta name="twitter:image" content=")[^"]*(")/,
    `$1${ogImage}$2`)

  // Canonical URL in the static HTML (crawlers don't run the useEffect that sets it)
  out = out.replace(
    '</head>',
    `  <link rel="canonical" href="${SITE_URL}${route.path}" />\n  </head>`
  )

  // data-prerendered marks these for removal at app boot (src/main.tsx):
  // the same schemas are re-injected at runtime by useJsonLd, and Google's
  // JS rendering would otherwise see each schema twice ("Duplicate field"
  // error in the Rich Results test).
  for (const schema of route.jsonLd) {
    const scriptTag = `<script type="application/ld+json" data-prerendered>${JSON.stringify(schema)}</script>`
    out = out.replace('</head>', `  ${scriptTag}\n  </head>`)
  }

  // Real SSR body: the actual React page rendered at build time, so non-JS
  // crawlers (GPTBot, ClaudeBot, PerplexityBot) read the same content users see.
  // src/main.tsx hydrates this markup with hydrateRoot.
  if (appHtml) {
    out = out.replace('<div id="root"></div>', `<div id="root">${appHtml}</div>`)
  }

  return out
}

const baseHtml = readFileSync(join(distDir, 'index.html'), 'utf8')

// Per-route OG cards, generated at build time. Routes with an explicit
// ogImage (e.g. blog posts with a real cover) keep it.
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

for (const route of routes) {
  if (!route.ogImage) {
    const slug = ogSlug(route.path)
    const cardTitle = route.title.replace(/ — OpenThorn$/, '')
    const png = await renderOgCard({ title: cardTitle, eyebrow: ogEyebrow(route.path) }, ogFonts)
    writeFileSync(join(distDir, 'og', `${slug}.png`), png)
    route.ogImage = `${SITE_URL}/og/${slug}.png`
  }
  const appHtml = await render(route.path)
  const html = injectMeta(baseHtml, route, appHtml)

  let outPath
  if (route.path === '/') {
    outPath = join(distDir, 'index.html')
  } else {
    const dir = join(distDir, route.path.slice(1))
    mkdirSync(dir, { recursive: true })
    outPath = join(dir, 'index.html')
  }

  writeFileSync(outPath, html, 'utf8')
  console.log(`✓ ${route.path}`)
}

// ---------------------------------------------------------------------------
// Sitemap — generated from the same routes so blog posts are never missed.
// changefreq/priority are omitted: Google ignores them but does use lastmod.

const sitemapEntries = routes
  .map((route) => {
    const lastmod = route.lastmod ? `\n    <lastmod>${route.lastmod}</lastmod>` : ''
    return `  <url>\n    <loc>${SITE_URL}${route.path}</loc>${lastmod}\n  </url>`
  })
  .join('\n')

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries}
</urlset>
`

writeFileSync(join(distDir, 'sitemap.xml'), sitemap, 'utf8')
console.log('✓ sitemap.xml')

writeFileSync(
  join(distDir, 'llms-full.txt'),
  buildLlmsFull({ rootDir, blogMeta, faqData, compareMeta, glossary }),
  'utf8'
)
console.log('✓ llms-full.txt')

console.log(`\nPre-rendered ${routes.length} routes.`)
