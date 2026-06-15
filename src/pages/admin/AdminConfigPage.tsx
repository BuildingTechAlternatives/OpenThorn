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
  type ProviderModel,
} from '../../lib/providers'
import styles from './AdminConfigPage.module.css'

type Status = { kind: 'ok' | 'error'; text: string } | null

export default function AdminConfigPage() {
  // Model catalog: provider id -> parsed model list (the editable source of
  // truth; serialized only on save).
  const [catalog, setCatalog] = useState<Record<string, ProviderModel[]>>({})
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
      const seeded: Record<string, ProviderModel[]> = {}
      for (const p of PROVIDERS) {
        const raw = dbMap.get(p.id)
        seeded[p.id] = raw != null ? parseProviderModels(raw) : DEFAULT_PROVIDER_MODELS[p.id] ?? []
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
    // Drop incomplete rows (a model needs at least an id) before saving.
    const models = (catalog[providerId] ?? []).filter((m) => m.id.trim().length > 0)
    if (models.length === 0) throw new Error('Add at least one model with a model id.')
    const { error } = await supabase
      .from('default_models')
      .upsert(
        { provider_id: providerId, models: serializeProviderModels(models), updated_at: new Date().toISOString() },
        { onConflict: 'provider_id' },
      )
    if (error) throw new Error(error.message)
    setCatalog((prev) => ({ ...prev, [providerId]: models }))
    setOverridden((prev) => new Set(prev).add(providerId))
  }, 'Model list saved — live for all users.')

  const resetCatalog = (providerId: string) => run(`reset:${providerId}`, async () => {
    const { error } = await supabase.from('default_models').delete().eq('provider_id', providerId)
    if (error) throw new Error(error.message)
    setCatalog((prev) => ({
      ...prev,
      [providerId]: DEFAULT_PROVIDER_MODELS[providerId] ?? [],
    }))
    setOverridden((prev) => {
      const next = new Set(prev)
      next.delete(providerId)
      return next
    })
  }, 'Reset to the bundled defaults.')

  // Structured edits operate on the parsed model list directly.
  const mutateModels = (
    providerId: string,
    fn: (models: ProviderModel[]) => ProviderModel[],
  ) =>
    setCatalog((prev) => ({ ...prev, [providerId]: fn([...(prev[providerId] ?? [])]) }))

  const updateModel = (providerId: string, index: number, patch: Partial<ProviderModel>) =>
    mutateModels(providerId, (models) => {
      models[index] = { ...models[index], ...patch }
      return models
    })

  const setModelFlag = (providerId: string, index: number, flag: string) =>
    updateModel(providerId, index, {
      recommended: flag === 'recommended',
      cheapest: flag === 'cheapest',
    })

  const addModel = (providerId: string) =>
    mutateModels(providerId, (models) => [...models, { name: '', id: '', contextWindow: 128_000 }])

  const removeModel = (providerId: string, index: number) =>
    mutateModels(providerId, (models) => models.filter((_, i) => i !== index))

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
          Each model has a display name, model id, an optional badge, and a context window (tokens). The
          context window sizes the agent's auto-compaction budget — set it to the model's real limit.
          Saved lists go live immediately for all users; "default" means the bundled list ships with the app.
        </p>
        {PROVIDERS.map((p) => {
          const parsed = catalog[p.id] ?? []
          return (
            <details key={p.id} className={styles.catalogRow}>
              <summary className={styles.catalogSummary}>
                {p.name}
                <span className={styles.badge}>
                  {overridden.has(p.id) ? 'overridden' : 'default'} · {parsed.length} models
                </span>
              </summary>
              <div className={styles.modelList}>
                <div className={`${styles.modelRow} ${styles.modelHead}`}>
                  <span>Name</span>
                  <span>Model id</span>
                  <span>Badge</span>
                  <span>Context (tokens)</span>
                  <span />
                </div>
                {parsed.map((m, i) => (
                  <div key={i} className={styles.modelRow}>
                    <input
                      className={styles.input}
                      placeholder="Display name"
                      value={m.name}
                      onChange={(e) => updateModel(p.id, i, { name: e.target.value })}
                    />
                    <input
                      className={styles.input}
                      placeholder="model-id"
                      value={m.id}
                      onChange={(e) => updateModel(p.id, i, { id: e.target.value })}
                    />
                    <select
                      className={styles.input}
                      value={m.recommended ? 'recommended' : m.cheapest ? 'cheapest' : ''}
                      onChange={(e) => setModelFlag(p.id, i, e.target.value)}
                    >
                      <option value="">—</option>
                      <option value="recommended">recommended</option>
                      <option value="cheapest">cheapest</option>
                    </select>
                    <input
                      className={styles.input}
                      type="number"
                      min={1000}
                      step={1000}
                      placeholder="e.g. 200000"
                      value={m.contextWindow ?? ''}
                      onChange={(e) =>
                        updateModel(p.id, i, {
                          contextWindow: e.target.value ? parseInt(e.target.value, 10) : undefined,
                        })
                      }
                    />
                    <button
                      className={styles.btnSmall}
                      type="button"
                      onClick={() => removeModel(p.id, i)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <button className={styles.btnSmall} type="button" onClick={() => addModel(p.id)}>
                + Add model
              </button>
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
