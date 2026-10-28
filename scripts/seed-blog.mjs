// One-time bootstrap: upsert the current file-based blog posts into Supabase.
// Run: node scripts/seed-blog.mjs   (needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..')

// Minimal .env loader (no dotenv dependency).
function loadEnv() {
  try {
    const raw = readFileSync(join(rootDir, '.env'), 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch { /* no .env — rely on process.env */ }
}
loadEnv()

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const meta = JSON.parse(readFileSync(join(rootDir, 'src/data/blog-meta.json'), 'utf8'))
const contentDir = join(rootDir, 'src/content/blog')
const files = new Set(readdirSync(contentDir))

const rows = meta.map((m) => {
  const file = `${m.slug}.md`
  const content = files.has(file) ? readFileSync(join(contentDir, file), 'utf8') : ''
  return {
    slug: m.slug,
    title: m.title,
    excerpt: m.excerpt ?? '',
    content,
    date: m.date,
    date_modified: m.dateModified ?? null,
    cover_youtube: m.coverYoutube ?? null,
    cover_image: m.coverImage ?? null,
    og_image: m.ogImage ?? null,
    tldr: m.tldr ?? null,
    how_to: m.howTo ?? null,
    item_list: m.itemList ?? null,
    status: 'published',
    published_at: new Date(`${m.date}T12:00:00Z`).toISOString(),
  }
})

const res = await fetch(`${url}/rest/v1/blog_posts?on_conflict=slug`, {
  method: 'POST',
  headers: {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates,return=minimal',
  },
  body: JSON.stringify(rows),
})
if (!res.ok) {
  console.error(`Seed failed ${res.status}: ${await res.text()}`)
  process.exit(1)
}
console.log(`Seeded ${rows.length} posts.`)
