import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { hasAdvertisingConsent, subscribe } from '../../lib/consent'
import styles from './AdsterraNativeBanner.module.css'

/** Adsterra native-banner tag (zone acd496412d230553ca4f4a243557f98c). */
const SCRIPT_SRC =
  'https://pl31110698.profitableratecpmnetwork.com/acd496412d230553ca4f4a243557f98c/invoke.js'
const CONTAINER_ID = 'container-acd496412d230553ca4f4a243557f98c'

/**
 * Only one Adsterra tag may be active at a time. Tracked module-wide so a
 * remount always replaces the previous tag instead of stacking duplicates.
 */
let activeScript: HTMLScriptElement | null = null

interface AdsterraNativeBannerProps {
  /** `section` for standalone page sections, `inline` inside article content. */
  variant?: 'section' | 'inline'
}

/**
 * Renders the Adsterra native banner once per page — the tag's container id is
 * fixed, so mounting two instances on the same route would break both.
 *
 * Consent-gated: nothing renders and the external Adsterra script is never
 * injected until the visitor has explicitly enabled Advertising/Marketing.
 * Granting consent mid-session loads the tag; revoking it removes the script
 * and unmounts the slot.
 */
export default function AdsterraNativeBanner({ variant = 'section' }: AdsterraNativeBannerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  const consented = useSyncExternalStore(subscribe, hasAdvertisingConsent, () => false)

  useEffect(() => {
    const container = containerRef.current
    if (!consented || !container) return

    // Adsterra's invoke.js fills whichever element matches CONTAINER_ID when it
    // executes, so re-append the tag on mount to refill a freshly mounted
    // container (route re-entry, Strict Mode double-invoke).
    activeScript?.remove()
    setFailed(false)

    const script = document.createElement('script')
    script.async = true
    script.setAttribute('data-cfasync', 'false')
    script.src = SCRIPT_SRC
    script.onerror = () => setFailed(true)
    document.head.appendChild(script)
    activeScript = script

    return () => {
      script.remove()
      if (activeScript === script) activeScript = null
      container.innerHTML = ''
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
      <div id={CONTAINER_ID} className={styles.container} ref={containerRef} />
    </aside>
  )
}
