import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { buildPreview } from '../../lib/preview-bundle'
import { TEMPLATES } from '../../lib/templates'
import styles from './LandingTemplateDemo.module.css'

// Fake build steps — each lights up in turn so it feels like the site is being
// generated live, while the real esbuild bundle runs in the background.
const BUILD_STEPS = [
  'Reading your brief',
  'Generating components',
  'Writing styles',
  'Wiring up interactions',
  'Rendering live preview',
]

// Minimum time the "generating" animation is shown, even if the real build
// finishes sooner. Keeps the illusion that work is happening right now.
const MIN_GENERATE_MS = 3600

interface Props {
  templateId: string
  onClose: () => void
}

export default function LandingTemplateDemo({ templateId, onClose }: Props) {
  const template = TEMPLATES.find((t) => t.id === templateId) ?? null
  const accent = template?.accentColor ?? '#7c6af7'

  const [phase, setPhase] = useState<'generating' | 'ready'>('generating')
  const [html, setHtml] = useState('')
  const [stepIndex, setStepIndex] = useState(0)
  const activeId = useRef<string | null>(null)

  // Kick off generation whenever the template changes.
  useEffect(() => {
    if (!template) return
    activeId.current = template.id
    setPhase('generating')
    setHtml('')

    const minDelay = new Promise<void>((res) => setTimeout(res, MIN_GENERATE_MS))
    const build = buildPreview(template.files.map((f) => ({ path: f.path, content: f.code })))

    Promise.all([build, minDelay]).then(([result]) => {
      if (activeId.current !== template.id) return
      setHtml(result.errors.length ? '' : result.html)
      setPhase('ready')
    })

    return () => { activeId.current = null }
  }, [template])

  // Advance the fake build steps while generating.
  useEffect(() => {
    if (phase !== 'generating') return
    setStepIndex(0)
    const interval = setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, BUILD_STEPS.length - 1))
    }, MIN_GENERATE_MS / (BUILD_STEPS.length + 1))
    return () => clearInterval(interval)
  }, [phase, templateId])

  // Close on Escape.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const requireSignup = () => {
    // Close this modal first so the auth overlay isn't hidden behind it.
    onClose()
    window.dispatchEvent(new CustomEvent('openthorn:require-auth', { detail: { mode: 'signup' } }))
  }

  if (!template) return null

  return (
    <motion.div
      className={styles.backdrop}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{ '--accent': accent } as React.CSSProperties}
    >
      <motion.div
        className={styles.modal}
        initial={{ opacity: 0, scale: 0.97, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 8 }}
        transition={{ duration: 0.3, ease: [0.19, 1, 0.22, 1] }}
      >
        {/* Browser chrome */}
        <div className={styles.chrome}>
          <div className={styles.dots}>
            <span /><span /><span />
          </div>
          <div className={styles.urlBar}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            {template.name.toLowerCase().replace(/\s+/g, '-')}.openthorn.app
          </div>
          <button className={styles.close} type="button" onClick={onClose} aria-label="Close">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className={styles.stage}>
          {phase === 'generating' ? (
            <div className={styles.generating}>
              <div className={styles.spinner} />
              <p className={styles.generatingTitle}>Generating {template.name}…</p>
              <ul className={styles.steps}>
                {BUILD_STEPS.map((step, i) => {
                  const state = i < stepIndex ? 'done' : i === stepIndex ? 'active' : 'pending'
                  return (
                    <li key={step} className={`${styles.step} ${styles[`step_${state}`]}`}>
                      <span className={styles.stepIcon}>
                        {state === 'done' ? (
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        ) : (
                          <span className={styles.stepDot} />
                        )}
                      </span>
                      {step}
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : html ? (
            <motion.iframe
              className={styles.previewFrame}
              srcDoc={html}
              title={`${template.name} preview`}
              sandbox="allow-scripts"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
            />
          ) : (
            <div className={styles.previewError}>Preview unavailable — but you can still build this with OpenThorn.</div>
          )}
        </div>

        {phase === 'ready' && (
          <motion.div
            className={styles.cta}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <div className={styles.ctaText}>
              <strong>Make it yours.</strong> Sign up free to edit with AI and deploy.
            </div>
            <button className={styles.ctaPrimary} type="button" onClick={requireSignup}>
              Sign up to edit &amp; deploy →
            </button>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  )
}
