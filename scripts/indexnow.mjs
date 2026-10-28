// Submits all public URLs to IndexNow so Bing and the answer engines that
// consume IndexNow re-crawl promptly after a deploy. ChatGPT Search discovers
// URLs through Bing's index, so fast Bing indexing matters for AI visibility.
//
// Runs automatically at the end of `npm run build` on Vercel production
// builds (VERCEL_ENV=production) using the freshly generated dist/sitemap.xml,
// and can be run manually any time: npm run indexnow
//
// Never fails the build: any error logs a warning and exits 0 (except when
// run manually, where failures exit 1 so they are visible).
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const SITE_URL = 'https://www.openthorn.app'
const KEY = '7f3a9c2e5b8d4f6a1c0e9b7d3a5f8c2e'

// `npm run indexnow` is a deliberate manual submission (strict exit codes).
// Anything else (the `npm run build` chain) only submits on Vercel production
// builds and never fails the build.
const isManual = process.env.npm_lifecycle_event === 'indexnow'
const isBuildHook = !isManual

if (isBuildHook && process.env.VERCEL_ENV !== 'production') {
  console.log('IndexNow: skipped (not a Vercel production build)')
  process.exit(0)
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const localSitemap = join(__dirname, '..', 'dist', 'sitemap.xml')

try {
  // Prefer the just-built sitemap (includes brand-new URLs); fall back to live.
  const sitemap = existsSync(localSitemap)
    ? readFileSync(localSitemap, 'utf8')
    : await (await fetch(`${SITE_URL}/sitemap.xml`)).text()
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])

  if (urls.length === 0) throw new Error('No URLs found in sitemap')

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

  console.log(`IndexNow: submitted ${urls.length} URLs — HTTP ${res.status}`)
  if (!res.ok && !isBuildHook) process.exit(1)
} catch (err) {
  console.warn(`IndexNow: failed (${err.message})`)
  if (!isBuildHook) process.exit(1)
}
