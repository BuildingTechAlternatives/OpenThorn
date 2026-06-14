// Quick post-build sanity check for the prerender output. Run after npm run build.
import { readFileSync } from 'fs'

const checks = [
  ['dist/index.html', '"@type":"Organization"', 'home: Organization JSON-LD', (h) => h.replace(/\s+/g, '')],
  ['dist/index.html', '"@type":"WebSite"', 'home: WebSite JSON-LD', (h) => h.replace(/\s+/g, '')],
  ['dist/index.html', 'SoftwareApplication', 'home: SoftwareApplication JSON-LD'],
  ['dist/index.html', 'Build with OpenThorn', 'home: hero SSR body'],
  ['dist/index.html', 'deploy anywhere', 'home: hero subtitle SSR body'],
  ['dist/index.html', 'rel="canonical" href="https://www.openthorn.app/"', 'home: canonical'],
  ['dist/index.html', '/og/home.png', 'home: generated og card'],
  ['dist/faq/index.html', 'FAQPage', 'faq: FAQPage JSON-LD'],
  ['dist/faq/index.html', 'data-prerendered', 'faq: JSON-LD marked for boot removal'],
  ['dist/faq/index.html', '18 AI providers', 'faq: provider answer'],
  ['dist/pricing/index.html', '<div id="root"><', 'pricing: non-empty root'],
  ['dist/changelog/index.html', '<div id="root"><', 'changelog: non-empty root'],
  ['dist/faq/index.html', 'aria-expanded', 'faq: interactive markup SSR body'],
  ['dist/blog/what-is-a-byok-ai-website-builder/index.html', 'BlogPosting', 'byok post: BlogPosting'],
  ['dist/blog/what-is-a-byok-ai-website-builder/index.html', 'BreadcrumbList', 'byok post: BreadcrumbList'],
  ['dist/blog/what-is-a-byok-ai-website-builder/index.html', 'What does BYOK mean?', 'byok post: SSR body'],
  ['dist/blog/introducing-openthorn/index.html', 'The problem with AI builders', 'intro post: SSR body'],
  ['dist/sitemap.xml', 'what-is-a-byok-ai-website-builder', 'sitemap: new post'],
  ['dist/compare/index.html', 'ItemList', 'compare index: ItemList JSON-LD'],
  ['dist/compare/index.html', 'OpenThorn vs Lovable', 'compare index: SSR body'],
  ['dist/compare/lovable/index.html', 'FAQPage', 'compare/lovable: FAQPage JSON-LD'],
  ['dist/compare/lovable/index.html', 'Is OpenThorn a free alternative to Lovable?', 'compare/lovable: SSR body'],
  ['dist/compare/bolt/index.html', 'token packs', 'compare/bolt: SSR body'],
  ['dist/compare/v0/index.html', 'OpenThorn vs v0', 'compare/v0: SSR body'],
  ['dist/glossary/index.html', 'DefinedTermSet', 'glossary: DefinedTermSet JSON-LD'],
  ['dist/glossary/index.html', 'Context window', 'glossary: SSR body'],
  ['dist/sitemap.xml', '/compare/lovable', 'sitemap: compare pages'],
  ['dist/sitemap.xml', '/compare', 'sitemap: compare index'],
  ['dist/sitemap.xml', '/glossary', 'sitemap: glossary'],
  ['dist/terms/index.html', 'BreadcrumbList', 'terms: BreadcrumbList JSON-LD'],
  ['dist/llms.txt', 'BYOK', 'llms.txt copied to dist'],
  ['dist/llms.txt', 'llms-full.txt', 'llms.txt links llms-full'],
  ['dist/llms-full.txt', 'Frequently Asked Questions', 'llms-full: FAQ section'],
  ['dist/llms-full.txt', 'Best BYOK AI Website Builders', 'llms-full: blog content'],
  ['dist/llms-full.txt', 'OpenThorn vs Lovable', 'llms-full: comparisons'],
  ['dist/robots.txt', 'GPTBot', 'robots.txt: AI crawlers'],
  ['dist/build-with/index.html', 'ItemList', 'build-with index: ItemList JSON-LD'],
  ['dist/build-with/index.html', 'Build with your API key', 'build-with index: SSR body'],
  ['dist/build-with/openai/index.html', 'FAQPage', 'build-with/openai: FAQPage JSON-LD'],
  ['dist/build-with/openai/index.html', 'HowTo', 'build-with/openai: HowTo JSON-LD'],
  ['dist/build-with/openai/index.html', 'platform.openai.com', 'build-with/openai: SSR body'],
  ['dist/build-with/anthropic/index.html', 'Claude Sonnet 4.6', 'build-with/anthropic: SSR body'],
  ['dist/build-with/ollama/index.html', 'Qwen 2.5 Coder', 'build-with/ollama: SSR body'],
  ['dist/sitemap.xml', '/build-with/openai', 'sitemap: provider guides'],
  ['dist/sitemap.xml', '/build-with/nvidia', 'sitemap: all providers present'],
  ['dist/compare/framer/index.html', 'OpenThorn vs Framer', 'compare/framer: SSR body'],
  ['dist/compare/durable/index.html', 'OpenThorn vs Durable', 'compare/durable: SSR body'],
  ['dist/compare/wix/index.html', 'OpenThorn vs Wix', 'compare/wix: SSR body'],
  ['dist/blog/lovable-vs-bolt-vs-v0-pricing/index.html', 'BlogPosting', 'matchup post: BlogPosting'],
  ['dist/blog/lovable-vs-bolt-vs-v0-pricing/index.html', 'TL;DR', 'matchup post: TL;DR answer block SSR'],
  ['dist/rss.xml', '<rss version="2.0"', 'rss.xml generated'],
  ['dist/rss.xml', 'lovable-vs-bolt-vs-v0-pricing', 'rss.xml includes newest post'],
  ['dist/index.html', 'application/rss+xml', 'home: RSS alternate link'],
  ['dist/llms-full.txt', 'Provider guides', 'llms-full: provider guides section'],
  ['dist/llms.txt', '/build-with', 'llms.txt links provider guides'],
  ['dist/og-card.png', null, 'og-card.png copied to dist'],
  ['dist/og/home.png', null, 'og: home card generated'],
  ['dist/og/compare-lovable.png', null, 'og: compare card generated'],
  ['dist/og/blog-lovable-vs-bolt-vs-v0-pricing.png', null, 'og: matchup post card generated'],
  ['dist/og/build-with-openai.png', null, 'og: provider guide card generated'],
]

let failed = 0
for (const [file, needle, label, transform] of checks) {
  try {
    let content = readFileSync(file, needle === null ? undefined : 'utf8')
    if (needle !== null && transform) content = transform(content)
    const ok = needle === null || content.includes(needle)
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}`)
    if (!ok) failed++
  } catch (e) {
    console.log(`FAIL ${label} (${e.message})`)
    failed++
  }
}
process.exit(failed ? 1 : 0)
