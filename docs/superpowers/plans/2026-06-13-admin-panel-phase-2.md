# Admin Panel Phase 2 (Platform Config) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin Config section: global model catalog editor (no redeploy for model updates), provider enable/disable, site-wide announcement banner, and feature flags — per Phase 2 of `docs/superpowers/specs/2026-06-12-admin-panel-design.md`.

**Architecture:** The model catalog editor writes the **existing global `default_models` table** (provider_id unique, `models` text in `"Name|id, Name|id"` format) which ModelSelector, ProvidersPage, and the agent already read with `DEFAULT_PROVIDER_MODELS` as fallback — this deviates from the spec's `app_config.provider_models` override because the existing table already overrides at every consumption point; only admin write RLS and an editor UI are missing. A new `app_config` key/value-jsonb table carries `disabled_providers`, `announcement`, and `feature_flags`, read through a cached client module (`src/lib/app-config.ts`).

**Tech Stack:** React 19 + TypeScript, Supabase (RLS, jsonb), CSS Modules, Vitest.

**Conventions:** no `Co-Authored-By` in commits; CSS design tokens (`--color-bg`, `--color-text`, `--color-accent`); admin pages live in `src/pages/admin/` and reuse the pill/btn patterns from `AdminUsersPage.module.css`.

**Prerequisites from Phase 1 (already on master):** `public.is_admin()` helper, `/admin` route group with `AdminGuard` + `AdminLayout` (`NAV_ITEMS` array), `src/lib/admin.ts`, admin test patterns in `src/lib/__tests__/`.

---

### Task 1: Migration — app_config table + default_models admin write access

**Files:**
- Create: `supabase/migrations/20260613010000_app_config_and_model_catalog.sql`

- [ ] **Step 1: Write the migration**

```sql
-- ============================================================
-- Admin panel Phase 2: app_config table (disabled providers,
-- announcement banner, feature flags) and admin write access to
-- the existing global default_models catalog.
-- ============================================================

-- 1. app_config: key/value store for platform configuration.
create table if not exists public.app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_config enable row level security;

-- Everyone (including signed-out visitors, e.g. the landing page
-- announcement banner) may read configuration.
drop policy if exists "app_config_select_all" on public.app_config;
create policy "app_config_select_all" on public.app_config
  for select to anon, authenticated using (true);

drop policy if exists "app_config_admin_insert" on public.app_config;
create policy "app_config_admin_insert" on public.app_config
  for insert to authenticated with check (public.is_admin());

drop policy if exists "app_config_admin_update" on public.app_config;
create policy "app_config_admin_update" on public.app_config
  for update to authenticated using (public.is_admin());

drop policy if exists "app_config_admin_delete" on public.app_config;
create policy "app_config_admin_delete" on public.app_config
  for delete to authenticated using (public.is_admin());

-- 2. default_models: global model catalog (created via dashboard,
-- no prior migration). Ensure RLS with public read + admin write so
-- the admin panel can edit the catalog without a redeploy.
alter table public.default_models enable row level security;

drop policy if exists "default_models_select_all" on public.default_models;
create policy "default_models_select_all" on public.default_models
  for select to anon, authenticated using (true);

drop policy if exists "default_models_admin_insert" on public.default_models;
create policy "default_models_admin_insert" on public.default_models
  for insert to authenticated with check (public.is_admin());

drop policy if exists "default_models_admin_update" on public.default_models;
create policy "default_models_admin_update" on public.default_models
  for update to authenticated using (public.is_admin());

drop policy if exists "default_models_admin_delete" on public.default_models;
create policy "default_models_admin_delete" on public.default_models
  for delete to authenticated using (public.is_admin());
```

- [ ] **Step 2: Apply to the Supabase project** (id `ofssvvittiiysoibojts`)

Apply via Supabase MCP `apply_migration` (name `app_config_and_model_catalog`) or the dashboard SQL editor.
Expected: success.

- [ ] **Step 3: Verify RLS (rolled-back impersonation)**

```sql
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"4b203813-caab-4412-8c2e-e8012fd28c37","role":"authenticated"}'; -- non-admin
insert into public.app_config (key, value) values ('x', '1'::jsonb);
rollback;
```
Expected: ERROR 42501 row-level security violation. Also confirm reads work: `set local role anon; select count(*) from public.app_config;` inside another rolled-back transaction returns without error.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260613010000_app_config_and_model_catalog.sql
git commit -m "feat(db): app_config table and admin write access to model catalog"
```

---

### Task 2: `src/lib/app-config.ts` (TDD)

**Files:**
- Create: `src/lib/app-config.ts`
- Test: `src/lib/__tests__/app-config.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/app-config.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  parseAnnouncement,
  parseDisabledProviders,
  parseFeatureFlags,
} from '../app-config'

describe('parseAnnouncement', () => {
  it('returns the announcement when enabled with text', () => {
    expect(parseAnnouncement({ text: 'Maintenance tonight', link: 'https://x.dev', enabled: true }))
      .toEqual({ text: 'Maintenance tonight', link: 'https://x.dev', enabled: true })
  })

  it('omits empty links', () => {
    expect(parseAnnouncement({ text: 'Hello', link: '', enabled: true }))
      .toEqual({ text: 'Hello', link: undefined, enabled: true })
  })

  it('returns null when disabled, empty, or malformed', () => {
    expect(parseAnnouncement({ text: 'Hi', enabled: false })).toBeNull()
    expect(parseAnnouncement({ text: '   ', enabled: true })).toBeNull()
    expect(parseAnnouncement(null)).toBeNull()
    expect(parseAnnouncement('nope')).toBeNull()
    expect(parseAnnouncement({ enabled: true })).toBeNull()
  })
})

describe('parseDisabledProviders', () => {
  it('keeps only strings', () => {
    expect(parseDisabledProviders(['groq', 42, 'xai', null])).toEqual(['groq', 'xai'])
  })

  it('returns [] for non-arrays', () => {
    expect(parseDisabledProviders(undefined)).toEqual([])
    expect(parseDisabledProviders({ groq: true })).toEqual([])
  })
})

describe('parseFeatureFlags', () => {
  it('keeps only boolean values', () => {
    expect(parseFeatureFlags({ a: true, b: false, c: 'yes', d: 1 })).toEqual({ a: true, b: false })
  })

  it('returns {} for non-objects and arrays', () => {
    expect(parseFeatureFlags(null)).toEqual({})
    expect(parseFeatureFlags([true])).toEqual({})
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/__tests__/app-config.test.ts`
Expected: FAIL — module `../app-config` not found.

- [ ] **Step 3: Implement the module**

Create `src/lib/app-config.ts`:

```ts
import { supabase } from './supabase'

export interface Announcement {
  text: string
  link?: string
  enabled: true
}

export type AppConfigMap = Record<string, unknown>

/** Config value parsers are pure so they can be unit-tested. */
export function parseAnnouncement(value: unknown): Announcement | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const v = value as Record<string, unknown>
  if (v.enabled !== true || typeof v.text !== 'string' || !v.text.trim()) return null
  return {
    text: v.text,
    link: typeof v.link === 'string' && v.link.trim() ? v.link : undefined,
    enabled: true,
  }
}

export function parseDisabledProviders(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((x): x is string => typeof x === 'string')
}

export function parseFeatureFlags(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(([, v]) => typeof v === 'boolean'),
  ) as Record<string, boolean>
}

// ---------------------------------------------------------------------------
// Cached fetch — one app_config round-trip per session.
// ---------------------------------------------------------------------------

let configPromise: Promise<AppConfigMap> | null = null

export function loadAppConfig(force = false): Promise<AppConfigMap> {
  if (!configPromise || force) {
    configPromise = supabase
      .from('app_config')
      .select('key, value')
      .then(({ data }) => Object.fromEntries((data ?? []).map((r) => [r.key as string, r.value])))
  }
  return configPromise
}

export async function getAnnouncement(): Promise<Announcement | null> {
  return parseAnnouncement((await loadAppConfig()).announcement)
}

export async function getDisabledProviders(): Promise<string[]> {
  return parseDisabledProviders((await loadAppConfig()).disabled_providers)
}

export async function getFeatureFlags(): Promise<Record<string, boolean>> {
  return parseFeatureFlags((await loadAppConfig()).feature_flags)
}

/** Admin-only write (enforced by RLS). Invalidates the session cache. */
export async function setAppConfig(key: string, value: unknown): Promise<void> {
  const { error } = await supabase
    .from('app_config')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) throw new Error(error.message)
  configPromise = null
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/__tests__/app-config.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/app-config.ts src/lib/__tests__/app-config.test.ts
git commit -m "feat(config): app_config client module with cached reads"
```

---

### Task 3: Announcement banner

**Files:**
- Create: `src/components/AnnouncementBanner/AnnouncementBanner.tsx`
- Create: `src/components/AnnouncementBanner/AnnouncementBanner.module.css`
- Modify: `src/App.tsx` (render inside `<div className={styles.app}>`, before `<Suspense>`)

- [ ] **Step 1: Create the component**

`src/components/AnnouncementBanner/AnnouncementBanner.tsx`:

```tsx
import { useState, useEffect } from 'react'
import { getAnnouncement, type Announcement } from '../../lib/app-config'
import styles from './AnnouncementBanner.module.css'

const DISMISS_KEY = 'openthorn:announcement-dismissed'

/** Stable id so a changed announcement re-appears after a dismissal. */
function announcementId(a: Announcement): string {
  return `${a.text}|${a.link ?? ''}`
}

export default function AnnouncementBanner() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null)

  useEffect(() => {
    let cancelled = false
    getAnnouncement().then((a) => {
      if (cancelled || !a) return
      try {
        if (localStorage.getItem(DISMISS_KEY) === announcementId(a)) return
      } catch { /* storage unavailable — show the banner */ }
      setAnnouncement(a)
    })
    return () => { cancelled = true }
  }, [])

  if (!announcement) return null

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, announcementId(announcement)) } catch { /* ignore */ }
    setAnnouncement(null)
  }

  return (
    <div className={styles.banner} role="status">
      <span className={styles.text}>
        {announcement.text}
        {announcement.link && (
          <a className={styles.link} href={announcement.link} target="_blank" rel="noreferrer">
            Learn more
          </a>
        )}
      </span>
      <button className={styles.dismiss} type="button" aria-label="Dismiss announcement" onClick={dismiss}>
        ×
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Create the styles**

`src/components/AnnouncementBanner/AnnouncementBanner.module.css`:

```css
.banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 0.5rem 2.5rem 0.5rem 1rem;
  position: relative;
  background: color-mix(in srgb, var(--color-accent) 18%, var(--color-bg));
  color: var(--color-text);
  font-size: 0.9rem;
  text-align: center;
  z-index: 50;
}

.text {
  min-width: 0;
}

.link {
  margin-left: 0.5rem;
  color: var(--color-accent);
  font-weight: 600;
}

.dismiss {
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--color-text);
  font-size: 1.1rem;
  line-height: 1;
  cursor: pointer;
  opacity: 0.7;
  padding: 0.25rem 0.5rem;
}

.dismiss:hover {
  opacity: 1;
}
```

- [ ] **Step 3: Render it in `src/App.tsx`**

Add the import next to the other component imports:
```tsx
import AnnouncementBanner from './components/AnnouncementBanner/AnnouncementBanner'
```

Inside the returned JSX, directly after `<div className={styles.app}>` and before `<Suspense ...>`:
```tsx
        <AnnouncementBanner />
```

- [ ] **Step 4: Typecheck and commit**

Run: `npx tsc -b`
Expected: clean.

```bash
git add src/components/AnnouncementBanner src/App.tsx
git commit -m "feat(config): site-wide announcement banner"
```

---

### Task 4: Disabled-provider filtering

**Files:**
- Modify: `src/components/ModelSelector/ModelSelector.tsx` (fetchData, both branches)
- Modify: `src/pages/ProvidersPage.tsx` (provider picker grid ~line 589)

- [ ] **Step 1: Filter in ModelSelector**

Add the import:
```tsx
import { getDisabledProviders } from '../../lib/app-config'
```

At the top of `fetchData()` (after `setFetchError(false)`), add:
```tsx
      const disabled = new Set(await getDisabledProviders())
```

In the **landing** branch, extend the final filter (line ~124):
```tsx
          }).filter((g) => g.models.length > 0 && !disabled.has(g.provider_id))
```

In the **logged-in** branch, extend the final filter (line ~172):
```tsx
          }).filter((g) => g.models.length > 0 && !disabled.has(g.provider_id))
```

- [ ] **Step 2: Filter the provider picker in ProvidersPage**

Add the import:
```tsx
import { getDisabledProviders } from '../lib/app-config'
```

Add state next to the other `useState` calls (~line 104):
```tsx
  const [disabledProviders, setDisabledProviders] = useState<Set<string>>(new Set())
```

Add an effect after the `default_models` effect (~line 121):
```tsx
  useEffect(() => {
    getDisabledProviders().then((ids) => setDisabledProviders(new Set(ids)))
  }, [])
```

Change the picker grid render (~line 589) from `{PROVIDERS.map((p) => {` to:
```tsx
              {PROVIDERS.filter((p) => !disabledProviders.has(p.id)).map((p) => {
```

(Existing saved keys for a disabled provider keep working — disabling only stops *new* key setup and hides the provider from the model selector.)

- [ ] **Step 3: Typecheck and commit**

Run: `npx tsc -b`
Expected: clean.

```bash
git add src/components/ModelSelector/ModelSelector.tsx src/pages/ProvidersPage.tsx
git commit -m "feat(config): hide globally disabled providers from selector and setup"
```

---

### Task 5: Admin Config page

**Files:**
- Create: `src/pages/admin/AdminConfigPage.tsx`
- Create: `src/pages/admin/AdminConfigPage.module.css`
- Modify: `src/pages/admin/AdminLayout.tsx` (NAV_ITEMS)
- Modify: `src/App.tsx` (lazy import + route)

- [ ] **Step 1: Create the page**

`src/pages/admin/AdminConfigPage.tsx`:

```tsx
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import {
  loadAppConfig,
  parseAnnouncement,
  parseDisabledProviders,
  parseFeatureFlags,
  setAppConfig,
} from '../../lib/app-config'
import {
  PROVIDERS,
  DEFAULT_PROVIDER_MODELS,
  parseProviderModels,
  serializeProviderModels,
} from '../../lib/providers'
import styles from './AdminConfigPage.module.css'

type Status = { kind: 'ok' | 'error'; text: string } | null

export default function AdminConfigPage() {
  // Model catalog: provider id -> serialized "Name|id, Name|id" text
  const [catalog, setCatalog] = useState<Record<string, string>>({})
  const [overridden, setOverridden] = useState<Set<string>>(new Set())
  // Platform config
  const [disabled, setDisabled] = useState<Set<string>>(new Set())
  const [bannerEnabled, setBannerEnabled] = useState(false)
  const [bannerText, setBannerText] = useState('')
  const [bannerLink, setBannerLink] = useState('')
  const [flags, setFlags] = useState<Record<string, boolean>>({})
  const [newFlagName, setNewFlagName] = useState('')

  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [{ data: rows }, config] = await Promise.all([
        supabase.from('default_models').select('provider_id, models'),
        loadAppConfig(true),
      ])
      if (cancelled) return

      const dbMap = new Map((rows ?? []).map((r) => [r.provider_id as string, r.models as string]))
      const seeded: Record<string, string> = {}
      for (const p of PROVIDERS) {
        seeded[p.id] = dbMap.get(p.id) ?? serializeProviderModels(DEFAULT_PROVIDER_MODELS[p.id] ?? [])
      }
      setCatalog(seeded)
      setOverridden(new Set(dbMap.keys()))

      setDisabled(new Set(parseDisabledProviders(config.disabled_providers)))
      const a = parseAnnouncement(config.announcement)
      // Show stored draft text even when the banner is disabled.
      const raw = (config.announcement ?? {}) as Record<string, unknown>
      setBannerEnabled(Boolean(a))
      setBannerText(typeof raw.text === 'string' ? raw.text : '')
      setBannerLink(typeof raw.link === 'string' ? raw.link : '')
      setFlags(parseFeatureFlags(config.feature_flags))
      setLoading(false)
    }
    void load()
    return () => { cancelled = true }
  }, [])

  const run = useCallback(async (label: string, fn: () => Promise<void>, okText: string) => {
    setBusy(label)
    setStatus(null)
    try {
      await fn()
      setStatus({ kind: 'ok', text: okText })
    } catch (err) {
      setStatus({ kind: 'error', text: err instanceof Error ? err.message : 'Save failed' })
    } finally {
      setBusy(null)
    }
  }, [])

  const saveCatalog = (providerId: string) => run(`catalog:${providerId}`, async () => {
    const models = parseProviderModels(catalog[providerId])
    if (models.length === 0) throw new Error('No valid models — use "Name|model-id" separated by commas')
    const { error } = await supabase
      .from('default_models')
      .upsert(
        { provider_id: providerId, models: serializeProviderModels(models), updated_at: new Date().toISOString() },
        { onConflict: 'provider_id' },
      )
    if (error) throw new Error(error.message)
    setOverridden((prev) => new Set(prev).add(providerId))
  }, 'Model list saved — live for all users.')

  const resetCatalog = (providerId: string) => run(`reset:${providerId}`, async () => {
    const { error } = await supabase.from('default_models').delete().eq('provider_id', providerId)
    if (error) throw new Error(error.message)
    setCatalog((prev) => ({
      ...prev,
      [providerId]: serializeProviderModels(DEFAULT_PROVIDER_MODELS[providerId] ?? []),
    }))
    setOverridden((prev) => {
      const next = new Set(prev)
      next.delete(providerId)
      return next
    })
  }, 'Reset to the bundled defaults.')

  const saveDisabled = () => run('disabled', async () => {
    await setAppConfig('disabled_providers', [...disabled])
  }, 'Provider availability saved.')

  const saveAnnouncement = () => run('announcement', async () => {
    await setAppConfig('announcement', {
      text: bannerText.trim(),
      link: bannerLink.trim(),
      enabled: bannerEnabled && bannerText.trim().length > 0,
    })
  }, 'Announcement saved.')

  const saveFlags = (next: Record<string, boolean>) => run('flags', async () => {
    setFlags(next)
    await setAppConfig('feature_flags', next)
  }, 'Feature flags saved.')

  if (loading) return <p className={styles.muted}>Loading configuration…</p>

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Platform config</h1>
      {status && (
        <div className={status.kind === 'ok' ? styles.ok : styles.error} role="status">
          {status.text}
        </div>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Announcement banner</h2>
        <label className={styles.checkRow}>
          <input type="checkbox" checked={bannerEnabled} onChange={(e) => setBannerEnabled(e.target.checked)} />
          Show banner site-wide
        </label>
        <input
          className={styles.input}
          type="text"
          placeholder="Banner text"
          value={bannerText}
          onChange={(e) => setBannerText(e.target.value)}
        />
        <input
          className={styles.input}
          type="url"
          placeholder="Optional link (https://…)"
          value={bannerLink}
          onChange={(e) => setBannerLink(e.target.value)}
        />
        <button className={styles.btn} type="button" disabled={busy === 'announcement'} onClick={saveAnnouncement}>
          Save announcement
        </button>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Provider availability</h2>
        <p className={styles.hint}>
          Unchecked providers are hidden from the model selector and key setup. Existing keys keep working.
        </p>
        <div className={styles.providerGrid}>
          {PROVIDERS.map((p) => (
            <label key={p.id} className={styles.checkRow}>
              <input
                type="checkbox"
                checked={!disabled.has(p.id)}
                onChange={(e) => {
                  setDisabled((prev) => {
                    const next = new Set(prev)
                    if (e.target.checked) next.delete(p.id)
                    else next.add(p.id)
                    return next
                  })
                }}
              />
              {p.name}
            </label>
          ))}
        </div>
        <button className={styles.btn} type="button" disabled={busy === 'disabled'} onClick={saveDisabled}>
          Save availability
        </button>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Model catalog</h2>
        <p className={styles.hint}>
          Format: <code>Name|model-id, Name|model-id</code>. Saved lists go live immediately for all users;
          "default" means the bundled list ships with the app.
        </p>
        {PROVIDERS.map((p) => {
          const parsed = parseProviderModels(catalog[p.id] ?? '')
          return (
            <details key={p.id} className={styles.catalogRow}>
              <summary className={styles.catalogSummary}>
                {p.name}
                <span className={styles.badge}>
                  {overridden.has(p.id) ? 'overridden' : 'default'} · {parsed.length} models
                </span>
              </summary>
              <textarea
                className={styles.textarea}
                rows={3}
                value={catalog[p.id] ?? ''}
                onChange={(e) => setCatalog((prev) => ({ ...prev, [p.id]: e.target.value }))}
              />
              <div className={styles.rowActions}>
                <button
                  className={styles.btn}
                  type="button"
                  disabled={busy === `catalog:${p.id}`}
                  onClick={() => saveCatalog(p.id)}
                >
                  Save
                </button>
                {overridden.has(p.id) && (
                  <button
                    className={styles.btn}
                    type="button"
                    disabled={busy === `reset:${p.id}`}
                    onClick={() => resetCatalog(p.id)}
                  >
                    Reset to bundled
                  </button>
                )}
              </div>
            </details>
          )
        })}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Feature flags</h2>
        {Object.keys(flags).length === 0 && <p className={styles.muted}>No flags defined.</p>}
        {Object.entries(flags).map(([name, value]) => (
          <div key={name} className={styles.flagRow}>
            <label className={styles.checkRow}>
              <input
                type="checkbox"
                checked={value}
                onChange={(e) => saveFlags({ ...flags, [name]: e.target.checked })}
              />
              <code>{name}</code>
            </label>
            <button
              className={styles.btnSmall}
              type="button"
              onClick={() => {
                const next = { ...flags }
                delete next[name]
                void saveFlags(next)
              }}
            >
              Remove
            </button>
          </div>
        ))}
        <div className={styles.rowActions}>
          <input
            className={styles.input}
            type="text"
            placeholder="new_flag_name"
            value={newFlagName}
            onChange={(e) => setNewFlagName(e.target.value)}
          />
          <button
            className={styles.btn}
            type="button"
            disabled={!newFlagName.trim() || busy === 'flags'}
            onClick={() => {
              const name = newFlagName.trim()
              if (!name) return
              void saveFlags({ ...flags, [name]: false })
              setNewFlagName('')
            }}
          >
            Add flag
          </button>
        </div>
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Create the styles**

`src/pages/admin/AdminConfigPage.module.css`:

```css
.page {
  max-width: 800px;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.heading {
  font-size: 1.5rem;
  margin: 0;
}

.muted {
  opacity: 0.6;
}

.hint {
  margin: 0;
  font-size: 0.85rem;
  opacity: 0.65;
}

.ok,
.error {
  padding: 0.6rem 0.9rem;
  border-radius: 8px;
}

.ok {
  background: color-mix(in srgb, #34c98a 15%, transparent);
}

.error {
  background: color-mix(in srgb, #e0524f 15%, transparent);
}

.section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1.25rem;
  border: 1px solid color-mix(in srgb, var(--color-text) 12%, transparent);
  border-radius: 12px;
}

.sectionTitle {
  font-size: 1.1rem;
  margin: 0;
}

.input {
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--color-text) 18%, transparent);
  background: transparent;
  color: var(--color-text);
}

.textarea {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--color-text) 18%, transparent);
  background: transparent;
  color: var(--color-text);
  font-family: inherit;
  font-size: 0.88rem;
  resize: vertical;
}

.checkRow {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.92rem;
  cursor: pointer;
}

.providerGrid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 0.4rem;
}

.catalogRow {
  border-bottom: 1px solid color-mix(in srgb, var(--color-text) 8%, transparent);
  padding-bottom: 0.5rem;
}

.catalogSummary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  cursor: pointer;
  padding: 0.35rem 0;
  font-weight: 600;
}

.badge {
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 400;
  background: color-mix(in srgb, var(--color-text) 10%, transparent);
}

.rowActions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-top: 0.5rem;
}

.flagRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.btn {
  padding: 0.4rem 0.85rem;
  border-radius: 7px;
  border: 1px solid color-mix(in srgb, var(--color-text) 18%, transparent);
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  font-size: 0.88rem;
  align-self: flex-start;
}

.btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--color-text) 8%, transparent);
}

.btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.btnSmall {
  padding: 0.25rem 0.6rem;
  border-radius: 6px;
  border: 1px solid color-mix(in srgb, var(--color-text) 18%, transparent);
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  font-size: 0.8rem;
}
```

- [ ] **Step 3: Register nav + route**

In `src/pages/admin/AdminLayout.tsx`, extend `NAV_ITEMS`:
```tsx
const NAV_ITEMS = [
  { to: '/admin', label: 'Moderation', end: true },
  { to: '/admin/users', label: 'Users', end: false },
  { to: '/admin/config', label: 'Config', end: false },
]
```

In `src/App.tsx`, add the lazy import after `AdminUsersPage`:
```tsx
const AdminConfigPage = lazy(() => import('./pages/admin/AdminConfigPage'))
```

And the route inside the `/admin` route group:
```tsx
              <Route path="config" element={<AdminConfigPage />} />
```

- [ ] **Step 4: Verify manually**

`npm run dev` as admin → `/admin/config`: edit a provider's model list, save, then open the model selector as a normal flow — the new list appears without redeploy. Toggle a provider off → it disappears from `/providers` picker and the selector. Enable the banner → it shows on the landing page (signed out too); dismiss persists across reloads until the text changes.

- [ ] **Step 5: Run lint + tests, commit**

Run: `npm run lint && npm run test`
Expected: pass (warnings pre-existing only).

```bash
git add src/pages/admin/AdminConfigPage.tsx src/pages/admin/AdminConfigPage.module.css src/pages/admin/AdminLayout.tsx src/App.tsx
git commit -m "feat(admin): platform config page (model catalog, providers, banner, flags)"
```

---

### Task 6: Full verification

**Files:** none

- [ ] **Step 1: Suite**

Run: `npm run lint && npm run test && npm run build`
Expected: all pass.

- [ ] **Step 2: RLS checks (rolled-back impersonation via Supabase MCP)**

1. Non-admin insert into `app_config` → RLS violation.
2. Non-admin update of `default_models` → RLS violation (0 rows affected or error).
3. Anon select from `app_config` → succeeds.

- [ ] **Step 3: Merge/push per user instruction**

```bash
git checkout master
git merge feature/admin-panel-phase-2
npm run test
git branch -d feature/admin-panel-phase-2
git push
```

---

## Self-review notes (applied)

- Spec coverage: model catalog editor (Tasks 1, 5 — via `default_models`, deviation documented in Architecture), provider toggles (Tasks 2, 4, 5), announcement banner (Tasks 2, 3, 5), feature flags (Tasks 2, 5). No `app_config.provider_models` key — superseded by `default_models`, intentional.
- Type consistency: `parseAnnouncement`/`parseDisabledProviders`/`parseFeatureFlags`/`loadAppConfig`/`setAppConfig` defined in Task 2 and consumed in Tasks 3 and 5; `Announcement.enabled: true` literal matches the parser contract.
- `default_models.updated_at` exists (verified against prod schema), so the upsert in Task 5 is valid.
