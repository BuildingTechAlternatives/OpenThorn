// Build-time: fetch published posts from Supabase and write them to the
// file-based blog source (blog-meta.json + content/blog/<slug>.md) so the
// existing bundle/SSR/prerender pipeline runs on real data. Resilient: if
// Supabase is unreachable or returns zero posts, the existing files are left
// untouched (a build never wipes the blog).
import { readFileSync, writeFileSync, readdirSync, rmSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..')

function loadEnv() {
  try {
    const raw = readFileSync(join(rootDir, '.env'), 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch { /* rely on process.env */ }
}
loadEnv()

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!url || !anon) {
  console.log('sync-blog: no Supabase env — keeping existing blog files.')
  process.exit(0)
}

let rows
try {
  const res = await fetch(
    `${url}/rest/v1/blog_posts?status=eq.published&select=*&order=date.desc`,
    { headers: { apikey: anon, Authorization: `Bearer ${anon}` } },
  )
  if (!res.ok) throw new Error(`status ${res.status}`)
  rows = await res.json()
} catch (err) {
  console.log(`sync-blog: fetch failed (${err.message}) — keeping existing files.`)
  process.exit(0)
}

if (!Array.isArray(rows) || rows.length === 0) {
  console.log('sync-blog: zero published posts returned — keeping existing files.')
  process.exit(0)
}

// blog-meta.json entry — omit null/empty optional fields to match the
// hand-authored shape the prerender script and bundle expect.
function toMeta(r) {
  const m = { slug: r.slug, title: r.title, date: r.date, excerpt: r.excerpt ?? '' }
  if (r.date_modified) m.dateModified = r.date_modified
  if (r.cover_youtube) m.coverYoutube = r.cover_youtube
  if (r.cover_image) m.coverImage = r.cover_image
  if (r.og_image) m.ogImage = r.og_image
  if (r.tldr) m.tldr = r.tldr
  if (r.how_to) m.howTo = r.how_to
  if (r.item_list) m.itemList = r.item_list
  return m
}

const meta = rows.map(toMeta)
writeFileSync(join(rootDir, 'src/data/blog-meta.json'), JSON.stringify(meta, null, 2) + '\n', 'utf8')

const contentDir = join(rootDir, 'src/content/blog')
const wantedFiles = new Set(rows.map((r) => `${r.slug}.md`))
// Remove md files for posts no longer published, then (re)write current ones.
for (const f of readdirSync(contentDir)) {
  if (f.endsWith('.md') && !wantedFiles.has(f)) rmSync(join(contentDir, f))
}
for (const r of rows) {
  writeFileSync(join(contentDir, `${r.slug}.md`), r.content ?? '', 'utf8')
}

console.log(`sync-blog: wrote ${rows.length} published posts.`)
