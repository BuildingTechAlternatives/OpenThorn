import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'
import {
  DEFAULT_PROVIDER_MODELS,
  LOGO_MAP,
  PROVIDER_DEFS,
  parseProviderModels,
} from '../../lib/providers'
import { getDisabledProviders } from '../../lib/app-config'
import styles from './ModelSelector.module.css'

// ── Types ──────────────────────────────────────────────

export interface SelectedModel {
  provider_id: string
  provider_name: string
  model_name: string
  model_id: string
}

interface ModelInfo {
  name: string
  id: string
  recommended?: boolean
  cheapest?: boolean
}

interface ProviderGroup {
  provider_id: string
  provider_name: string
  color: string
  logo: string
  models: ModelInfo[]
}

interface ModelSelectorProps {
  page: 'landing' | 'dashboard'
  selectedModel: SelectedModel | null
  onModelSelect: (model: SelectedModel) => void
  placement?: 'bottom' | 'top'
  subDirection?: 'right' | 'left'
  subLayout?: 'side' | 'stacked'
}

// ── Constants ──────────────────────────────────────────

const LANDING_PROVIDERS = ['anthropic', 'openai', 'google']

// ── Helpers ────────────────────────────────────────────

// ── Component ──────────────────────────────────────────

export default function ModelSelector({ page, selectedModel, onModelSelect, placement = 'bottom', subDirection = 'right', subLayout = 'side' }: ModelSelectorProps) {
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [hoveredProvider, setHoveredProvider] = useState<string | null>(null)
  const [providers, setProviders] = useState<ProviderGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clear close timer
  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  // Delayed close
  const scheduleClose = useCallback(() => {
    clearCloseTimer()
    closeTimerRef.current = setTimeout(() => {
      setIsOpen(false)
    }, 150)
  }, [clearCloseTimer])

  // Click outside handler
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  // ── Data fetching ──────────────────────────────────

  useEffect(() => {
    let cancelled = false

    async function fetchData() {
      setLoading(true)
      setFetchError(false)

      const disabled = new Set(await getDisabledProviders())

      if (page === 'landing') {
        const { data, error } = await supabase
          .from('default_models')
          .select('*')
          .in('provider_id', LANDING_PROVIDERS)

        if (error && !cancelled) {
          setFetchError(true)
          setLoading(false)
          return
        }

        if (!cancelled && data) {
          const groups: ProviderGroup[] = LANDING_PROVIDERS.map((pid) => {
            const row = data.find((d: { provider_id: string }) => d.provider_id === pid)
            const def = PROVIDER_DEFS[pid]
            return {
              provider_id: pid,
              provider_name: def?.name ?? pid,
              color: def?.color ?? '#888',
              logo: LOGO_MAP[pid] ?? '',
              models: row ? parseProviderModels(row.models) : DEFAULT_PROVIDER_MODELS[pid] ?? [],
            }
          }).filter((g) => g.models.length > 0 && !disabled.has(g.provider_id))

          setProviders(groups)
        }
      } else {
        if (!user) { setLoading(false); return }

        const { data: keys, error: keysError } = await supabase
          .from('provider_keys')
          .select('*')
          .eq('user_id', user.id)
          .eq('enabled', true)

        if (keysError && !cancelled) {
          setFetchError(true)
          setLoading(false)
          return
        }

        if (!cancelled && keys && keys.length > 0) {
          const providerIds = [...new Set(keys.map((k: { provider_id: string }) => k.provider_id))]

          const { data: defaults } = await supabase
            .from('default_models')
            .select('*')
            .in('provider_id', providerIds)

          const defaultMap: Record<string, ModelInfo[]> = {}
          if (defaults) {
            defaults.forEach((d: { provider_id: string; models: string }) => {
              defaultMap[d.provider_id] = parseProviderModels(d.models)
            })
          }

          const groups: ProviderGroup[] = keys.map((k: { provider_id: string; provider_name: string; models: string }) => {
            const def = PROVIDER_DEFS[k.provider_id]
            const defaultModels = defaultMap[k.provider_id] ?? DEFAULT_PROVIDER_MODELS[k.provider_id] ?? []
            const customModels = parseProviderModels(k.models ?? '')
            const seen = new Set(defaultModels.map((m) => m.id))
            const merged = [...defaultModels, ...customModels.filter((m) => !seen.has(m.id))]

            return {
              provider_id: k.provider_id,
              provider_name: def?.name ?? k.provider_name ?? k.provider_id,
              color: def?.color ?? '#888',
              logo: LOGO_MAP[k.provider_id] ?? '',
              models: merged,
            }
          }).filter((g) => g.models.length > 0 && !disabled.has(g.provider_id))

          setProviders(groups)
        } else {
          setProviders([])
        }
      }

      if (!cancelled) setLoading(false)
    }

    fetchData()
    return () => { cancelled = true }
  }, [page, user])

  // Reset hovered provider when dropdown closes
  useEffect(() => {
    if (!isOpen) {
      setHoveredProvider(null)
    }
  }, [isOpen])

  // ── Handlers ───────────────────────────────────────

  const handleMouseEnter = () => {
    clearCloseTimer()
    if (!isOpen) {
      setIsOpen(true)
    }
  }

  const handleMouseLeave = () => {
    scheduleClose()
  }

  const handleProviderHover = (providerId: string) => {
    clearCloseTimer()
    setHoveredProvider(providerId)
  }

  const handleModelClick = (provider: ProviderGroup, model: ModelInfo) => {
    onModelSelect({
      provider_id: provider.provider_id,
      provider_name: provider.provider_name,
      model_name: model.name,
      model_id: model.id,
    })
    setIsOpen(false)
  }

  // ── Derived ────────────────────────────────────────

  const activeProvider = providers.find((p) => p.provider_id === hoveredProvider)

  // ── Render ─────────────────────────────────────────

  const showPlaceholder = loading || fetchError || providers.length === 0
  const dashboardEmpty = page === 'dashboard' && !loading && !fetchError && providers.length === 0

  return (
    <div
      ref={containerRef}
      className={styles.container}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Trigger button — icon-only when nothing selected */}
      <button type="button" className={selectedModel ? styles.triggerHasSelection : styles.trigger} aria-haspopup="listbox" aria-expanded={isOpen}>
        {selectedModel ? (
          <>
            <img
              src={LOGO_MAP[selectedModel.provider_id]}
              alt=""
              className={styles.triggerIcon}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
            <span className={styles.triggerLabel}>{selectedModel.model_name}</span>
          </>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={styles.triggerIconFallback}>
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
        )}
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className={`${styles.dropdown} ${placement === 'top' ? styles.dropdownTop : ''} ${subDirection === 'left' ? styles.dropdownSubLeft : ''}`}
            initial={{ opacity: 0, y: placement === 'top' ? 6 : -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: placement === 'top' ? 6 : -6, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.19, 1, 0.22, 1] }}
          >
            {showPlaceholder ? (
              <div className={styles.emptyState}>
                {loading ? 'Loading models…' : fetchError ? 'Failed to load models' : dashboardEmpty ? 'No providers enabled' : 'No models available'}
              </div>
            ) : (
              <>
                {/* Provider list — vertical */}
                <div className={styles.providerList}>
                  {providers.map((p) => {
                    const isSelected = selectedModel?.provider_id === p.provider_id
                    const isExpanded = hoveredProvider === p.provider_id
                    return (
                      <div key={p.provider_id}>
                        <button
                          type="button"
                          className={`${styles.providerRow} ${isExpanded ? styles.providerRowActive : ''}`}
                          onMouseEnter={() => handleProviderHover(p.provider_id)}
                          onClick={() => handleProviderHover(p.provider_id)}
                          style={{ '--provider-color': p.color } as React.CSSProperties}
                        >
                          <img
                            src={p.logo}
                            alt={p.provider_name}
                            className={styles.providerRowIcon}
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                          />
                          <span className={styles.providerRowName}>{p.provider_name}</span>
                          {isSelected && (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className={styles.checkIcon}>
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className={`${styles.providerRowChevron} ${subLayout === 'stacked' ? styles.providerRowChevronToggle : ''}`} style={subLayout === 'stacked' ? { transform: isExpanded ? 'rotate(90deg)' : undefined, transition: 'transform 0.15s' } : undefined}>
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </button>

                        {/* Stacked inline models */}
                        {subLayout === 'stacked' && isExpanded && (
                          <div className={styles.inlineModels}>
                            {p.models.map((m) => {
                              const isModelSelected = selectedModel?.provider_id === p.provider_id && selectedModel?.model_id === m.id
                              return (
                                <button
                                  key={m.id}
                                  type="button"
                                  className={`${styles.modelItem} ${isModelSelected ? styles.modelItemSelected : ''}`}
                                  onClick={() => handleModelClick(p, m)}
                                >
                                  <span className={styles.modelItemName}>{m.name}</span>
                                  {m.recommended && <span className={styles.recommendedBadge}>Recommended</span>}
                                  {m.cheapest && <span className={styles.cheapestBadge}>Cheap</span>}
                                  {isModelSelected && (
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className={styles.checkIcon}>
                                      <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                  )}
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Side sub-overlay — slides out to the right (side layout only) */}
                {subLayout === 'side' && (
                  <AnimatePresence>
                    {activeProvider && (
                      <motion.div
                        key={activeProvider.provider_id}
                        className={styles.subOverlay}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -6 }}
                        transition={{ duration: 0.15, ease: [0.19, 1, 0.22, 1] }}
                      >
                        <div className={styles.subOverlayHeader}>
                          {activeProvider.provider_name}
                        </div>
                        <div className={styles.modelList}>
                          {activeProvider.models.map((m) => {
                            const isSelected =
                              selectedModel?.provider_id === activeProvider.provider_id &&
                              selectedModel?.model_id === m.id
                            return (
                              <button
                                key={m.id}
                                type="button"
                                className={`${styles.modelItem} ${isSelected ? styles.modelItemSelected : ''}`}
                                onClick={() => handleModelClick(activeProvider, m)}
                              >
                                <span className={styles.modelItemName}>{m.name}</span>
                                {m.recommended && <span className={styles.recommendedBadge}>Recommended</span>}
                                {m.cheapest && <span className={styles.cheapestBadge}>Cheap</span>}
                                {isSelected && (
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className={styles.checkIcon}>
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                )}
                              </button>
                            )
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
