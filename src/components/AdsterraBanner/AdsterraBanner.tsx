import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { hasAdvertisingConsent, subscribe } from '../../lib/consent'
import styles from './AdsterraBanner.module.css'

/** Adsterra 728x90 leaderboard tag (key ff83f3c35150d2aecedaf3a3a6c536b7). */
const KEY = 'ff83f3c35150d2aecedaf3a3a6c536b7'
const SCRIPT_SRC = `https://www.highrevenueformat.com/${KEY}/invoke.js`

declare global {
  interface Window {
    /** Consumed by Adsterra's invoke.js at execution time. */
    atOptions?: Record<string, unknown>
  }
}

/**
 * Only one 728x90 tag may be active at a time. Tracked module-wide so a
 * remount always replaces the previous tag instead of stacking duplicates.
 */
let activeScript: HTMLScriptElement | null = null

interface AdsterraBannerProps {
  /** `section` for standalone page sections, `inline` inside content flow. */
  variant?: 'section' | 'inline'
}

/**
 * Renders the Adsterra 728x90 leaderboard once per page. Unlike the native
 * banner, this tag is configured through `window.atOptions` and inserts its own
 * container (`#container-<key>`) directly before the script tag — so the script
 * is appended inside our slot, never into `document.head`, and the slot is the
 * unit's positioning context.
 *
 * Consent-gated: nothing renders and the external Adsterra script is never
 * injected until the visitor has explicitly enabled Advertising/Marketing.
 */
export default function AdsterraBanner({ variant = 'section' }: AdsterraBannerProps) {
  const slotRef = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  const consented = useSyncExternalStore(subscribe, hasAdvertisingConsent, () => false)

  useEffect(() => {
    const slot = slotRef.current
    if (!consented || !slot) return

    activeScript?.remove()
    setFailed(false)
    window.atOptions = {
      key: KEY,
      format: 'iframe',
      height: 90,
      width: 728,
      params: {},
    }

    const script = document.createElement('script')
    script.async = true
    script.src = SCRIPT_SRC
    script.onerror = () => setFailed(true)
    slot.appendChild(script)
    activeScript = script

    return () => {
      script.remove()
      if (activeScript === script) activeScript = null
      slot.innerHTML = ''
      delete window.atOptions
    }
  }, [consented])

  // No consent (or a blocked/unreachable tag) — render nothing at all, so the
  // slot never appears to be part of OpenThorn's UI.
  if (!consented || failed) return null

  return (
    <aside
      className={`${styles.wrapper} ${variant === 'inline' ? styles.inline : styles.section}`}
      aria-label="Advertisement"
    >
      <span className={styles.label}>Advertisement</span>
      <div className={styles.slot} ref={slotRef} />
    </aside>
  )
}
