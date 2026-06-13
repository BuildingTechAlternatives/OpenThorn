// One-time bootstrap: upsert the bundled templates into Supabase.
// Run: node scripts/seed-templates.mjs  (needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
// Node 24 strips the type-only import in templates.ts, so this imports cleanly.
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

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
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }

const { TEMPLATES } = await import(pathToFileURL(join(rootDir, 'src/lib/templates.ts')).href)

const rows = TEMPLATES.map((t, i) => ({
  template_key: t.id,
  name: t.name,
  description: t.description,
  category: t.category,
  accent_color: t.accentColor,
  highlights: t.highlights,
  files: t.files,
  featured: false,
  sort_order: i,
  status: 'published',
}))

const res = await fetch(`${url}/rest/v1/templates?on_conflict=template_key`, {
  method: 'POST',
  headers: {
    apikey: key, Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates,return=minimal',
  },
  body: JSON.stringify(rows),
})
if (!res.ok) { console.error(`Seed failed ${res.status}: ${await res.text()}`); process.exit(1) }
console.log(`Seeded ${rows.length} templates.`)
