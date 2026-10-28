# Admin Panel Phase 4 (Template Manager) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make Supabase `templates` the source of truth for the gallery, editable from `/admin/templates` with a per-file code editor and a live `buildPreview` preview; published templates appear on `/templates` at runtime with the bundled `TEMPLATES` as fallback. Per Phase 4 of `docs/superpowers/specs/2026-06-12-admin-panel-design.md`.

**Architecture:** Unlike the blog, `/templates` is an auth-gated, non-prerendered route, so there is **no SSR/prerender/sync/deploy-hook work** — much simpler than Phase 3. A `templates` table (RLS: authenticated reads published, admin reads all + writes) holds each template's metadata + `files` jsonb (`AgentCodeFile[]`). `TemplatesPage` renders bundled `TEMPLATES` first (instant) then swaps in published DB rows if any exist (mirrors the `default_models` "DB overrides bundled fallback" pattern from Phase 2). The admin editor reuses the existing `buildPreview` pipeline (esbuild-wasm) for live preview, the same call `TemplatesPage` already makes.

**Tech Stack:** React 19 + TS, Supabase (RLS, jsonb), `buildPreview` (esbuild-wasm) for preview, CSS Modules, Vitest, Node 24 (type-stripping) for the seed script.

**Conventions:** no `Co-Authored-By`; CSS design tokens; admin pages in `src/pages/admin/` reusing the button/pill patterns from `AdminBlogPage.module.css`.

**Prerequisites on master (Phases 1–3):** `public.is_admin()`, `/admin` route group + `AdminLayout` `NAV_ITEMS`, admin RLS patterns, the blog CMS as a structural reference (`blog-admin.ts`, `AdminBlogPage.tsx`).

**Existing template facts (verified):**
- `src/lib/templates.ts` — exports `Template` (`{ id, name, description, category: 'Portfolio'|'SaaS'|'E-commerce'|'Restaurant'|'Blog', highlights: string[], accentColor: string, files: AgentCodeFile[] }`) and `TEMPLATES: Template[]` (6 templates). Only import is `import type { AgentCodeFile } from './agent'` (type-only — stripped by Node 24, so a seed script can import this file without loading `agent.ts`).
- `AgentCodeFile` shape used in files: `{ path: string; language: string; code: string }`.
- `buildPreview(files: VirtualFile[])` where `VirtualFile = { path, content }`. `TemplatesPage` calls `buildPreview(template.files.map(f => ({ path: f.path, content: f.code })))`.
- `TemplatesPage` (`src/pages/TemplatesPage.tsx`) maps over `TEMPLATES`, builds previews into `htmlMap` keyed by `template.id`, and on "Use" navigates to `/projects/:id` with `state.templateFiles = selected.files`.
- Local `.env` has only `VITE_`-prefixed Supabase vars (no service role) — seed bootstrap uses the temp-RPC trick from Phase 3.

---

### Task 1: Migration — templates table

**Files:** Create `supabase/migrations/20260613030000_templates.sql`

- [ ] **Step 1: Write the migration**

```sql
-- ============================================================
-- Admin panel Phase 4: templates table. Source of truth for the
-- template gallery; bundled src/lib/templates.ts is the fallback.
-- ============================================================

create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  template_key text unique not null,
  name text not null,
  description text not null default '',
  category text not null default 'SaaS',
  accent_color text not null default '#2563eb',
  highlights jsonb not null default '[]'::jsonb,
  files jsonb not null default '[]'::jsonb,
  featured boolean not null default false,
  sort_order int not null default 0,
  status text not null default 'draft' check (status in ('draft','published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.templates enable row level security;

-- Signed-in users may read published templates (the gallery is auth-gated).
drop policy if exists "templates_select_published" on public.templates;
create policy "templates_select_published" on public.templates
  for select to authenticated using (status = 'published');

-- Admins read everything (drafts included).
drop policy if exists "templates_select_admin" on public.templates;
create policy "templates_select_admin" on public.templates
  for select to authenticated using (public.is_admin());

-- Admins write.
drop policy if exists "templates_admin_insert" on public.templates;
create policy "templates_admin_insert" on public.templates
  for insert to authenticated with check (public.is_admin());

drop policy if exists "templates_admin_update" on public.templates;
create policy "templates_admin_update" on public.templates
  for update to authenticated using (public.is_admin());

drop policy if exists "templates_admin_delete" on public.templates;
create policy "templates_admin_delete" on public.templates
  for delete to authenticated using (public.is_admin());
```

- [ ] **Step 2: Apply** via Supabase MCP `apply_migration` (name `templates`, project `ofssvvittiiysoibojts`). Expected: success.

- [ ] **Step 3: Verify RLS** (rolled-back impersonation): non-admin insert blocked.

```sql
do $$
begin
  begin
    perform set_config('role','authenticated',true);
    perform set_config('request.jwt.claims','{"sub":"4b203813-caab-4412-8c2e-e8012fd28c37","role":"authenticated"}',true);
    insert into public.templates (template_key,name) values ('__t','t');
    raise exception 'SECURITY FAIL: non-admin insert succeeded';
  exception when insufficient_privilege then raise notice 'OK: non-admin blocked';
  end;
  reset role;
end $$;
```
Expected: notice OK.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260613030000_templates.sql
git commit -m "feat(db): templates table with authenticated-read/admin-write RLS"
```

---

### Task 2: Seed the 6 existing templates

**Files:** Create `scripts/seed-templates.mjs`

The committed script is the service-role version (reusable). The one-time bootstrap (executor) uses a temporary `SECURITY DEFINER` RPC + the anon key, because the local `.env` has no service-role key (same trick as the Phase 3 blog seed).

- [ ] **Step 1: Write the committed seed script**

```js
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
```

- [ ] **Step 2: Bootstrap the data.** Run `node scripts/seed-templates.mjs`. If it errors on the missing service key (expected locally), seed via the temp-RPC path:
  - MCP: `create function public._seed_template(p jsonb) returns void language sql security definer set search_path=public as $$ insert into public.templates (template_key,name,description,category,accent_color,highlights,files,sort_order,status) values (p->>'template_key', p->>'name', coalesce(p->>'description',''), coalesce(p->>'category','SaaS'), coalesce(p->>'accent_color','#2563eb'), coalesce(p->'highlights','[]'::jsonb), coalesce(p->'files','[]'::jsonb), coalesce((p->>'sort_order')::int,0), 'published') on conflict (template_key) do update set name=excluded.name, description=excluded.description, category=excluded.category, accent_color=excluded.accent_color, highlights=excluded.highlights, files=excluded.files, sort_order=excluded.sort_order, status='published', updated_at=now(); $$; grant execute on function public._seed_template(jsonb) to anon;`
  - Throwaway `scripts/_seed_templates_once.mjs`: loads `.env`, `import()`s `templates.ts`, POSTs each row to `${VITE_SUPABASE_URL}/rest/v1/rpc/_seed_template` with `{ p: row }` and the anon key/Bearer.
  - Run it; expect `Seeded 6 templates.`
  - MCP: `drop function public._seed_template(jsonb);`
  - Delete the throwaway script.

- [ ] **Step 3: Verify** via MCP: `select count(*) n, count(*) filter (where status='published') pub, count(*) filter (where jsonb_array_length(files) > 0) with_files from public.templates;` → expect `n=6, pub=6, with_files=6`.

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-templates.mjs
git commit -m "chore(templates): one-time seed script for bundled templates"
```

---

### Task 3: Runtime fetch + TemplatesPage DB source

**Files:** Create `src/lib/templates-db.ts`; modify `src/pages/TemplatesPage.tsx`.

- [ ] **Step 1: Create `src/lib/templates-db.ts`**

```ts
import { supabase } from './supabase'
import type { Template } from './templates'
import type { AgentCodeFile } from './agent'

interface TemplateRow {
  id: string
  name: string
  description: string
  category: string
  accent_color: string
  highlights: string[] | null
  files: AgentCodeFile[] | null
}

function rowToTemplate(r: TemplateRow): Template {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    category: r.category as Template['category'],
    accentColor: r.accent_color,
    highlights: Array.isArray(r.highlights) ? r.highlights : [],
    files: Array.isArray(r.files) ? r.files : [],
  }
}

/** Published templates ordered for display. Null on error → caller keeps bundled. */
export async function fetchPublishedTemplates(): Promise<Template[] | null> {
  const { data, error } = await supabase
    .from('templates')
    .select('id,name,description,category,accent_color,highlights,files')
    .eq('status', 'published')
    .order('featured', { ascending: false })
    .order('sort_order', { ascending: true })
  if (error || !data) return null
  return (data as TemplateRow[]).map(rowToTemplate).filter((t) => t.files.length > 0)
}
```

- [ ] **Step 2: TemplatesPage — bundled first, then DB**

In `src/pages/TemplatesPage.tsx`:

Add the import:
```tsx
import { fetchPublishedTemplates } from '../lib/templates-db'
```

Replace the direct `TEMPLATES` usages with state. After the existing `useState` hooks, add:
```tsx
  const [templates, setTemplates] = useState<Template[]>(TEMPLATES)
```

Add a fetch effect (before the preview-building effect):
```tsx
  useEffect(() => {
    fetchPublishedTemplates().then((t) => { if (t && t.length) setTemplates(t) })
  }, [])
```

Change the preview-building effect to depend on `templates` and iterate it:
```tsx
  useEffect(() => {
    for (const template of templates) {
      buildPreview(template.files.map(f => ({ path: f.path, content: f.code }))).then(result => {
        if (!result.errors.length) {
          setHtmlMap(prev => ({ ...prev, [template.id]: result.html }))
        }
      })
    }
  }, [templates])
```

Change the gallery render `{TEMPLATES.map(template => {` to `{templates.map(template => {`.

(The `selected` template still comes from this same list, so `htmlMap[selected.id]` and `handleUseTemplate` keep working unchanged.)

- [ ] **Step 3: Typecheck, lint**

Run: `npx tsc -b && npm run lint`
Expected: clean (pre-existing warnings only).

- [ ] **Step 4: Commit**

```bash
git add src/lib/templates-db.ts src/pages/TemplatesPage.tsx
git commit -m "feat(templates): load gallery from Supabase with bundled fallback"
```

---

### Task 4: Admin template client + editor page

**Files:** Create `src/lib/templates-admin.ts`, `src/pages/admin/AdminTemplatesPage.tsx`, `src/pages/admin/AdminTemplatesPage.module.css`; modify `src/pages/admin/AdminLayout.tsx`, `src/App.tsx`.

- [ ] **Step 1: Create `src/lib/templates-admin.ts`**

```ts
import { supabase } from './supabase'
import type { AgentCodeFile } from './agent'

export interface AdminTemplateRow {
  id: string
  template_key: string
  name: string
  description: string
  category: string
  accent_color: string
  highlights: string[]
  files: AgentCodeFile[]
  featured: boolean
  sort_order: number
  status: 'draft' | 'published'
  updated_at: string
}

export type TemplateDraft = Pick<
  AdminTemplateRow,
  'template_key' | 'name' | 'description' | 'category' | 'accent_color'
  | 'highlights' | 'files' | 'featured' | 'sort_order' | 'status'
>

export async function adminListTemplates(): Promise<AdminTemplateRow[]> {
  const { data, error } = await supabase
    .from('templates')
    .select('id,template_key,name,description,category,accent_color,highlights,files,featured,sort_order,status,updated_at')
    .order('sort_order', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as AdminTemplateRow[]
}

export async function adminSaveTemplate(draft: TemplateDraft, id?: string): Promise<void> {
  const row = { ...draft, updated_at: new Date().toISOString() }
  const query = id
    ? supabase.from('templates').update(row).eq('id', id)
    : supabase.from('templates').insert(row)
  const { error } = await query
  if (error) throw new Error(error.message)
}

export async function adminDeleteTemplate(id: string): Promise<void> {
  const { error } = await supabase.from('templates').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
```

- [ ] **Step 2: Create `src/pages/admin/AdminTemplatesPage.tsx`**

```tsx
import { useState, useEffect, useCallback, useRef } from 'react'
import { buildPreview } from '../../lib/preview-bundle'
import type { AgentCodeFile } from '../../lib/agent'
import {
  adminListTemplates,
  adminSaveTemplate,
  adminDeleteTemplate,
  type AdminTemplateRow,
  type TemplateDraft,
} from '../../lib/templates-admin'
import styles from './AdminTemplatesPage.module.css'

type Status = { kind: 'ok' | 'error'; text: string } | null

const CATEGORIES = ['Portfolio', 'SaaS', 'E-commerce', 'Restaurant', 'Blog']

const EMPTY: TemplateDraft = {
  template_key: '', name: '', description: '', category: 'SaaS', accent_color: '#2563eb',
  highlights: [], files: [{ path: 'src/App.tsx', language: 'tsx', code: 'export default function App(){return <h1>Hello</h1>}' }],
  featured: false, sort_order: 0, status: 'draft',
}

function rowToDraft(r: AdminTemplateRow): TemplateDraft {
  return {
    template_key: r.template_key, name: r.name, description: r.description, category: r.category,
    accent_color: r.accent_color, highlights: r.highlights, files: r.files,
    featured: r.featured, sort_order: r.sort_order, status: r.status,
  }
}

export default function AdminTemplatesPage() {
  const [rows, setRows] = useState<AdminTemplateRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null) // null=list, ''=new
  const [draft, setDraft] = useState<TemplateDraft>(EMPTY)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<Status>(null)
  const [previewHtml, setPreviewHtml] = useState('')
  const [previewError, setPreviewError] = useState<string | null>(null)
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    try { setRows(await adminListTemplates()) }
    catch (err) { setStatus({ kind: 'error', text: err instanceof Error ? err.message : 'Load failed' }) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  const editing = editingId !== null
  const set = <K extends keyof TemplateDraft>(k: K, v: TemplateDraft[K]) => setDraft((d) => ({ ...d, [k]: v }))

  const setFile = (i: number, patch: Partial<AgentCodeFile>) =>
    setDraft((d) => ({ ...d, files: d.files.map((f, j) => (j === i ? { ...f, ...patch } : f)) }))
  const addFile = () => setDraft((d) => ({ ...d, files: [...d.files, { path: 'src/new.tsx', language: 'tsx', code: '' }] }))
  const removeFile = (i: number) => setDraft((d) => ({ ...d, files: d.files.filter((_, j) => j !== i) }))

  // Debounced live preview whenever the files change in the editor.
  useEffect(() => {
    if (!editing) return
    if (previewTimer.current) clearTimeout(previewTimer.current)
    previewTimer.current = setTimeout(() => {
      buildPreview(draft.files.map((f) => ({ path: f.path, content: f.code })))
        .then((r) => {
          if (r.errors.length) { setPreviewError(r.errors[0]); }
          else { setPreviewError(null); setPreviewHtml(r.html) }
        })
        .catch((err) => setPreviewError(err instanceof Error ? err.message : 'Preview failed'))
    }, 600)
    return () => { if (previewTimer.current) clearTimeout(previewTimer.current) }
  }, [editing, draft.files])

  const openNew = () => { setDraft(EMPTY); setEditingId(''); setStatus(null); setPreviewHtml(''); setPreviewError(null) }
  const openEdit = (r: AdminTemplateRow) => { setDraft(rowToDraft(r)); setEditingId(r.id); setStatus(null); setPreviewHtml(''); setPreviewError(null) }
  const closeEditor = () => { setEditingId(null); setStatus(null) }

  const save = async (publish: boolean) => {
    if (!draft.template_key.trim() || !draft.name.trim()) {
      setStatus({ kind: 'error', text: 'Key and name are required.' }); return
    }
    if (draft.files.length === 0) { setStatus({ kind: 'error', text: 'At least one file is required.' }); return }
    setBusy(true); setStatus(null)
    try {
      const toSave: TemplateDraft = { ...draft, status: publish ? 'published' : draft.status }
      await adminSaveTemplate(toSave, editingId || undefined)
      await load()
      setStatus({ kind: 'ok', text: publish ? 'Published — live on the gallery.' : 'Saved.' })
      setEditingId(editingId === '' ? null : editingId)
    } catch (err) {
      setStatus({ kind: 'error', text: err instanceof Error ? err.message : 'Save failed' })
    } finally { setBusy(false) }
  }

  const remove = async (r: AdminTemplateRow) => {
    if (!window.confirm(`Delete "${r.name}"? This cannot be undone.`)) return
    setBusy(true)
    try { await adminDeleteTemplate(r.id); await load() }
    catch (err) { setStatus({ kind: 'error', text: err instanceof Error ? err.message : 'Delete failed' }) }
    finally { setBusy(false) }
  }

  if (loading) return <p className={styles.muted}>Loading templates…</p>

  if (editing) {
    return (
      <div className={styles.page}>
        <div className={styles.editorHeader}>
          <button className={styles.btn} type="button" onClick={closeEditor}>← Back</button>
          <div className={styles.actions}>
            <button className={styles.btn} type="button" disabled={busy} onClick={() => save(false)}>Save draft</button>
            <button className={`${styles.btn} ${styles.btnPrimary}`} type="button" disabled={busy} onClick={() => save(true)}>Publish</button>
          </div>
        </div>
        {status && <div className={status.kind === 'ok' ? styles.ok : styles.error} role="status">{status.text}</div>}

        <div className={styles.fieldRow}>
          <label className={styles.field}><span>Name</span>
            <input className={styles.input} value={draft.name} onChange={(e) => set('name', e.target.value)} /></label>
          <label className={styles.field}><span>Key (unique)</span>
            <input className={styles.input} value={draft.template_key} onChange={(e) => set('template_key', e.target.value)} placeholder="my-template" /></label>
        </div>
        <label className={styles.field}><span>Description</span>
          <input className={styles.input} value={draft.description} onChange={(e) => set('description', e.target.value)} /></label>
        <div className={styles.fieldRow}>
          <label className={styles.field}><span>Category</span>
            <select className={styles.input} value={draft.category} onChange={(e) => set('category', e.target.value)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select></label>
          <label className={styles.field}><span>Accent color</span>
            <input className={styles.input} type="text" value={draft.accent_color} onChange={(e) => set('accent_color', e.target.value)} placeholder="#2563eb" /></label>
          <label className={styles.field}><span>Sort order</span>
            <input className={styles.input} type="number" value={draft.sort_order} onChange={(e) => set('sort_order', Number(e.target.value) || 0)} /></label>
          <label className={`${styles.field} ${styles.checkField}`}>
            <input type="checkbox" checked={draft.featured} onChange={(e) => set('featured', e.target.checked)} /> Featured</label>
        </div>
        <label className={styles.field}><span>Highlights (one per line)</span>
          <textarea className={styles.textarea} rows={3} value={draft.highlights.join('\n')}
            onChange={(e) => set('highlights', e.target.value.split('\n').map((s) => s.trim()).filter(Boolean))} /></label>

        <div className={styles.split}>
          <div className={styles.filesPane}>
            <div className={styles.filesHeader}>
              <span>Files</span>
              <button className={styles.btnSmall} type="button" onClick={addFile}>+ Add file</button>
            </div>
            {draft.files.map((f, i) => (
              <div key={i} className={styles.fileBlock}>
                <div className={styles.fileTop}>
                  <input className={styles.filePath} value={f.path} onChange={(e) => setFile(i, { path: e.target.value })} />
                  <button className={styles.btnSmall} type="button" onClick={() => removeFile(i)}>Remove</button>
                </div>
                <textarea className={styles.codeArea} rows={10} value={f.code}
                  spellCheck={false}
                  onChange={(e) => setFile(i, { code: e.target.value, language: f.language || 'tsx' })} />
              </div>
            ))}
          </div>
          <div className={styles.previewPane}>
            <div className={styles.previewLabel}>Live preview</div>
            {previewError && <div className={styles.error}>{previewError}</div>}
            <iframe className={styles.previewFrame} srcDoc={previewHtml} title="Template preview" sandbox="allow-scripts" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.heading}>Templates</h1>
        <button className={`${styles.btn} ${styles.btnPrimary}`} type="button" onClick={openNew}>New template</button>
      </header>
      {status && <div className={status.kind === 'ok' ? styles.ok : styles.error} role="status">{status.text}</div>}

      <div className={styles.list}>
        {rows.length === 0 && <p className={styles.muted}>No templates yet.</p>}
        {rows.map((r) => (
          <article key={r.id} className={styles.row}>
            <div className={styles.rowMain}>
              <div className={styles.rowTitle}>
                {r.name}
                <span className={`${styles.badge} ${r.status === 'published' ? styles.badgePub : styles.badgeDraft}`}>{r.status}</span>
                {r.featured && <span className={`${styles.badge} ${styles.badgeFeatured}`}>featured</span>}
              </div>
              <p className={styles.rowMeta}>{r.category} · {r.template_key} · {r.files.length} files · order {r.sort_order}</p>
            </div>
            <div className={styles.rowActions}>
              <button className={styles.btn} type="button" onClick={() => openEdit(r)}>Edit</button>
              <button className={`${styles.btn} ${styles.btnDanger}`} type="button" disabled={busy} onClick={() => remove(r)}>Delete</button>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create `src/pages/admin/AdminTemplatesPage.module.css`**

```css
.page { max-width: 1200px; display: flex; flex-direction: column; gap: 1rem; }
.header, .editorHeader { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
.heading { font-size: 1.5rem; margin: 0; }
.muted { opacity: 0.6; }
.actions { display: flex; gap: 0.5rem; }
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
.badgeFeatured { background: color-mix(in srgb, var(--color-accent) 20%, transparent); color: var(--color-accent); }

.fieldRow { display: flex; gap: 0.75rem; flex-wrap: wrap; }
.field { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.85rem; flex: 1; min-width: 160px; }
.field > span { opacity: 0.7; }
.checkField { flex-direction: row; align-items: center; gap: 0.4rem; flex: 0 0 auto; }
.input, .textarea { padding: 0.5rem 0.7rem; border-radius: 8px; border: 1px solid color-mix(in srgb, var(--color-text) 18%, transparent); background: transparent; color: var(--color-text); font-family: inherit; }
.textarea { resize: vertical; }

.split { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; min-height: 520px; }
.filesPane { display: flex; flex-direction: column; gap: 0.75rem; }
.filesHeader { display: flex; align-items: center; justify-content: space-between; font-weight: 600; font-size: 0.9rem; }
.fileBlock { border: 1px solid color-mix(in srgb, var(--color-text) 12%, transparent); border-radius: 10px; padding: 0.6rem; }
.fileTop { display: flex; gap: 0.5rem; margin-bottom: 0.5rem; }
.filePath { flex: 1; padding: 0.35rem 0.6rem; border-radius: 6px; border: 1px solid color-mix(in srgb, var(--color-text) 18%, transparent); background: transparent; color: var(--color-text); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.8rem; }
.codeArea { width: 100%; padding: 0.6rem; border-radius: 8px; border: 1px solid color-mix(in srgb, var(--color-text) 18%, transparent); background: transparent; color: var(--color-text); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.8rem; line-height: 1.5; resize: vertical; }
.previewPane { display: flex; flex-direction: column; gap: 0.5rem; position: sticky; top: 1rem; align-self: start; }
.previewLabel { font-weight: 600; font-size: 0.9rem; }
.previewFrame { width: 100%; height: 480px; border: 1px solid color-mix(in srgb, var(--color-text) 12%, transparent); border-radius: 10px; background: #fff; }

.btn { padding: 0.4rem 0.85rem; border-radius: 7px; border: 1px solid color-mix(in srgb, var(--color-text) 18%, transparent); background: transparent; color: var(--color-text); cursor: pointer; font-size: 0.88rem; }
.btn:hover:not(:disabled) { background: color-mix(in srgb, var(--color-text) 8%, transparent); }
.btn:disabled { opacity: 0.5; cursor: default; }
.btnPrimary { background: color-mix(in srgb, var(--color-accent) 18%, transparent); color: var(--color-accent); border-color: color-mix(in srgb, var(--color-accent) 40%, transparent); }
.btnDanger { border-color: color-mix(in srgb, #e0524f 50%, transparent); color: #e0524f; }
.btnSmall { padding: 0.25rem 0.6rem; border-radius: 6px; border: 1px solid color-mix(in srgb, var(--color-text) 18%, transparent); background: transparent; color: var(--color-text); cursor: pointer; font-size: 0.8rem; }

@media (max-width: 860px) { .split { grid-template-columns: 1fr; } .previewPane { position: static; } }
```

- [ ] **Step 4: Register nav + route**

`src/pages/admin/AdminLayout.tsx` — add to `NAV_ITEMS`:
```tsx
  { to: '/admin/templates', label: 'Templates', end: false },
```

`src/App.tsx` — lazy import after `AdminBlogPage`:
```tsx
const AdminTemplatesPage = lazy(() => import('./pages/admin/AdminTemplatesPage'))
```
And the route in the `/admin` group:
```tsx
              <Route path="templates" element={<AdminTemplatesPage />} />
```

- [ ] **Step 5: Verify manually**

`npm run dev` as admin → `/admin/templates`: 6 seeded templates listed. Edit one → per-file code editor with debounced live preview rendering in the iframe. Change code, see preview update. Edit a file path, add/remove a file. Create a new template, publish, confirm it appears on `/templates`. Set "featured" + sort_order and confirm ordering on `/templates`.

- [ ] **Step 6: Lint, typecheck, commit**

Run: `npx tsc -b && npm run lint`
```bash
git add src/lib/templates-admin.ts src/pages/admin/AdminTemplatesPage.tsx src/pages/admin/AdminTemplatesPage.module.css src/pages/admin/AdminLayout.tsx src/App.tsx
git commit -m "feat(admin): template manager (per-file editor, live preview, publish)"
```

---

### Task 5: Full verification + merge

- [ ] **Step 1:** `npm run lint && npm run test && npm run build` — all pass; build still prerenders 42 routes (templates don't affect prerender).

- [ ] **Step 2: RLS checks via MCP** (rolled back): authenticated sees only published; non-admin insert/update/delete blocked; admin sees drafts.

- [ ] **Step 3: Merge + push:**
```bash
git checkout master
git merge feature/admin-panel-phase-4
npm run test
git branch -d feature/admin-panel-phase-4
git push
```

- [ ] **Step 4: Surface to the user:** Phase 4 needs no new env vars. Admin panel is now complete (all 4 phases). Templates are managed entirely through RLS — no service-role or deploy-hook dependency.

---

## Self-review notes (applied)

- **Spec coverage:** templates table + seed of bundled templates (T1, T2); admin CRUD with per-file code editor + live preview via existing `buildPreview` (T4); featured/sort ordering (T1, T3, T4); TemplatesPage reads DB with bundled fallback (T3). No SSR/sync/deploy-hook — justified because `/templates` is auth-gated and not prerendered (deviation from blog approach, documented in Architecture).
- **Type consistency:** `Template`/`AgentCodeFile` reused from existing modules; `rowToTemplate` casts `category` to the union (CATEGORY_COLORS already falls back for unknowns). `AdminTemplateRow`/`TemplateDraft` defined in `templates-admin.ts`, consumed only in `AdminTemplatesPage`. `fetchPublishedTemplates` returns `Template[]` matching what `TemplatesPage` already renders.
- **Preview safety:** the admin editor's `buildPreview` is debounced (600ms) and errors are surfaced without crashing; the iframe uses `sandbox="allow-scripts"` like the public page.
- **Seed:** Node 24 type-stripping lets the seed script import `templates.ts` (type-only import erased, `agent.ts` never loaded). Bootstrap uses the temp-RPC trick since local `.env` lacks the service-role key.
