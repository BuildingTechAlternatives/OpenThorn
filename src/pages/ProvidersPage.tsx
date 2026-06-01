import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import DashboardSidebar from '../components/DashboardSidebar/DashboardSidebar'
import FloatingParticles from '../components/FloatingParticles/FloatingParticles'
import styles from './ProvidersPage.module.css'

interface ProviderKey {
  id: string
  provider_id: string
  provider_name: string
  api_key: string
  base_url: string
  enabled: boolean
  is_custom: boolean
}

interface ProviderDef {
  id: string
  name: string
  baseUrl: string
  color: string
}

const PROVIDERS: ProviderDef[] = [
  { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', color: '#74AA9C' },
  { id: 'anthropic', name: 'Anthropic', baseUrl: 'https://api.anthropic.com/v1', color: '#D4A574' },
  { id: 'google', name: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', color: '#4285F4' },
  { id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', color: '#4D6BFE' },
  { id: 'mistral', name: 'Mistral AI', baseUrl: 'https://api.mistral.ai/v1', color: '#F59E0B' },
  { id: 'groq', name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', color: '#F97316' },
  { id: 'together', name: 'Together AI', baseUrl: 'https://api.together.xyz/v1', color: '#6366F1' },
]

const LOGO_MAP: Record<string, string> = {
  openai: '/assets/openai.png',
  anthropic: '/assets/anthropic.png',
  google: '/assets/google.png',
  deepseek: '/assets/deepseek.webp',
  mistral: '/assets/mistralai.png',
  groq: '/assets/groq.png',
  together: '/assets/togetherai.png',
}

export default function ProvidersPage() {
  const { user, loading: authLoading } = useAuth()
  const [savedKeys, setSavedKeys] = useState<ProviderKey[]>([])
  const [loading, setLoading] = useState(true)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [editingProvider, setEditingProvider] = useState<string | null>(null)
  const [formKey, setFormKey] = useState('')
  const [formUrl, setFormUrl] = useState('')
  const [formEnabled, setFormEnabled] = useState(true)
  const [formName, setFormName] = useState('')
  const [formCustom, setFormCustom] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showKey, setShowKey] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase.from('provider_keys').select('*').eq('user_id', user.id).order('created_at').then(({ data, error }) => {
      if (!error && data) setSavedKeys(data)
      setLoading(false)
    })
  }, [user])

  const openEditor = useCallback((providerId: string) => {
    const existing = savedKeys.find((k) => k.provider_id === providerId)
    const def = PROVIDERS.find((p) => p.id === providerId)
    if (existing) {
      setFormKey(existing.api_key)
      setFormUrl(existing.base_url)
      setFormEnabled(existing.enabled)
      setFormName(existing.provider_name)
      setFormCustom(existing.is_custom)
    } else if (def) {
      setFormKey('')
      setFormUrl(def.baseUrl)
      setFormEnabled(true)
      setFormName(def.name)
      setFormCustom(false)
    }
    setEditingProvider(providerId)
    setPickerOpen(false)
    setShowKey(false)
  }, [savedKeys])

  const saveKey = async () => {
    if (!user || !editingProvider || !formKey.trim()) return
    setSaving(true)
    const def = PROVIDERS.find((p) => p.id === editingProvider)
    const payload = {
      user_id: user.id,
      provider_id: editingProvider,
      provider_name: formName || def?.name || 'Custom',
      api_key: formKey.trim(),
      base_url: formUrl.trim() || (def?.baseUrl ?? ''),
      enabled: formEnabled,
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
        return [...next, result.data![0]]
      })
      setEditingProvider(null)
    }
    setSaving(false)
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
    const updated = { ...key, enabled: !key.enabled, updated_at: new Date().toISOString() }
    const { error } = await supabase.from('provider_keys').update(updated).eq('id', key.id).eq('user_id', user.id)
    if (!error) {
      setSavedKeys((prev) => prev.map((k) => (k.id === key.id ? updated : k)))
    }
  }

  const quickToggle = async (providerId: string) => {
    if (!user) return
    const existing = savedKeys.find((k) => k.provider_id === providerId)
    if (!existing || !existing.api_key) {
      // No key yet — open editor
      openEditor(providerId)
      return
    }
    // Toggle enabled
    const updated = { ...existing, enabled: !existing.enabled, updated_at: new Date().toISOString() }
    const { error } = await supabase.from('provider_keys').update(updated).eq('id', existing.id).eq('user_id', user.id)
    if (!error) {
      setSavedKeys((prev) => prev.map((k) => (k.id === existing.id ? updated : k)))
    }
  }

  const openCustomEditor = () => {
    const id = `custom-${Date.now()}`
    setFormKey('')
    setFormUrl('')
    setFormEnabled(true)
    setFormName('')
    setFormCustom(true)
    setEditingProvider(id)
    setPickerOpen(false)
    setShowKey(false)
  }

  if (authLoading) return null

  const enabledKeys = savedKeys.filter((k) => k.enabled)
  const editingDef = PROVIDERS.find((p) => p.id === editingProvider)

  return (
    <div className={styles.root}>
      <FloatingParticles
        particleCount={60}
        particleSize={2.5}
        particleOpacity={0.45}
        particleColor="#A78BFA"
        glowIntensity={14}
        movementSpeed={0.35}
        mouseInfluence={140}
        mouseGravity="attract"
        gravityStrength={32}
        glowAnimation="ease"
      />

      <DashboardSidebar />

      <main className={styles.main}>
        <div className={styles.content}>
          {/* Bloom logo */}
          <div className={styles.brandRow}>
            <img src="/assets/logo.png" alt="Bloom" className={styles.brandLogo} />
          </div>

          {/* Empty state */}
          {!loading && !editingProvider && enabledKeys.length === 0 && (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.5">
                  <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
                </svg>
              </div>
              <h2 className={styles.emptyTitle}>No providers configured</h2>
              <p className={styles.emptyText}>
                Connect your LLM providers to start building with Bloom.
                Your API keys are stored securely in your account.
              </p>
              <button className={styles.configureBtn} onClick={() => setPickerOpen(true)} type="button">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Configure a provider
              </button>
            </div>
          )}

          {/* Editing a provider */}
          {editingProvider && (
            <div className={styles.editorCard}>
              <button className={styles.backArrow} onClick={() => setEditingProvider(null)} type="button">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>

              <div className={styles.editorHeader}>
                {editingDef && !formCustom ? (
                  <img src={LOGO_MAP[editingDef.id]} alt={editingDef.name} className={styles.editorLogoImg} />
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

              <div className={styles.editorFields}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>API key</label>
                  <div className={styles.keyWrap}>
                    <input className={styles.keyInput} type={showKey ? 'text' : 'password'} placeholder="Enter your API key" value={formKey} onChange={(e) => setFormKey(e.target.value)} />
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
                  <input className={styles.urlInput} type="text" placeholder="https://api.example.com/v1" value={formUrl} onChange={(e) => setFormUrl(e.target.value)} />
                </div>
              </div>

              <div className={styles.editorActions}>
                <button className={styles.saveBtn} onClick={saveKey} disabled={saving || !formKey.trim()} type="button">
                  {saving ? 'Saving…' : 'Save provider'}
                </button>
                {savedKeys.some((k) => k.provider_id === editingProvider) && (
                  <button className={styles.deleteBtn} onClick={deleteKey} type="button">Remove</button>
                )}
              </div>
            </div>
          )}

          {/* Enabled providers list + add button */}
          {!editingProvider && !loading && enabledKeys.length > 0 && (
            <>
              <div className={styles.enabledList}>
                {enabledKeys.map((key) => {
                  const def = PROVIDERS.find((p) => p.id === key.provider_id)
                  return (
                    <div key={key.id} className={styles.enabledCard}>
                      <div className={styles.enabledLeft}>
                        <div className={styles.enabledLogo}>
                          {def ? <img src={LOGO_MAP[def.id]} alt={def.name} className={styles.enabledLogoImg} /> : (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="2" width="20" height="20" rx="4"/></svg>
                          )}
                        </div>
                        <div>
                          <span className={styles.enabledName}>{key.provider_name}</span>
                          <span className={styles.enabledKey}>{key.api_key.slice(0, 6)}••••••••{key.api_key.slice(-4)}</span>
                        </div>
                      </div>
                      <div className={styles.enabledRight}>
                        <label className={styles.toggle}>
                          <input type="checkbox" checked={key.enabled} onChange={() => toggleEnabled(key)} />
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
              {PROVIDERS.map((p) => {
                const saved = savedKeys.find((k) => k.provider_id === p.id)
                const isEnabled = saved?.enabled ?? false
                const hasKey = !!(saved?.api_key)
                return (
                  <div key={p.id} className={`${styles.pickerCard} ${isEnabled ? styles.pickerCardActive : ''}`}>
                    <button className={styles.pickerCardInner} onClick={() => openEditor(p.id)} type="button">
                      <div className={styles.pickerLogo}>
                        <img src={LOGO_MAP[p.id]} alt={p.name} className={styles.pickerLogoImg} />
                      </div>
                      <span className={styles.pickerName}>{p.name}</span>
                    </button>
                    <div className={styles.pickerToggleRow}>
                      {hasKey && <span className={styles.configuredBadge}>Key set</span>}
                      <label className={styles.toggle} onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={isEnabled} onChange={() => quickToggle(p.id)} />
                        <span className={styles.toggleSlider} />
                      </label>
                    </div>
                  </div>
                )
              })}
              <button className={`${styles.pickerCard} ${styles.pickerCardCustom}`} onClick={openCustomEditor} type="button">
                <div className={styles.pickerLogo} style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
                </div>
                <span className={styles.pickerName}>Custom</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

            {/* Trademark note */}
            <p className={styles.trademarkNote}>
              All product names, logos, and brands are property of their respective owners.
              Use of these names does not imply endorsement.
            </p>
