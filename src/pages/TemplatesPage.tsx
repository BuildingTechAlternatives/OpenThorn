import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import { buildPreview } from '../lib/preview-bundle'
import { usePageTitle } from '../lib/usePageTitle'
import { TEMPLATES, type Template } from '../lib/templates'
import { fetchPublishedTemplates } from '../lib/templates-db'
import DashboardSidebar from '../components/DashboardSidebar/DashboardSidebar'
import ModelSelector, { type SelectedModel } from '../components/ModelSelector/ModelSelector'
import styles from './TemplatesPage.module.css'

type DeviceMode = 'desktop' | 'tablet' | 'phone'

const DEVICE_WIDTHS: Record<DeviceMode, number> = {
  desktop: 900,
  tablet: 768,
  phone: 390,
}

const CATEGORY_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  Portfolio:    { bg: 'rgba(124,106,247,.12)', color: '#9d89fb', border: 'rgba(124,106,247,.3)' },
  SaaS:         { bg: 'rgba(37,99,235,.12)',   color: '#60a5fa', border: 'rgba(37,99,235,.3)'   },
  'E-commerce': { bg: 'rgba(26,92,58,.18)',    color: '#4ade80', border: 'rgba(26,92,58,.4)'    },
}

export default function TemplatesPage() {
  usePageTitle('Templates', {
    description: 'Start a new OpenThorn project from a ready-made website template.',
  })
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [htmlMap, setHtmlMap] = useState<Record<string, string>>({})
  const [selected, setSelected] = useState<Template | null>(null)
  const [deviceMode, setDeviceMode] = useState<DeviceMode>('desktop')
  const [selectedModel, setSelectedModel] = useState<SelectedModel | null>(null)
  const [launching, setLaunching] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  // Bundled templates render instantly; published DB templates replace them when present.
  const [templates, setTemplates] = useState<Template[]>(TEMPLATES)

  useEffect(() => {
    fetchPublishedTemplates().then(t => { if (t && t.length) setTemplates(t) })
  }, [])

  // Build live previews for all templates
  useEffect(() => {
    for (const template of templates) {
      buildPreview(template.files.map(f => ({ path: f.path, content: f.code }))).then(result => {
        if (!result.errors.length) {
          setHtmlMap(prev => ({ ...prev, [template.id]: result.html }))
        }
      })
    }
  }, [templates])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelected(null) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const handleUseTemplate = useCallback(async () => {
    if (!user || !selected) return
    setLaunching(true)
    const projectId = crypto.randomUUID()
    const { error } = await supabase.from('projects').upsert({
      id: projectId,
      user_id: user.id,
      title: selected.name,
      preview_url: null,
      created_at: new Date().toISOString(),
    }, { onConflict: 'id' })

    if (error) {
      console.error('Failed to create project:', error.message)
      setLaunching(false)
      return
    }

    navigate(`/projects/${projectId}`, {
      state: {
        title: selected.name,
        templateFiles: selected.files,
        isTemplate: true,
        templateName: selected.name,
        selectedModel,
        thinkingLevel: 'medium',
      },
    })
  }, [user, selected, selectedModel, navigate])

  if (loading) return null

  const iframeWidth = DEVICE_WIDTHS[deviceMode]

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
        <div className={styles.header}>
          <h1 className={styles.heading}>Start from a template</h1>
          <p className={styles.subheading}>Production-quality starting points. Customize with AI.</p>
        </div>

        <div className={styles.grid}>
          {templates.map(template => {
            const colors = CATEGORY_COLORS[template.category] ?? CATEGORY_COLORS['SaaS']
            return (
              <div
                key={template.id}
                className={styles.card}
                onClick={() => { setSelected(template); setDeviceMode('desktop') }}
                role="button"
                tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter') { setSelected(template); setDeviceMode('desktop') } }}
              >
                <div className={styles.thumbnailWrapper}>
                  {htmlMap[template.id] ? (
                    <iframe
                      className={styles.thumbnail}
                      srcDoc={htmlMap[template.id]}
                      title={template.name}
                      sandbox="allow-scripts"
                    />
                  ) : (
                    <div className={styles.thumbnailLoading}>Rendering preview…</div>
                  )}
                  <div className={styles.previewOverlay}>
                    <button className={styles.previewBtn} type="button" tabIndex={-1}>Preview</button>
                  </div>
                </div>
                <div className={styles.cardBody}>
                  <div className={styles.cardTop}>
                    <h2 className={styles.cardName}>{template.name}</h2>
                    <span
                      className={styles.categoryBadge}
                      style={{ background: colors.bg, color: colors.color, borderColor: colors.border }}
                    >
                      {template.category}
                    </span>
                  </div>
                  <p className={styles.cardDesc}>{template.description}</p>
                </div>
              </div>
            )
          })}
        </div>
      </main>

      {/* Full-screen preview overlay */}
      {selected && (() => {
        const colors = CATEGORY_COLORS[selected.category] ?? CATEGORY_COLORS['SaaS']
        return (
          <div
            className={styles.overlayBackdrop}
            onClick={e => { if (e.target === e.currentTarget) setSelected(null) }}
          >
            <div className={styles.overlayContent}>

              {/* Live preview pane */}
              <div className={styles.overlayPreview}>
                <div className={styles.overlayTopbar}>
                  <button
                    className={styles.overlayClose}
                    type="button"
                    onClick={() => setSelected(null)}
                    aria-label="Close preview"
                  >
                    ✕
                  </button>
                  <div className={styles.deviceBtns}>
                    {(['desktop', 'tablet', 'phone'] as DeviceMode[]).map(d => (
                      <button
                        key={d}
                        type="button"
                        className={`${styles.deviceBtn} ${deviceMode === d ? styles.deviceBtnActive : ''}`}
                        onClick={() => setDeviceMode(d)}
                        aria-label={`${d} preview`}
                      >
                        {d === 'desktop' ? <DesktopIcon /> : d === 'tablet' ? <TabletIcon /> : <PhoneIcon />}
                      </button>
                    ))}
                  </div>
                </div>
                <div className={styles.overlayIframeWrapper}>
                  <div
                    className={styles.overlayIframeContainer}
                    style={{ maxWidth: deviceMode === 'desktop' ? 'none' : iframeWidth }}
                  >
                    <iframe
                      key={selected.id}
                      srcDoc={htmlMap[selected.id] || ''}
                      className={styles.overlayIframe}
                      title={`${selected.name} preview`}
                      sandbox="allow-scripts"
                    />
                  </div>
                </div>
              </div>

              {/* Info panel */}
              <div className={styles.overlayPanel}>
                <span
                  className={styles.categoryBadge}
                  style={{ background: colors.bg, color: colors.color, borderColor: colors.border, display: 'inline-block' }}
                >
                  {selected.category}
                </span>
                <h2 className={styles.overlayName}>{selected.name}</h2>
                <p className={styles.overlayDesc}>{selected.description}</p>

                <p className={styles.highlightsLabel}>What's included</p>
                <div className={styles.highlights}>
                  {selected.highlights.map(h => (
                    <div key={h} className={styles.highlightItem}>
                      <span className={styles.highlightDot} style={{ color: colors.color }} />
                      {h}
                    </div>
                  ))}
                </div>

                <div className={styles.modelSection}>
                  <span className={styles.modelLabel}>Select model to customize with (optional)</span>
                  <ModelSelector
                    page="dashboard"
                    selectedModel={selectedModel}
                    onModelSelect={setSelectedModel}
                    placement="bottom"
                    subLayout="stacked"
                  />
                </div>

                <div className={styles.spacer} />

                <button
                  className={styles.useBtn}
                  type="button"
                  onClick={handleUseTemplate}
                  disabled={launching}
                  style={{ background: selected.accentColor }}
                >
                  {launching ? 'Starting…' : 'Use this template →'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

function DesktopIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>
}

function TabletIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M11 18h2"/></svg>
}

function PhoneIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/></svg>
}
