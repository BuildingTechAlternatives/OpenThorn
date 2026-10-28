# Admin Panel Phase 3 (Blog CMS) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make Supabase `blog_posts` the source of truth for the blog, editable from `/admin/blog` with a markdown live-preview editor and a draft→publish workflow; publishing is visible instantly at runtime and fires a Vercel deploy hook so the prerender/SEO pipeline regenerates. Per Phase 3 of `docs/superpowers/specs/2026-06-12-admin-panel-design.md`.

**Architecture (and deviation from spec):** The spec said "prerender.mjs fetches posts from Supabase at build time." Instead of teaching the SSR/prerender renderer to inject Supabase data (high hydration risk — this project has hit hydration mismatches before), a **build-time sync** script (`scripts/sync-blog.mjs`) fetches published posts from Supabase and writes the existing `src/data/blog-meta.json` + `src/content/blog/<slug>.md` files **before** the bundle/SSR/prerender steps. The entire existing SSR + prerender + OG + sitemap + RSS pipeline then runs unchanged on real files. `blogPosts.ts` switches from per-slug static imports to `import.meta.glob` so any synced file is bundled. At **runtime**, BlogPage/BlogPostPage render bundled data first (hydration-safe, identical to SSR) then refetch published posts from Supabase to surface anything newer than the last build ("instant"). Publishing from the admin fires `VERCEL_DEPLOY_HOOK_URL` via a new `trigger-deploy` action on `/api/admin`, which regenerates the static files within minutes.

**Tech Stack:** React 19 + TS, React Router v7, Supabase (RLS, jsonb), `react-markdown` + `remark-gfm` (already deps), Node ESM build scripts, Vitest.

**Conventions:** no `Co-Authored-By`; CSS design tokens; admin pages in `src/pages/admin/` reusing `AdminUsersPage.module.css` button/pill patterns; endpoint logic in `api/_shared.ts` consumed by both `api/admin.ts` and the vite dev shim.

**Prerequisites already on master (Phases 1–2):** `public.is_admin()`, `/admin` route group + `AdminGuard` + `AdminLayout` `NAV_ITEMS`, `src/lib/admin.ts` (`adminUserAction` calls `/api/admin`), `api/admin.ts` action handler + `api/_shared.ts` (`verifyUser`, `rateLimit`, `isAdminUser`, `hasServiceRoleKey`), `app_config`/admin RLS patterns.

**Existing blog facts (verified):**
- `src/data/blog-meta.json` — array of metadata objects (camelCase: `slug`, `title`, `date`, `excerpt`, `coverYoutube?`, `coverImage?`, `ogImage?`, `dateModified?`, `tldr?`, `howTo?`, `itemList?`).
- `src/content/blog/<slug>.md` — markdown body per post (6 posts today).
- `src/data/blogPosts.ts` — merges meta + content; exports `BlogPost`, `blogPosts`, `getPostBySlug`.
- `scripts/prerender.mjs` reads `blog-meta.json` directly (Node, can't import TS); also builds OG cards, sitemap, llms-full.txt, rss.xml from it.
- Build chain: `node scripts/generate-changelog.mjs && tsc -b && vite build && vite build --ssr … && node scripts/prerender.mjs && node scripts/indexnow.mjs`.
- No `dotenv` dependency; `@supabase/supabase-js` IS a dependency.

---

### Task 1: Migration — blog_posts table

**Files:** Create `supabase/migrations/20260613020000_blog_posts.sql`

- [ ] **Step 1: Write the migration**

```sql
-- ============================================================
-- Admin panel Phase 3: blog_posts table. Source of truth for the
-- blog; synced to static files at build time by scripts/sync-blog.mjs.
-- ============================================================

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  excerpt text not null default '',
  content text not null default '',
  date date not null default current_date,
  date_modified date,
  cover_youtube text,
  cover_image text,
  og_image text,
  tldr text,
  how_to jsonb,
  item_list jsonb,
  status text not null default 'draft' check (status in ('draft','published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.blog_posts enable row level security;

-- Anyone may read published posts (anon + authenticated).
drop policy if exists "blog_posts_select_published" on public.blog_posts;
create policy "blog_posts_select_published" on public.blog_posts
  for select to anon, authenticated using (status = 'published');

-- Admins may read everything (drafts included).
drop policy if exists "blog_posts_select_admin" on public.blog_posts;
create policy "blog_posts_select_admin" on public.blog_posts
  for select to authenticated using (public.is_admin());

-- Admins may write.
drop policy if exists "blog_posts_admin_insert" on public.blog_posts;
create policy "blog_posts_admin_insert" on public.blog_posts
  for insert to authenticated with check (public.is_admin());

drop policy if exists "blog_posts_admin_update" on public.blog_posts;
create policy "blog_posts_admin_update" on public.blog_posts
  for update to authenticated using (public.is_admin());

drop policy if exists "blog_posts_admin_delete" on public.blog_posts;
create policy "blog_posts_admin_delete" on public.blog_posts
  for delete to authenticated using (public.is_admin());
```

- [ ] **Step 2: Apply** via Supabase MCP `apply_migration` (name `blog_posts`, project `ofssvvittiiysoibojts`). Expected: success.

- [ ] **Step 3: Verify RLS (rolled-back impersonation)**

```sql
do $$
begin
  begin
    perform set_config('role','authenticated',true);
    perform set_config('request.jwt.claims','{"sub":"4b203813-caab-4412-8c2e-e8012fd28c37","role":"authenticated"}',true);
    insert into public.blog_posts (slug,title) values ('__t','t');
    raise exception 'SECURITY FAIL: non-admin insert succeeded';
  exception when insufficient_privilege then raise notice 'OK: non-admin blocked';
  end;
  reset role;
end $$;
```
Expected: notice OK, no SECURITY FAIL.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260613020000_blog_posts.sql
git commit -m "feat(db): blog_posts table with public-read/admin-write RLS"
```

---

### Task 2: Seed existing posts into Supabase

**Files:** Create `scripts/seed-blog.mjs`

This bootstraps the table from the current files so the build-time sync (Task 4) has data and never wipes the blog. Idempotent (upsert on slug).

- [ ] **Step 1: Write the seed script**

```js
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
```

- [ ] **Step 2: Run it**

Run: `node scripts/seed-blog.mjs`
Expected: `Seeded 6 posts.` (If it prints a missing-key error, the executor will seed via the Supabase MCP `execute_sql` superuser path instead, reading each file's content — same end state.)

- [ ] **Step 3: Verify** via MCP `execute_sql`: `select count(*) as n, count(*) filter (where status='published') as pub from public.blog_posts;` → expect `n=6, pub=6`.

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-blog.mjs
git commit -m "chore(blog): one-time seed script for existing posts"
```

---

### Task 3: `blogPosts.ts` → dynamic content via import.meta.glob

**Files:** Modify `src/data/blogPosts.ts`

So any markdown file the sync writes is bundled without per-slug edits.

- [ ] **Step 1: Replace the static imports**

Replace the top of `src/data/blogPosts.ts` (the 6 `?raw` imports and `contentBySlug`) with `import.meta.glob`, keeping the `BlogPost` interface and exports identical:

```ts
import blogMeta from './blog-meta.json'

export interface BlogPost {
  slug: string
  title: string
  date: string
  excerpt: string
  coverYoutube?: string
  coverImage?: string
  ogImage?: string
  dateModified?: string
  tldr?: string
  howTo?: { name: string; steps: { name: string; text: string }[] }
  itemList?: string[]
  content: string
}

// Markdown bodies are loaded eagerly as raw strings. Vite turns the glob into
// static imports at build time, so sync-blog.mjs can add/remove <slug>.md files
// and they are bundled automatically — no per-post code change.
const modules = import.meta.glob('../content/blog/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

const contentBySlug: Record<string, string> = {}
for (const [path, raw] of Object.entries(modules)) {
  const slug = path.split('/').pop()!.replace(/\.md$/, '')
  contentBySlug[slug] = raw
}

export const blogPosts: BlogPost[] = blogMeta.map((meta) => ({
  ...meta,
  content: contentBySlug[meta.slug] ?? '',
}))

export function getPostBySlug(slug: string): BlogPost | undefined {
  return blogPosts.find((p) => p.slug === slug)
}
```

- [ ] **Step 2: Typecheck + test the existing build still renders posts**

Run: `npx tsc -b`
Expected: clean.
Run: `npm run build 2>&1 | tail -5`
Expected: "Pre-rendered 42 routes." (same as before — content still bundled from the existing files).

- [ ] **Step 3: Commit**

```bash
git add src/data/blogPosts.ts
git commit -m "refactor(blog): load post markdown via import.meta.glob"
```

---

### Task 4: Build-time sync from Supabase

**Files:** Create `scripts/sync-blog.mjs`; modify `package.json` (build script); modify `.gitignore` is NOT needed (synced files are committed-source that get overwritten — they remain tracked).

- [ ] **Step 1: Write the sync script**

```js
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

// blog-meta.json entry — omit null/empty optional fields to match hand-authored shape.
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
```

- [ ] **Step 2: Wire into the build chain**

In `package.json`, change the `build` script to run sync first:

```json
    "build": "node scripts/sync-blog.mjs && node scripts/generate-changelog.mjs && tsc -b && vite build && vite build --ssr src/entry-ssr.tsx --outDir dist-ssr && node scripts/prerender.mjs && node scripts/indexnow.mjs",
```

- [ ] **Step 3: Run a full build and confirm it syncs from Supabase**

Run: `npm run build 2>&1 | grep -E "sync-blog|Pre-rendered"`
Expected: `sync-blog: wrote 6 published posts.` and `Pre-rendered 42 routes.`
Then: `git status --short src/data/blog-meta.json src/content/blog/` — files may show as modified if Supabase round-trips reformatted them; that's fine (content identical). Verify `git diff --stat` shows no surprising content loss.

- [ ] **Step 4: Commit**

```bash
git add scripts/sync-blog.mjs package.json src/data/blog-meta.json src/content/blog
git commit -m "feat(blog): build-time sync of published posts from Supabase"
```

---

### Task 5: Runtime refetch (instant visibility)

**Files:** Modify `src/pages/BlogPage.tsx`, `src/pages/BlogPostPage.tsx`; create `src/lib/blog.ts` (shared runtime fetch + row→BlogPost mapping).

- [ ] **Step 1: Create `src/lib/blog.ts`**

```ts
import { supabase } from './supabase'
import type { BlogPost } from '../data/blogPosts'

interface BlogRow {
  slug: string
  title: string
  excerpt: string | null
  content: string | null
  date: string
  date_modified: string | null
  cover_youtube: string | null
  cover_image: string | null
  og_image: string | null
  tldr: string | null
  how_to: BlogPost['howTo'] | null
  item_list: string[] | null
}

function rowToPost(r: BlogRow): BlogPost {
  return {
    slug: r.slug,
    title: r.title,
    date: r.date,
    excerpt: r.excerpt ?? '',
    content: r.content ?? '',
    dateModified: r.date_modified ?? undefined,
    coverYoutube: r.cover_youtube ?? undefined,
    coverImage: r.cover_image ?? undefined,
    ogImage: r.og_image ?? undefined,
    tldr: r.tldr ?? undefined,
    howTo: r.how_to ?? undefined,
    itemList: r.item_list ?? undefined,
  }
}

/** Published posts, newest first. Returns null on error so callers keep bundled data. */
export async function fetchPublishedPosts(): Promise<BlogPost[] | null> {
  const { data, error } = await supabase
    .from('blog_posts')
    .select('slug,title,excerpt,content,date,date_modified,cover_youtube,cover_image,og_image,tldr,how_to,item_list')
    .eq('status', 'published')
    .order('date', { ascending: false })
  if (error || !data) return null
  return (data as BlogRow[]).map(rowToPost)
}
```

- [ ] **Step 2: BlogPage — bundled first, then refetch**

In `src/pages/BlogPage.tsx`, add imports and replace the static `blogPosts` use with state seeded from bundled data:

```tsx
import { useState, useEffect } from 'react'
import { blogPosts } from '../data/blogPosts'
import { fetchPublishedPosts } from '../lib/blog'
```

Inside the component, before `const [featured, ...rest]`:

```tsx
  const [posts, setPosts] = useState(blogPosts)
  useEffect(() => {
    fetchPublishedPosts().then((p) => { if (p && p.length) setPosts(p) })
  }, [])
```

Change `const [featured, ...rest] = blogPosts` to `const [featured, ...rest] = posts`.

- [ ] **Step 3: BlogPostPage — bundled first, then refetch by slug**

In `src/pages/BlogPostPage.tsx`, replace the synchronous `const post = …` with state that starts from bundled data and refetches:

Add to imports:
```tsx
import { useState, useEffect } from 'react'
import { getPostBySlug, type BlogPost } from '../data/blogPosts'
import { fetchPublishedPosts } from '../lib/blog'
```
(Remove the old `import { getPostBySlug } from '../data/blogPosts'` line.)

Replace `const post = slug ? getPostBySlug(slug) : undefined` with:

```tsx
  const [post, setPost] = useState<BlogPost | undefined>(slug ? getPostBySlug(slug) : undefined)
  const [resolving, setResolving] = useState(!post)

  useEffect(() => {
    let cancelled = false
    if (!slug) return
    fetchPublishedPosts().then((all) => {
      if (cancelled || !all) { setResolving(false); return }
      const fresh = all.find((p) => p.slug === slug)
      if (fresh) setPost(fresh)
      setResolving(false)
    })
    return () => { cancelled = true }
  }, [slug])
```

Change the not-found guard so a post published since the last build (not in the bundle) isn't bounced before the fetch resolves. Replace `if (!post) return <Navigate to="/blog" replace />` with:

```tsx
  if (!post) {
    if (resolving) return <div className={styles.page} />
    return <Navigate to="/blog" replace />
  }
```

- [ ] **Step 4: Typecheck, lint, build**

Run: `npx tsc -b && npm run lint`
Expected: clean (pre-existing warnings only).

- [ ] **Step 5: Commit**

```bash
git add src/lib/blog.ts src/pages/BlogPage.tsx src/pages/BlogPostPage.tsx
git commit -m "feat(blog): runtime refetch of published posts for instant visibility"
```

---

### Task 6: `trigger-deploy` action on the admin API (TDD)

**Files:** Modify `api/_shared.ts` (+ test `src/lib/__tests__/admin-shared.test.ts`), `api/admin.ts` (+ test `src/lib/__tests__/admin-api.test.ts`), `vite.config.ts`, `.env.example`.

- [ ] **Step 1: Add a failing test for the helper**

Append to `src/lib/__tests__/admin-shared.test.ts` inside the existing `describe('admin server helpers', …)`:

```ts
  it('triggerDeploy posts to the configured hook and throws without it', async () => {
    const shared = await import('../../../api/_shared')

    delete process.env.VERCEL_DEPLOY_HOOK_URL
    await expect(shared.triggerDeploy()).rejects.toThrow()

    process.env.VERCEL_DEPLOY_HOOK_URL = 'https://api.vercel.com/v1/integrations/deploy/abc'
    fetchMock.mockResolvedValueOnce(jsonResponse({ job: { id: 'j1' } }))
    await shared.triggerDeploy()
    expect(String(fetchMock.mock.calls.at(-1)[0])).toBe('https://api.vercel.com/v1/integrations/deploy/abc')
    expect(fetchMock.mock.calls.at(-1)[1].method).toBe('POST')
  })
```

- [ ] **Step 2: Run → fails** (`triggerDeploy` not exported).
Run: `npx vitest run src/lib/__tests__/admin-shared.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `triggerDeploy`** — append to the admin section of `api/_shared.ts`:

```ts
/** Fire the Vercel deploy hook to regenerate the prerendered site. */
export function hasDeployHook(): boolean {
  return Boolean(process.env.VERCEL_DEPLOY_HOOK_URL)
}

export async function triggerDeploy(): Promise<void> {
  const hook = process.env.VERCEL_DEPLOY_HOOK_URL
  if (!hook) throw new Error('Deploy hook not configured')
  const res = await fetch(hook, { method: 'POST' })
  if (!res.ok) throw new Error(`Deploy hook error ${res.status}`)
}
```

- [ ] **Step 4: Run → passes.** `npx vitest run src/lib/__tests__/admin-shared.test.ts`

- [ ] **Step 5: Add a failing test for the action** in `src/lib/__tests__/admin-api.test.ts`. The existing `stubFetch` returns 404 for unknown URLs; extend a case:

```ts
  it('trigger-deploy fires the hook for an admin', async () => {
    process.env.VERCEL_DEPLOY_HOOK_URL = 'https://api.vercel.com/v1/integrations/deploy/abc'
    fetchMock.mockImplementation(async (url) => {
      const u = String(url)
      if (u.includes('/auth/v1/user')) return jsonResponse({ id: ADMIN_ID, email: 'a@test.dev' })
      if (u.includes(`/rest/v1/profiles?id=eq.${ADMIN_ID}`)) return jsonResponse([{ is_admin: true }])
      if (u.startsWith('https://api.vercel.com/')) return jsonResponse({ job: { id: 'j' } })
      return jsonResponse({ error: 'unexpected' }, false, 404)
    })
    const { default: handler } = await import('../../../api/admin')
    const res = makeRes()
    await handler(makeReq({ action: 'trigger-deploy' }), res)
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ ok: true })
  })
```

- [ ] **Step 6: Run → fails** (action rejected as invalid / userId required).
Run: `npx vitest run src/lib/__tests__/admin-api.test.ts`
Expected: FAIL.

- [ ] **Step 7: Implement the action in `api/admin.ts`.** `trigger-deploy` takes no `userId`, so it must be handled before the user-action validation. Update imports and the handler body:

Change the import to add `triggerDeploy`:
```ts
import {
  verifyUser,
  rateLimit,
  isAdminUser,
  isValidUserId,
  hasServiceRoleKey,
  adminSetUserSuspended,
  adminDeleteUser,
  triggerDeploy,
} from './_shared.js'
```

Immediately after the admin re-verification block (`if (!(await isAdminUser(user.id))) { … }`), and **before** `const { action, userId } = parseBody(req.body)`'s validation, insert a branch that handles the no-target action:

```ts
  const body = parseBody(req.body)
  if (body.action === 'trigger-deploy') {
    try {
      await triggerDeploy()
      res.status(200).json({ ok: true })
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Deploy failed' })
    }
    return
  }

  const { action, userId } = body
```

(Delete the now-duplicate `const { action, userId } = parseBody(req.body)` line that followed.)

- [ ] **Step 8: Run → passes.** Run both admin test files:
`npx vitest run src/lib/__tests__/admin-api.test.ts src/lib/__tests__/admin-shared.test.ts`
Expected: PASS.

- [ ] **Step 9: Mirror in the vite dev shim** (`vite.config.ts`). In the `/api/admin` middleware, after the `isAdminUser` 403 check and after reading the body, add the trigger-deploy branch before the user-action validation. Add `triggerDeploy` to the `./api/_shared` import. Insert:

```ts
              if (body.action === 'trigger-deploy') {
                await triggerDeploy()
                return sendJson(res, 200, { ok: true })
              }
```

(Place it right after `const body = await readJsonBody<{ action?: string; userId?: string }>(req)` and before the `allowed`/`userId` validation. The surrounding try/catch already returns 500 on throw.)

- [ ] **Step 10: Document the env var** in `.env.example`, after the `SUPABASE_SERVICE_ROLE_KEY` block:

```bash
# Server-only. Vercel deploy hook fired when an admin publishes a blog post so
# the prerendered site regenerates. Vercel -> Project Settings -> Git -> Deploy Hooks.
VERCEL_DEPLOY_HOOK_URL=
```

- [ ] **Step 11: Typecheck, build, commit**

Run: `npx tsc -b`
```bash
git add api/_shared.ts api/admin.ts vite.config.ts .env.example src/lib/__tests__/admin-shared.test.ts src/lib/__tests__/admin-api.test.ts
git commit -m "feat(api): trigger-deploy admin action for blog publishing"
```

---

### Task 7: Admin blog client + editor page

**Files:** Create `src/lib/blog-admin.ts`, `src/pages/admin/AdminBlogPage.tsx`, `src/pages/admin/AdminBlogPage.module.css`; modify `src/pages/admin/AdminLayout.tsx`, `src/App.tsx`.

- [ ] **Step 1: Create `src/lib/blog-admin.ts`**

```ts
import { supabase } from './supabase'
import { adminUserAction } from './admin'

export interface AdminBlogRow {
  id: string
  slug: string
  title: string
  excerpt: string
  content: string
  date: string
  date_modified: string | null
  cover_youtube: string | null
  cover_image: string | null
  og_image: string | null
  tldr: string | null
  status: 'draft' | 'published'
  published_at: string | null
  updated_at: string
}

export type BlogDraft = Pick<
  AdminBlogRow,
  'slug' | 'title' | 'excerpt' | 'content' | 'date' | 'date_modified'
  | 'cover_youtube' | 'cover_image' | 'og_image' | 'tldr' | 'status'
>

export async function adminListPosts(): Promise<AdminBlogRow[]> {
  const { data, error } = await supabase
    .from('blog_posts')
    .select('id,slug,title,excerpt,content,date,date_modified,cover_youtube,cover_image,og_image,tldr,status,published_at,updated_at')
    .order('date', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as AdminBlogRow[]
}

/** Insert or update by slug. Sets published_at the first time a post is published. */
export async function adminSavePost(draft: BlogDraft, id?: string): Promise<void> {
  const row: Record<string, unknown> = {
    ...draft,
    date_modified: draft.date_modified || null,
    cover_youtube: draft.cover_youtube || null,
    cover_image: draft.cover_image || null,
    og_image: draft.og_image || null,
    tldr: draft.tldr || null,
    updated_at: new Date().toISOString(),
  }
  if (draft.status === 'published') {
    row.published_at = new Date().toISOString()
  }
  const query = id
    ? supabase.from('blog_posts').update(row).eq('id', id)
    : supabase.from('blog_posts').insert(row)
  const { error } = await query
  if (error) throw new Error(error.message)
}

export async function adminDeletePost(id: string): Promise<void> {
  const { error } = await supabase.from('blog_posts').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/** Fire the Vercel deploy hook so the prerendered/SEO build regenerates. */
export async function adminTriggerDeploy(): Promise<void> {
  return adminUserAction('trigger-deploy' as never, '' as never)
}
```

Note: `adminUserAction` in `src/lib/admin.ts` posts `{ action, userId }`; for `trigger-deploy` the server ignores `userId`. To avoid the `userId` validation path, **add a dedicated wrapper instead** — replace the `adminTriggerDeploy` above with a direct fetch:

```ts
export async function adminTriggerDeploy(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not signed in')
  const res = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ action: 'trigger-deploy' }),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error || 'Deploy failed')
  }
}
```

(Remove the `import { adminUserAction }` line — not used.)

- [ ] **Step 2: Create `src/pages/admin/AdminBlogPage.tsx`**

```tsx
import { useState, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  adminListPosts,
  adminSavePost,
  adminDeletePost,
  adminTriggerDeploy,
  type AdminBlogRow,
  type BlogDraft,
} from '../../lib/blog-admin'
import styles from './AdminBlogPage.module.css'

type Status = { kind: 'ok' | 'error'; text: string } | null

const EMPTY: BlogDraft = {
  slug: '', title: '', excerpt: '', content: '', date: new Date().toISOString().slice(0, 10),
  date_modified: null, cover_youtube: null, cover_image: null, og_image: null, tldr: null,
  status: 'draft',
}

function rowToDraft(r: AdminBlogRow): BlogDraft {
  return {
    slug: r.slug, title: r.title, excerpt: r.excerpt, content: r.content, date: r.date,
    date_modified: r.date_modified, cover_youtube: r.cover_youtube, cover_image: r.cover_image,
    og_image: r.og_image, tldr: r.tldr, status: r.status,
  }
}

export default function AdminBlogPage() {
  const [posts, setPosts] = useState<AdminBlogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null) // null = list, '' = new
  const [draft, setDraft] = useState<BlogDraft>(EMPTY)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<Status>(null)

  const load = useCallback(async () => {
    try { setPosts(await adminListPosts()) }
    catch (err) { setStatus({ kind: 'error', text: err instanceof Error ? err.message : 'Load failed' }) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  const editing = editingId !== null
  const set = <K extends keyof BlogDraft>(k: K, v: BlogDraft[K]) => setDraft((d) => ({ ...d, [k]: v }))

  const openNew = () => { setDraft({ ...EMPTY, date: new Date().toISOString().slice(0, 10) }); setEditingId(''); setStatus(null) }
  const openEdit = (r: AdminBlogRow) => { setDraft(rowToDraft(r)); setEditingId(r.id); setStatus(null) }
  const closeEditor = () => { setEditingId(null); setStatus(null) }

  const save = async (publish: boolean) => {
    if (!draft.slug.trim() || !draft.title.trim()) {
      setStatus({ kind: 'error', text: 'Slug and title are required.' })
      return
    }
    setBusy(true)
    setStatus(null)
    try {
      const toSave: BlogDraft = { ...draft, status: publish ? 'published' : draft.status }
      await adminSavePost(toSave, editingId || undefined)
      if (publish) {
        try { await adminTriggerDeploy() } catch { /* post is live at runtime regardless */ }
      }
      await load()
      setStatus({ kind: 'ok', text: publish ? 'Published. Rebuild triggered for SEO.' : 'Saved.' })
      setEditingId(editingId === '' ? null : editingId)
    } catch (err) {
      setStatus({ kind: 'error', text: err instanceof Error ? err.message : 'Save failed' })
    } finally {
      setBusy(false)
    }
  }

  const remove = async (r: AdminBlogRow) => {
    if (!window.confirm(`Delete "${r.title}"? This cannot be undone.`)) return
    setBusy(true)
    try { await adminDeletePost(r.id); await load() }
    catch (err) { setStatus({ kind: 'error', text: err instanceof Error ? err.message : 'Delete failed' }) }
    finally { setBusy(false) }
  }

  const redeploy = async () => {
    setBusy(true)
    try { await adminTriggerDeploy(); setStatus({ kind: 'ok', text: 'Rebuild triggered.' }) }
    catch (err) { setStatus({ kind: 'error', text: err instanceof Error ? err.message : 'Deploy failed' }) }
    finally { setBusy(false) }
  }

  if (loading) return <p className={styles.muted}>Loading posts…</p>

  if (editing) {
    return (
      <div className={styles.page}>
        <div className={styles.editorHeader}>
          <button className={styles.btn} type="button" onClick={closeEditor}>← Back</button>
          <div className={styles.editorActions}>
            <button className={styles.btn} type="button" disabled={busy} onClick={() => save(false)}>Save draft</button>
            <button className={`${styles.btn} ${styles.btnPrimary}`} type="button" disabled={busy} onClick={() => save(true)}>
              Publish
            </button>
          </div>
        </div>
        {status && <div className={status.kind === 'ok' ? styles.ok : styles.error} role="status">{status.text}</div>}

        <div className={styles.fields}>
          <label className={styles.field}><span>Title</span>
            <input className={styles.input} value={draft.title} onChange={(e) => set('title', e.target.value)} /></label>
          <label className={styles.field}><span>Slug</span>
            <input className={styles.input} value={draft.slug} onChange={(e) => set('slug', e.target.value)} placeholder="my-post-slug" /></label>
          <label className={styles.field}><span>Publish date</span>
            <input className={styles.input} type="date" value={draft.date} onChange={(e) => set('date', e.target.value)} /></label>
          <label className={styles.field}><span>Excerpt</span>
            <textarea className={styles.textarea} rows={2} value={draft.excerpt} onChange={(e) => set('excerpt', e.target.value)} /></label>
          <label className={styles.field}><span>TL;DR (optional)</span>
            <textarea className={styles.textarea} rows={2} value={draft.tldr ?? ''} onChange={(e) => set('tldr', e.target.value || null)} /></label>
          <div className={styles.fieldRow}>
            <label className={styles.field}><span>Cover image path (optional)</span>
              <input className={styles.input} value={draft.cover_image ?? ''} onChange={(e) => set('cover_image', e.target.value || null)} placeholder="/assets/blog_x.png" /></label>
            <label className={styles.field}><span>OG image URL (optional)</span>
              <input className={styles.input} value={draft.og_image ?? ''} onChange={(e) => set('og_image', e.target.value || null)} /></label>
          </div>
          <div className={styles.fieldRow}>
            <label className={styles.field}><span>YouTube ID (optional)</span>
              <input className={styles.input} value={draft.cover_youtube ?? ''} onChange={(e) => set('cover_youtube', e.target.value || null)} /></label>
            <label className={styles.field}><span>Last-modified date (optional)</span>
              <input className={styles.input} type="date" value={draft.date_modified ?? ''} onChange={(e) => set('date_modified', e.target.value || null)} /></label>
          </div>
        </div>

        <div className={styles.split}>
          <textarea
            className={styles.markdownInput}
            value={draft.content}
            onChange={(e) => set('content', e.target.value)}
            placeholder="Write the post in Markdown…"
            spellCheck
          />
          <article className={styles.preview}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{draft.content || '_Preview_'}</ReactMarkdown>
          </article>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.heading}>Blog</h1>
        <div className={styles.editorActions}>
          <button className={styles.btn} type="button" disabled={busy} onClick={redeploy}>Trigger rebuild</button>
          <button className={`${styles.btn} ${styles.btnPrimary}`} type="button" onClick={openNew}>New post</button>
        </div>
      </header>
      {status && <div className={status.kind === 'ok' ? styles.ok : styles.error} role="status">{status.text}</div>}

      <div className={styles.list}>
        {posts.length === 0 && <p className={styles.muted}>No posts yet.</p>}
        {posts.map((p) => (
          <article key={p.id} className={styles.row}>
            <div className={styles.rowMain}>
              <div className={styles.rowTitle}>
                {p.title}
                <span className={`${styles.badge} ${p.status === 'published' ? styles.badgePub : styles.badgeDraft}`}>{p.status}</span>
              </div>
              <p className={styles.rowMeta}>/{p.slug} · {p.date}</p>
            </div>
            <div className={styles.rowActions}>
              <button className={styles.btn} type="button" onClick={() => openEdit(p)}>Edit</button>
              <button className={`${styles.btn} ${styles.btnDanger}`} type="button" disabled={busy} onClick={() => remove(p)}>Delete</button>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create `src/pages/admin/AdminBlogPage.module.css`**

```css
.page { max-width: 1100px; display: flex; flex-direction: column; gap: 1rem; }
.header, .editorHeader { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
.heading { font-size: 1.5rem; margin: 0; }
.muted { opacity: 0.6; }
.editorActions { display: flex; gap: 0.5rem; }
.ok, .error { padding: 0.6rem 0.9rem; border-radius: 8px; }
.ok { background: color-mix(in srgb, #34c98a 15%, transparent); }
.error { background: color-mix(in srgb, #e0524f 15%, transparent); }

.list { display: flex; flex-direction: column; gap: 0.6rem; }
.row { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0.85rem 1.1rem; border: 1px solid color-mix(in srgb, var(--color-text) 12%, transparent); border-radius: 12px; flex-wrap: wrap; }
.rowMain { min-width: 0; }
.rowTitle { display: flex; align-items: center; gap: 0.5rem; font-weight: 600; flex-wrap: wrap; }
.rowMeta { margin: 0.3rem 0 0; font-size: 0.82rem; opacity: 0.55; }
.rowActions { display: flex; gap: 0.4rem; }

.badge { padding: 0.1rem 0.5rem; border-radius: 999px; font-size: 0.72rem; font-weight: 600; }
.badgePub { background: color-mix(in srgb, #34c98a 22%, transparent); color: #34c98a; }
.badgeDraft { background: color-mix(in srgb, var(--color-text) 12%, transparent); }

.fields { display: flex; flex-direction: column; gap: 0.75rem; }
.fieldRow { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
.field { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.85rem; }
.field > span { opacity: 0.7; }
.input, .textarea { padding: 0.5rem 0.7rem; border-radius: 8px; border: 1px solid color-mix(in srgb, var(--color-text) 18%, transparent); background: transparent; color: var(--color-text); font-family: inherit; }
.textarea { resize: vertical; }

.split { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; min-height: 420px; }
.markdownInput { width: 100%; padding: 0.85rem; border-radius: 10px; border: 1px solid color-mix(in srgb, var(--color-text) 18%, transparent); background: transparent; color: var(--color-text); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.85rem; line-height: 1.6; resize: vertical; }
.preview { padding: 0.85rem 1.1rem; border-radius: 10px; border: 1px solid color-mix(in srgb, var(--color-text) 12%, transparent); overflow-y: auto; }
.preview h1, .preview h2, .preview h3 { line-height: 1.25; }
.preview pre { background: color-mix(in srgb, var(--color-text) 8%, transparent); padding: 0.75rem; border-radius: 8px; overflow-x: auto; }
.preview code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.85em; }

.btn { padding: 0.4rem 0.85rem; border-radius: 7px; border: 1px solid color-mix(in srgb, var(--color-text) 18%, transparent); background: transparent; color: var(--color-text); cursor: pointer; font-size: 0.88rem; }
.btn:hover:not(:disabled) { background: color-mix(in srgb, var(--color-text) 8%, transparent); }
.btn:disabled { opacity: 0.5; cursor: default; }
.btnPrimary { background: color-mix(in srgb, var(--color-accent) 18%, transparent); color: var(--color-accent); border-color: color-mix(in srgb, var(--color-accent) 40%, transparent); }
.btnDanger { border-color: color-mix(in srgb, #e0524f 50%, transparent); color: #e0524f; }

@media (max-width: 760px) {
  .split { grid-template-columns: 1fr; }
  .fieldRow { grid-template-columns: 1fr; }
}
```

- [ ] **Step 4: Register nav + route**

`src/pages/admin/AdminLayout.tsx` — add to `NAV_ITEMS`:
```tsx
  { to: '/admin/blog', label: 'Blog', end: false },
```

`src/App.tsx` — lazy import after `AdminConfigPage`:
```tsx
const AdminBlogPage = lazy(() => import('./pages/admin/AdminBlogPage'))
```
And the route in the `/admin` group:
```tsx
              <Route path="blog" element={<AdminBlogPage />} />
```

- [ ] **Step 5: Verify manually**

`npm run dev` as admin → `/admin/blog`: list shows the 6 seeded posts. Create a new draft, write markdown, see live preview. Save draft (status draft, not on public blog). Publish → appears on `/blog` after the runtime refetch without rebuild; "rebuild triggered" status shows (deploy hook fires if `VERCEL_DEPLOY_HOOK_URL` set, otherwise the publish still succeeds and the deploy error is swallowed). Edit an existing post, publish, confirm changes show on `/blog/<slug>`.

- [ ] **Step 6: Lint, typecheck, commit**

Run: `npx tsc -b && npm run lint`
```bash
git add src/lib/blog-admin.ts src/pages/admin/AdminBlogPage.tsx src/pages/admin/AdminBlogPage.module.css src/pages/admin/AdminLayout.tsx src/App.tsx
git commit -m "feat(admin): blog CMS page (markdown editor, draft/publish, redeploy)"
```

---

### Task 8: Full verification + merge

- [ ] **Step 1:** `npm run lint && npm run test && npm run build` — all pass; build prints `sync-blog: wrote N published posts.` and `Pre-rendered 42 routes.` (42 + any newly published test posts; delete test posts first if you don't want them live).

- [ ] **Step 2: RLS checks via MCP** (rolled back): anon select returns only published; non-admin insert/update/delete on `blog_posts` blocked; admin sees drafts.

- [ ] **Step 3: Merge + push** (per the user's standing choice):
```bash
git checkout master
git merge feature/admin-panel-phase-3
npm run test
git branch -d feature/admin-panel-phase-3
git push
```

- [ ] **Step 4: Operational note to surface to the user:** set `VERCEL_DEPLOY_HOOK_URL` (Vercel → Project Settings → Git → Deploy Hooks) in the Vercel env, and add `node scripts/sync-blog.mjs` runs fine in the Vercel build because `SUPABASE_URL`/`SUPABASE_ANON_KEY` are already set there. Without the deploy hook, publishing still works at runtime; only the prerender/SEO refresh must be triggered manually by a redeploy.

---

## Self-review notes (applied)

- **Spec coverage:** blog_posts table + seed (T1, T2); admin editor with markdown live preview + draft/publish (T7); runtime fetch for instant visibility (T5); prerender stays in sync via build-time sync instead of in-renderer Supabase fetch (T3, T4) — deviation documented in Architecture; deploy hook via `trigger-deploy` admin action (T6).
- **Hydration safety:** runtime components seed state from bundled data (identical to SSR output) and only swap to Supabase data inside `useEffect`, so first client render matches SSR. New, not-yet-built posts render as a normal client-only SPA route.
- **Build safety:** `sync-blog.mjs` exits 0 without writing when Supabase env is absent, the fetch fails, or zero posts return — a build never wipes the blog. Seed (T2) runs first so the table is populated before the first sync.
- **Type consistency:** `BlogPost` (data/blogPosts.ts) reused by `src/lib/blog.ts`; `AdminBlogRow`/`BlogDraft` defined in `blog-admin.ts` and consumed only in `AdminBlogPage`. `triggerDeploy`/`hasDeployHook` defined in `_shared.ts` (T6) and consumed in `api/admin.ts` + vite shim. `trigger-deploy` action is handled before the `userId` validation in both the function and the shim.
