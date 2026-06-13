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
