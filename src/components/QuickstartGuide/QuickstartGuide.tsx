import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { QUICKSTART_SLIDES } from '../../lib/quickstart'
import styles from './QuickstartGuide.module.css'

interface QuickstartGuideProps {
  firstName: string
  /** Called whenever the guide is dismissed (finish, navigate, or close). The
   *  parent persists the has_seen_quickstart flag here. */
  onClose: () => void
}

export default function QuickstartGuide({ firstName, onClose }: QuickstartGuideProps) {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const slide = QUICKSTART_SLIDES[step]
  const isFirst = step === 0
  const total = QUICKSTART_SLIDES.length

  const handleAction = useCallback(() => {
    const action = slide.action
    if (action.type === 'advance') {
      setStep((s) => Math.min(s + 1, total - 1))
      return
    }
    // Both 'finish' and 'navigate' dismiss the guide.
    onClose()
    if (action.type === 'navigate') {
      navigate(action.to, action.state ? { state: action.state } : undefined)
    }
  }, [slide, onClose, navigate, total])

  // Escape closes the guide.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const heading = slide.id === 'welcome'
    ? `Welcome to OpenThorn, ${firstName}`
    : slide.heading

  return (
    <div
      className={styles.backdrop}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      role="dialog"
      aria-modal="true"
      aria-label="Quickstart guide"
    >
      <div className={styles.modal}>
        <button className={styles.close} type="button" onClick={onClose} aria-label="Close quickstart">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <span className={styles.eyebrow}>Getting started · {step + 1}/{total}</span>
        <h2 className={styles.heading}>{heading}</h2>
        <p className={styles.body}>{slide.body}</p>

        <div className={styles.dots} aria-hidden="true">
          {QUICKSTART_SLIDES.map((s, i) => (
            <span key={s.id} className={`${styles.dot} ${i === step ? styles.dotActive : ''}`} />
          ))}
        </div>

        <div className={styles.actions}>
          {!isFirst && (
            <button
              className={styles.back}
              type="button"
              onClick={() => setStep((s) => Math.max(s - 1, 0))}
            >
              Back
            </button>
          )}
          <button className={styles.primary} type="button" onClick={handleAction}>
            {slide.action.label}
          </button>
        </div>

        <button className={styles.skip} type="button" onClick={onClose}>
          Skip for now
        </button>
      </div>
    </div>
  )
}
