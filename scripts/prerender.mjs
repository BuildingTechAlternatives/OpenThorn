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
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')
const distDir = join(rootDir, 'dist')
const SITE_URL = 'https://www.openthorn.app'
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-card.png`
const LOGO_URL = `${SITE_URL}/logo.png`

const blogMeta = JSON.parse(readFileSync(join(rootDir, 'src', 'data', 'blog-meta.json'), 'utf8'))
const faqData = JSON.parse(readFileSync(join(rootDir, 'src', 'data', 'faq.json'), 'utf8'))

// ---------------------------------------------------------------------------
// Helpers

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeAttr(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

// Minimal markdown → HTML for the static content snapshot. Handles the subset
// used in blog posts (headings, lists, paragraphs, links, bold, inline code).
// This is crawler-facing fallback content only — the real page is rendered by
// react-markdown after hydration.
function markdownToHtml(md) {
  function inline(text) {
    return escapeHtml(text)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>')
  }

  const blocks = md.split(/\r?\n\r?\n/)
  const out = []
  for (const block of blocks) {
    const lines = block.split(/\r?\n/).filter((l) => l.trim() !== '')
    if (lines.length === 0) continue

    const headingMatch = lines[0].match(/^(#{1,4})\s+(.*)$/)
    if (headingMatch && lines.length === 1) {
      const level = headingMatch[1].length + 1 // shift down: post h1 is the title
      out.push(`<h${level}>${inline(headingMatch[2])}</h${level}>`)
      continue
    }
    if (lines.every((l) => /^[-*]\s+/.test(l))) {
      out.push(`<ul>${lines.map((l) => `<li>${inline(l.replace(/^[-*]\s+/, ''))}</li>`).join('')}</ul>`)
      continue
    }
    if (lines.every((l) => /^\d+\.\s+/.test(l))) {
      out.push(`<ol>${lines.map((l) => `<li>${inline(l.replace(/^\d+\.\s+/, ''))}</li>`).join('')}</ol>`)
      continue
    }
    out.push(`<p>${inline(lines.join(' '))}</p>`)
  }
  return out.join('\n')
}

function blogPostingJsonLd(post) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt,
    datePublished: post.date,
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
    contentHtml: `
      <h1>Build with OpenThorn — the BYOK AI website builder</h1>
      <p>Just describe what you want and OpenThorn generates the code — ready to customize and deploy anywhere.</p>
      <p>OpenThorn is free to use: you bring your own API key from any of 17 supported AI providers (OpenAI, Anthropic, Google Gemini, and more) and pay your provider directly. No platform markup, no subscription, no lock-in. Export real code to your own repo and infrastructure.</p>
      <ul>
        <li><a href="/pricing">Compare AI model pricing</a></li>
        <li><a href="/faq">Frequently asked questions</a></li>
        <li><a href="/blog/what-is-a-byok-ai-website-builder">What is a BYOK AI website builder?</a></li>
      </ul>`,
  },
  {
    path: '/pricing',
    title: 'Model Pricing — OpenThorn',
    description:
      'Compare per-token pricing across the AI providers OpenThorn supports. You pay your provider directly — OpenThorn charges no subscription.',
    ogType: 'website',
    lastmod: '2026-06-11',
    jsonLd: [],
    contentHtml: `
      <h1>Model pricing, transparent</h1>
      <p>BYOK means you pay providers directly — no markup, no subscription, no hidden fees. OpenThorn shows live per-token cost and quality data for flagship models across 17 supported AI providers so you can choose the best model for your budget.</p>
      <p><a href="/faq">Read the FAQ</a> or learn <a href="/blog/what-is-a-byok-ai-website-builder">what a BYOK AI website builder is</a>.</p>`,
  },
  {
    path: '/blog',
    title: 'Blog — OpenThorn',
    description:
      'Product updates, guides, and stories from the OpenThorn team on building and shipping websites with AI.',
    ogType: 'website',
    lastmod: blogMeta.map((p) => p.date).sort().at(-1),
    jsonLd: [],
    contentHtml: `
      <h1>OpenThorn Blog</h1>
      <p>Product updates, guides, and stories on building and shipping websites with AI.</p>
      <ul>${blogMeta
        .map((p) => `<li><a href="/blog/${p.slug}">${escapeHtml(p.title)}</a> — ${escapeHtml(p.excerpt)}</li>`)
        .join('')}</ul>`,
  },
  ...blogMeta.map((post) => ({
    path: `/blog/${post.slug}`,
    title: `${post.title} — OpenThorn`,
    description: post.excerpt,
    ogImage: post.ogImage,
    ogType: 'article',
    lastmod: post.date,
    jsonLd: [blogPostingJsonLd(post), breadcrumbJsonLd(post)],
    contentHtml: `
      <article>
        <h1>${escapeHtml(post.title)}</h1>
        <p><time datetime="${post.date}">${post.date}</time></p>
        ${markdownToHtml(readFileSync(join(rootDir, 'src', 'content', 'blog', `${post.slug}.md`), 'utf8'))}
      </article>`,
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
    contentHtml: `
      <h1>Frequently asked questions about OpenThorn</h1>
      ${faqData
        .map(
          (category) =>
            `<h2>${escapeHtml(category.label)}</h2>` +
            category.items
              .map((item) => `<h3>${escapeHtml(item.question)}</h3><p>${escapeHtml(item.answer)}</p>`)
              .join('')
        )
        .join('')}`,
  },
  {
    path: '/terms',
    title: 'Terms of Service — OpenThorn',
    description: 'Terms of service for OpenThorn.',
    ogType: 'website',
    jsonLd: [],
    contentHtml: '<h1>Terms of Service</h1><p>Terms of service for OpenThorn, the BYOK AI website builder.</p>',
  },
  {
    path: '/privacy',
    title: 'Privacy Policy — OpenThorn',
    description: 'Privacy policy for OpenThorn.',
    ogType: 'website',
    lastmod: '2026-06-10',
    jsonLd: [],
    contentHtml: '<h1>Privacy Policy</h1><p>Privacy policy for OpenThorn, the BYOK AI website builder.</p>',
  },
  {
    path: '/cookies',
    title: 'Cookie Policy — OpenThorn',
    description: 'Cookie policy for OpenThorn.',
    ogType: 'website',
    lastmod: '2026-06-10',
    jsonLd: [],
    contentHtml: '<h1>Cookie Policy</h1><p>Cookie policy for OpenThorn, the BYOK AI website builder.</p>',
  },
  {
    path: '/imprint',
    title: 'Imprint — OpenThorn',
    description: 'Legal imprint for OpenThorn.',
    ogType: 'website',
    jsonLd: [],
    contentHtml: '<h1>Imprint</h1><p>Legal imprint for OpenThorn.</p>',
  },
  {
    path: '/moderation',
    title: 'Moderation and DSA — OpenThorn',
    description: 'Moderation policy and DSA compliance information for OpenThorn.',
    ogType: 'website',
    jsonLd: [],
    contentHtml: '<h1>Moderation and DSA</h1><p>Moderation policy and DSA compliance information for OpenThorn.</p>',
  },
]

// ---------------------------------------------------------------------------
// HTML generation

function injectMeta(html, route) {
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

  // Static content snapshot inside #root: real text for crawlers that don't run
  // JS. React's createRoot wipes it when the app hydrates, so users only see it
  // for a moment on slow connections.
  if (route.contentHtml) {
    out = out.replace(
      '<div id="root"></div>',
      `<div id="root"><div style="max-width:720px;margin:0 auto;padding:48px 24px;line-height:1.6">${route.contentHtml}\n</div></div>`
    )
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

console.log(`\nPre-rendered ${routes.length} routes.`)
