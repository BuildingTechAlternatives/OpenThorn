import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import { encryptApiKey, decryptApiKey } from '../lib/crypto'
import {
  DEFAULT_PROVIDER_MODELS,
  LOGO_MAP,
  PROVIDERS,
  PROVIDER_DEFS,
  parseProviderModels,
  serializeProviderModels,
  type ProviderModel,
} from '../lib/providers'
import DashboardSidebar from '../components/DashboardSidebar/DashboardSidebar'
import { getDisabledProviders } from '../lib/app-config'
import { usePageTitle } from '../lib/usePageTitle'
import styles from './ProvidersPage.module.css'

async function decryptKeys(data: ProviderKey[], userId: string): Promise<ProviderKey[]> {
  return Promise.all(data.map(async (k) => {
    try {
      return { ...k, api_key: await decryptApiKey(k.api_key, userId), decrypt_error: false }
    } catch {
      return { ...k, api_key: '', enabled: false, decrypt_error: true }
    }
  }))
}

interface ProviderKey {
  id: string
  provider_id: string
  provider_name: string
  api_key: string
  base_url: string
  models: string
  enabled: boolean
  is_custom: boolean
  decrypt_error?: boolean
}

function extractModelList(payload: unknown, providerId: string): ProviderModel[] {
  const record = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {}
  const rawModels = Array.isArray(record.data)
    ? record.data
    : Array.isArray(record.models)
      ? record.models
      : []

  return rawModels
    .map((item) => {
      const model = item && typeof item === 'object' ? item as Record<string, unknown> : {}
      const supportedMethods = Array.isArray(model.supportedGenerationMethods)
        ? model.supportedGenerationMethods
        : Array.isArray(model.supportedActions)
          ? model.supportedActions
          : []
      if (
        providerId === 'google' &&
        supportedMethods.length > 0 &&
        !supportedMethods.some((method) => typeof method === 'string' && method.toLowerCase() === 'generatecontent')
      ) {
        return null
      }

      let rawId = ''
      if (providerId === 'google' && typeof model.baseModelId === 'string') {
        rawId = model.baseModelId
      } else if (typeof model.id === 'string') {
        rawId = model.id
      } else if (typeof model.name === 'string') {
        rawId = model.name
      }

      const id = providerId === 'google' ? rawId.replace(/^models\//, '') : rawId
      const name = typeof model.displayName === 'string' && model.displayName.trim()
        ? model.displayName.trim()
        : id
      return { name, id }
    })
    .filter((model): model is ProviderModel => Boolean(model?.id))
}

export default function ProvidersPage() {
  usePageTitle('API Providers', {
    description: 'Connect and test the AI provider API keys OpenThorn uses to build your projects.',
  })
  const { user, loading: authLoading } = useAuth()
  const [savedKeys, setSavedKeys] = useState<ProviderKey[]>([])
  const [loading, setLoading] = useState(true)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [editingProvider, setEditingProvider] = useState<string | null>(null)
  const [formKey, setFormKey] = useState('')
  const [formUrl, setFormUrl] = useState('')
  const [formModels, setFormModels] = useState('')
  const [formEnabled, setFormEnabled] = useState(false)
  const [toggleWarning, setToggleWarning] = useState(false)
  const [formName, setFormName] = useState('')
  const [formCustom, setFormCustom] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [defaultModels, setDefaultModels] = useState<Record<string, ProviderModel[]>>(DEFAULT_PROVIDER_MODELS)
  const [disabledProviders, setDisabledProviders] = useState<Set<string>>(new Set())
  const [newModelName, setNewModelName] = useState('')
  const [newModelId, setNewModelId] = useState('')
  const [newModelContextWindow, setNewModelContextWindow] = useState<number>(1_000_000)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [testState, setTestState] = useState<{ status: 'idle' | 'testing' | 'success' | 'error'; message: string }>({
    status: 'idle',
    message: '',
  })

  useEffect(() => {
    supabase.from('default_models').select('*').then(({ data }) => {
      if (data) {
        const map: Record<string, ProviderModel[]> = { ...DEFAULT_PROVIDER_MODELS }
        data.forEach((d: { provider_id: string; models: string }) => {
          const models = parseProviderModels(d.models)
          if (models.length > 0) map[d.provider_id] = models
        })
        setDefaultModels(map)
      }
    })
  }, [])

  useEffect(() => {
    getDisabledProviders().then((ids) => setDisabledProviders(new Set(ids)))
  }, [])

  useEffect(() => {
    if (!user) return

    // Initial fetch
    supabase.from('provider_keys').select('*').eq('user_id', user.id).order('created_at').then(async ({ data, error }) => {
      if (!error && data) setSavedKeys(await decryptKeys(data, user.id))
      setLoading(false)
    })

    // Real-time subscription for cross-device sync
    const channel = supabase
      .channel('provider_keys_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'provider_keys',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        // Refetch all keys on any change
        supabase.from('provider_keys').select('*').eq('user_id', user.id).order('created_at').then(async ({ data, error }) => {
          if (!error && data) setSavedKeys(await decryptKeys(data, user.id))
        })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user])

  const openEditor = useCallback((providerId: string) => {
    const existing = savedKeys.find((k) => k.provider_id === providerId)
    const def = PROVIDER_DEFS[providerId]
    let nextTestState: { status: 'idle' | 'testing' | 'success' | 'error'; message: string } = { status: 'idle', message: '' }
    if (existing) {
      setFormKey(existing.api_key)
      setFormUrl(existing.base_url)
      setFormModels(existing.models || '')
      setFormEnabled(existing.enabled)
      setFormName(existing.provider_name)
      setFormCustom(existing.is_custom)
      if (existing.decrypt_error) {
        nextTestState = {
          status: 'error',
          message: 'This saved key could not be decrypted. Paste a new key and save it again.',
        }
      }
    } else if (def) {
      setFormKey('')
      setFormUrl(def.baseUrl)
      setFormModels('')
      setFormEnabled(false)
      setFormName(def.name)
      setFormCustom(false)
    }
    setEditingProvider(providerId)
    setPickerOpen(false)
    setShowKey(false)
    setTestState(nextTestState)
  }, [savedKeys])

  const saveKey = async () => {
    if (!user || !editingProvider || !formKey.trim()) return
    setSaving(true)
    const def = PROVIDER_DEFS[editingProvider]
    const encryptedKey = await encryptApiKey(formKey.trim(), user.id)
    const payload = {
      user_id: user.id,
      provider_id: editingProvider,
      provider_name: formName || def?.name || 'Custom',
      api_key: encryptedKey,
      base_url: formUrl.trim() || (def?.baseUrl ?? ''),
      models: formModels.trim(),
      enabled: formEnabled && (def?.testable ?? true),
      is_custom: formCustom,
      updated_at: new Date().toISOString(),
    }

    const existing = savedKeys.find((k) => k.provider_id === editingProvider)
    let result
    if (existing) {
      result = await supabase.from('provider_keys').update(payload).eq('id', existing.id).eq('user_id', user.id).select()
    } else {
      result = await supabase.from('provider_keys').insert(payload).select()
    }

    if (!result.error && result.data) {
      setSavedKeys((prev) => {
        const next = prev.filter((k) => k.provider_id !== editingProvider)
        return [...next, { ...result.data![0], api_key: formKey.trim() }]
      })
      setEditingProvider(null)
    }
    setSaving(false)
  }

  const testProviderConnection = async () => {
    if (!editingProvider || !formKey.trim()) return

    setTestState({ status: 'testing', message: 'Testing connection...' })
    const def = PROVIDER_DEFS[editingProvider]
    const providerId = formCustom ? 'custom' : editingProvider
    const baseUrl = (formUrl.trim() || def?.baseUrl || '').replace(/\/+$/, '')

    if (!baseUrl || baseUrl.includes('YOUR_RESOURCE')) {
      setTestState({ status: 'error', message: 'Enter a real base URL before testing.' })
      return
    }

    if (def && !def.testable) {
      setTestState({ status: 'error', message: def.testNote ?? 'This provider cannot be tested from the browser.' })
      return
    }

    try {
      const modelListPath = def?.modelListPath ?? '/models'
      const url = providerId === 'google'
        ? `${baseUrl}/models?key=${encodeURIComponent(formKey.trim())}`
        : `${baseUrl}${modelListPath}`

      const headers: Record<string, string> = {}
      if (providerId === 'anthropic') {
        headers['x-api-key'] = formKey.trim()
        headers['anthropic-version'] = '2023-06-01'
      } else if (providerId === 'azure') {
        headers['api-key'] = formKey.trim()
      } else if (providerId !== 'google' && providerId !== 'ollama') {
        headers.Authorization = `Bearer ${formKey.trim()}`
      }

      const response = await fetch(url, { method: 'GET', headers })
      if (!response.ok) {
        const body = await response.text().catch(() => '')
        throw new Error(`Provider returned ${response.status}${body ? `: ${body.slice(0, 120)}` : ''}`)
      }

      const payload = await response.json().catch(() => null)
      const remoteModels = def?.syncModels === false ? [] : extractModelList(payload, providerId)
      if (remoteModels.length > 0) {
        setTestState({ status: 'success', message: `Connection looks good. Synced ${remoteModels.length} model${remoteModels.length === 1 ? '' : 's'}.` })
      } else {
        setTestState({ status: 'success', message: 'Connection looks good.' })
      }
    } catch (err) {
      setTestState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Connection failed.',
      })
    }
  }

  const deleteKey = async () => {
    if (!user || !editingProvider) return
    const existing = savedKeys.find((k) => k.provider_id === editingProvider)
    if (!existing) return
    const { error } = await supabase.from('provider_keys').delete().eq('id', existing.id).eq('user_id', user.id)
    if (!error) {
      setSavedKeys((prev) => prev.filter((k) => k.id !== existing.id))
      setEditingProvider(null)
    }
  }

  const toggleEnabled = async (key: ProviderKey) => {
    if (!user) return
    const def = PROVIDER_DEFS[key.provider_id]
    if (def && !def.testable) return
    const newEnabled = !key.enabled
    const { error } = await supabase.from('provider_keys')
      .update({ enabled: newEnabled, updated_at: new Date().toISOString() })
      .eq('id', key.id).eq('user_id', user.id)
    if (!error) {
      setSavedKeys((prev) => prev.map((k) => (k.id === key.id ? { ...k, enabled: newEnabled } : k)))
    }
  }

  const openCustomEditor = () => {
    const id = `custom-${Date.now()}`
    setFormKey('')
    setFormUrl('')
    setFormModels('')
    setFormEnabled(false)
    setFormName('')
    setFormCustom(true)
    setEditingProvider(id)
    setPickerOpen(false)
    setShowKey(false)
    setTestState({ status: 'idle', message: '' })
  }

  const ProviderLogo = ({ id, name, color, className }: { id: string; name: string; color: string; className: string }) => {
    const [failed, setFailed] = useState(false)
    if (!LOGO_MAP[id] || failed) {
      return (
        <span className={className} style={{ background: color + '22', color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1rem', borderRadius: 8 }}>
          {name.charAt(0)}
        </span>
      )
    }
    return <img src={LOGO_MAP[id]} alt={name} className={className} onError={() => setFailed(true)} />
  }

  if (authLoading) return null

  const editingDef = PROVIDERS.find((p) => p.id === editingProvider)

  return (
    <div className={styles.root}>
      <DashboardSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className={styles.mobileTopbar}>
        <button
          className={styles.mobileMenuBtn}
          onClick={() => setSidebarOpen(true)}
          aria-label="Open menu"
          type="button"
        >
          <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
        <a href="/dashboard" className={styles.mobileLogo}>
          <img src="/assets/logo.png" alt="OpenThorn" className={styles.mobileLogoImg} />
        </a>
      </div>

      <main className={styles.main}>
        <div className={styles.content}>
          {/* OpenThorn logo */}
          <div className={styles.brandRow}>
            <img src="/assets/logo.png" alt="OpenThorn" className={styles.brandLogo} />
          </div>

          {/* Empty state */}
          {!loading && !editingProvider && savedKeys.length === 0 && (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.5">
                  <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
                </svg>
              </div>
              <h2 className={styles.emptyTitle}>No providers configured</h2>
              <p className={styles.emptyText}>
                Connect your LLM providers to start building with OpenThorn.
                Your API keys are stored securely in your account.
              </p>
              <button className={styles.recommendedBtn} onClick={() => openEditor('google')} type="button">
                <ProviderLogo id="google" name="Google Gemini" color="#4285F4" className={styles.recommendedLogo} />
                <span className={styles.recommendedText}>
                  <span className={styles.recommendedTitle}>Start with Google Gemini</span>
                  <span className={styles.recommendedSub}>Free to start — no credit card needed</span>
                </span>
                <span className={styles.freeBadgeSm}>Free</span>
              </button>
              <button className={styles.configureSecondary} onClick={() => setPickerOpen(true)} type="button">
                or choose another provider
              </button>
            </div>
          )}

          {/* Editing a provider */}
          {editingProvider && (
            <div className={`${styles.editorCard} ${formEnabled ? styles.editorCardEnabled : ''}`}>
              <div className={styles.editorTopRow}>
                <button className={styles.backArrow} onClick={() => setEditingProvider(null)} type="button">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <label className={styles.toggle}>
                  <input type="checkbox" checked={formEnabled} disabled={editingDef ? !editingDef.testable : false} onChange={() => {
                    if (editingDef && !editingDef.testable) {
                      setToggleWarning(true)
                      setTimeout(() => setToggleWarning(false), 3000)
                      return
                    }
                    if (!formEnabled && !formKey.trim()) {
                      setToggleWarning(true)
                      setTimeout(() => setToggleWarning(false), 3000)
                      return
                    }
                    setFormEnabled(!formEnabled)
                    setToggleWarning(false)
                  }} />
                  <span className={styles.toggleSlider} />
                </label>
              </div>
              {toggleWarning && (
                <div className={styles.toggleWarning}>{editingDef && !editingDef.testable ? editingDef.testNote : 'Set an API key first before enabling'}</div>
              )}

              <div className={styles.editorHeader}>
                {editingDef && !formCustom ? (
                  <ProviderLogo id={editingDef.id} name={editingDef.name} color={editingDef.color} className={styles.editorLogoImg} />
                ) : (
                  <div className={styles.editorLogoPlaceholder}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4"/>
                    </svg>
                  </div>
                )}
                <div>
                  {formCustom ? (
                    <input className={styles.nameInput} type="text" placeholder="Provider name" value={formName} onChange={(e) => setFormName(e.target.value)} />
                  ) : (
                    <h2 className={styles.editorTitle}>{editingDef?.name ?? 'Custom Provider'}</h2>
                  )}
                  <p className={styles.editorSubtitle}>Enter your API key to connect</p>
                </div>
              </div>

              {editingDef?.setupSteps && !savedKeys.some((k) => k.provider_id === editingProvider) && (
                <div className={styles.setupGuide}>
                  <div className={styles.setupGuideHeader}>
                    <span className={styles.setupGuideTitle}>How to get your key</span>
                    {editingDef.freeTier && <span className={styles.freeBadge}>Free to start</span>}
                  </div>
                  <ol className={styles.setupSteps}>
                    {editingDef.setupSteps.map((step, i) => (
                      <li key={i} className={styles.setupStep}>
                        <span className={styles.setupStepNum}>{i + 1}</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                  {editingDef.getKeyUrl && (
                    <a
                      className={styles.setupGuideLink}
                      href={editingDef.getKeyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open {editingDef.name === 'Google Gemini' ? 'Google AI Studio' : editingDef.name}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14L21 3"/>
                      </svg>
                    </a>
                  )}
                </div>
              )}

              <div className={styles.editorFields}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>API key</label>
                  <div className={styles.keyWrap}>
                    <input className={styles.keyInput} type={showKey ? 'text' : 'password'} placeholder="Enter your API key" value={formKey} onChange={(e) => { setFormKey(e.target.value); setTestState({ status: 'idle', message: '' }) }} />
                    <button className={styles.eyeBtn} onClick={() => setShowKey(!showKey)} type="button">
                      {showKey ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      )}
                    </button>
                  </div>
                </div>

                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Base URL</label>
                  <input className={styles.urlInput} type="text" placeholder="https://api.example.com/v1" value={formUrl} onChange={(e) => { setFormUrl(e.target.value); setTestState({ status: 'idle', message: '' }) }} />
                </div>

                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Models</label>
                  <div className={styles.modelList}>
                    {[...(defaultModels[editingProvider] || []), ...parseProviderModels(formModels)].map((m) => {
                      const isDefault = (defaultModels[editingProvider] || []).some((d) => d.id === m.id)
                      return (
                        <span key={m.id} className={`${styles.modelPill} ${!isDefault ? styles.modelPillCustom : ''}`} title={m.id}>
                          {isDefault && (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                          )}
                          {m.name}
                          {!isDefault && (
                            <button className={styles.modelRemove} onClick={() => {
                              const updated = serializeProviderModels(parseProviderModels(formModels).filter((x) => x.id !== m.id))
                              setFormModels(updated)
                            }} type="button" aria-label={`Remove ${m.name}`}>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                          )}
                        </span>
                      )
                    })}
                  </div>

                  {/* Advanced: add custom model */}
                  <button className={styles.advancedToggle} onClick={() => setShowAdvanced(!showAdvanced)} type="button">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
                    Advanced options
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: showAdvanced ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                  {showAdvanced && (
                    <div className={styles.advancedSection}>
                      <div className={styles.addModelRow}>
                        <input className={styles.addModelInput} type="text" placeholder="Model name (e.g. My Fine-tune)" value={newModelName} onChange={(e) => setNewModelName(e.target.value)} />
                        <input className={styles.addModelInput} type="text" placeholder="Model ID (e.g. ft:gpt-4.1:my-org::abc123)" value={newModelId} onChange={(e) => setNewModelId(e.target.value)} />
                      </div>
                      <div className={styles.addModelRow}>
                        <label className={styles.addModelLabel}>Context limit</label>
                        <select
                          className={styles.addModelInput}
                          value={newModelContextWindow}
                          onChange={(e) => setNewModelContextWindow(Number(e.target.value))}
                        >
                          <option value={32_000}>32k tokens</option>
                          <option value={64_000}>64k tokens</option>
                          <option value={128_000}>128k tokens</option>
                          <option value={200_000}>200k tokens</option>
                          <option value={256_000}>256k tokens</option>
                          <option value={1_000_000}>1M tokens (default)</option>
                          <option value={2_000_000}>2M tokens</option>
                        </select>
                        <button
                          className={styles.addModelBtn}
                          onClick={() => {
                            if (!newModelName.trim() || !newModelId.trim()) return
                            const current = parseProviderModels(formModels)
                            if (!current.some((m) => m.id === newModelId.trim())) {
                              setFormModels(serializeProviderModels([...current, { name: newModelName.trim(), id: newModelId.trim(), contextWindow: newModelContextWindow }]))
                            }
                            setNewModelName('')
                            setNewModelId('')
                            setNewModelContextWindow(1_000_000)
                          }}
                          type="button"
                          disabled={!newModelName.trim() || !newModelId.trim()}
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className={styles.editorActions}>
                <button className={styles.testBtn} onClick={testProviderConnection} disabled={testState.status === 'testing' || !formKey.trim()} type="button">
                  {testState.status === 'testing' ? 'Testing...' : 'Test connection'}
                </button>
                <button className={styles.saveBtn} onClick={saveKey} disabled={saving || !formKey.trim()} type="button">
                  {saving ? 'Saving...' : 'Save provider'}
                </button>
                {savedKeys.some((k) => k.provider_id === editingProvider) && (
                  <button className={styles.deleteBtn} onClick={deleteKey} type="button">Remove</button>
                )}
              </div>
              {testState.status !== 'idle' && (
                <div className={`${styles.connectionResult} ${testState.status === 'success' ? styles.connectionSuccess : ''} ${testState.status === 'error' ? styles.connectionError : ''}`} role="status">
                  {testState.message}
                </div>
              )}
            </div>
          )}

          {/* Trademark note */}
          <p className={styles.trademarkNote}>
            All product names, logos, and brands are property of their respective owners.
            Use of these names does not imply endorsement.
          </p>

          {/* Enabled providers list + add button */}
          {!editingProvider && !loading && savedKeys.length > 0 && (
            <>
              <div className={styles.enabledList}>
                {savedKeys.map((key) => {
                  const def = PROVIDERS.find((p) => p.id === key.provider_id)
                  return (
                    <div key={key.id} className={styles.enabledCard}>
                      <div className={styles.enabledLeft}>
                        <div className={styles.enabledLogo}>
                          {def ? <ProviderLogo id={def.id} name={def.name} color={def.color} className={styles.enabledLogoImg} /> : (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="2" width="20" height="20" rx="4"/></svg>
                          )}
                        </div>
                        <div>
                          <span className={styles.enabledName}>{key.provider_name}</span>
                          <span className={styles.enabledKey}>
                            {key.decrypt_error ? 'Key needs to be re-saved' : `${key.api_key.slice(0, 6)}........${key.api_key.slice(-4)}`}
                          </span>
                          {key.models && (
                            <span className={styles.enabledModels}>{key.models.split(',').length} model{key.models.split(',').length !== 1 ? 's' : ''} configured</span>
                          )}
                        </div>
                      </div>
                      <div className={styles.enabledRight}>
                        <label className={styles.toggle}>
                          <input type="checkbox" checked={key.enabled} disabled={key.decrypt_error || (def ? !def.testable : false)} onChange={() => toggleEnabled(key)} />
                          <span className={styles.toggleSlider} />
                        </label>
                        <button className={styles.editBtn} onClick={() => openEditor(key.provider_id)} type="button">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
              <button className={styles.addMoreBtn} onClick={() => setPickerOpen(true)} type="button">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add another provider
              </button>
            </>
          )}
        </div>
      </main>

      {/* Provider picker modal */}
      {pickerOpen && (
        <div className={styles.pickerOverlay} onClick={() => setPickerOpen(false)}>
          <div className={styles.pickerModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.pickerHeader}>
              <h3>Choose a provider</h3>
              <button className={styles.pickerClose} onClick={() => setPickerOpen(false)} type="button">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className={styles.pickerGrid}>
              <button className={`${styles.pickerCard} ${styles.pickerCardCustom}`} onClick={openCustomEditor} type="button">
                <div className={styles.pickerLogo} style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
                </div>
                <span className={styles.pickerName}>Custom</span>
              </button>
              {PROVIDERS.filter((p) => !disabledProviders.has(p.id)).map((p) => {
                const saved = savedKeys.find((k) => k.provider_id === p.id)
                const isEnabled = saved?.enabled ?? false
                const hasKey = !!(saved?.api_key)
                return (
                  <button key={p.id} className={`${styles.pickerCard} ${isEnabled ? styles.pickerCardActive : ''}`} onClick={() => openEditor(p.id)} type="button">
                    <div className={styles.pickerLogo}>
                      <ProviderLogo id={p.id} name={p.name} color={p.color} className={styles.pickerLogoImg} />
                    </div>
                    <span className={styles.pickerName}>{p.name}</span>
                    {hasKey ? <span className={styles.configuredBadge}>Key set</span>
                      : p.freeTier ? <span className={styles.freeBadgeSm}>Free</span> : null}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
