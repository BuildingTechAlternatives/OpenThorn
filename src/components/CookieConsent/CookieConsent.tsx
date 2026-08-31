import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CONSENT_OPEN_EVENT,
  getConsent,
  saveConsent,
  type ConsentState,
} from '../../lib/consent'
import styles from './CookieConsent.module.css'

type View = 'hidden' | 'banner' | 'preferences'

/**
 * Consent banner for non-essential services. Shown until a decision is stored;
 * "Advertising / Marketing" is always opt-in and defaults to off. Re-openable
 * at any time via the footer's "Cookie Settings" (CONSENT_OPEN_EVENT) so
 * consent can be changed or revoked later.
 */
export default function CookieConsent() {
  // Start hidden so prerendered HTML never contains the banner; it appears
  // after hydration only when no decision exists yet.
  const [view, setView] = useState<View>('hidden')
  const [advertising, setAdvertising] = useState(false)

  useEffect(() => {
    const stored = getConsent()
    if (stored === null) setView('banner')

    const openPreferences = () => {
      const current = getConsent()
      setAdvertising(current?.advertising === true)
      setView('preferences')
    }
    window.addEventListener(CONSENT_OPEN_EVENT, openPreferences)
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, openPreferences)
  }, [])

  const decide = (decision: ConsentState) => {
    setAdvertising(decision.advertising)
    setView('hidden')
  }

  if (view === 'hidden') return null

  if (view === 'preferences') {
    return (
      <div className={styles.overlay}>
        <section className={`${styles.panel} ${styles.preferences}`} aria-label="Cookie preferences">
          <h2 className={styles.title}>Cookie preferences</h2>
          <p className={styles.text}>
            Choose which non-essential services OpenThorn may use. Essential storage needed for
            authentication and security is always active. You can change your choice at any time
            via “Cookie Settings” in the footer. See the{' '}
            <Link to="/cookies" className={styles.link} onClick={() => setView('hidden')}>
              Cookie Policy
            </Link>
            .
          </p>

          <div className={styles.category}>
            <label className={styles.categoryHeader}>
              <input type="checkbox" checked disabled aria-label="Essential (always active)" />
              <span>Essential</span>
              <span className={styles.alwaysOn}>Always active</span>
            </label>
            <p className={styles.categoryText}>
              Sign-in sessions, security, and product features you request. These do not require
              consent.
            </p>
          </div>

          <div className={styles.category}>
            <label className={styles.categoryHeader}>
              <input
                type="checkbox"
                checked={advertising}
                onChange={(e) => setAdvertising(e.target.checked)}
                aria-label="Advertising and Marketing"
              />
              <span>Advertising / Marketing</span>
              <span className={styles.defaultOff}>Off by default</span>
            </label>
            <p className={styles.categoryText}>
              If enabled, advertising from partners such as Adsterra may load on public content
              pages. Adsterra and its partners may process data such as your IP address, browser
              and device information, ad impressions and interactions, and may use cookies or
              similar technologies for advertising, measurement, and fraud-prevention purposes.
              If disabled, no advertising scripts are loaded.
            </p>
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primary}
              onClick={() => decide(saveConsent({ advertising: true }))}
            >
              Accept all
            </button>
            <button
              type="button"
              className={styles.secondary}
              onClick={() => decide(saveConsent({ advertising: false }))}
            >
              Reject non-essential
            </button>
            <button
              type="button"
              className={styles.ghost}
              onClick={() => decide(saveConsent({ advertising }))}
            >
              Save preferences
            </button>
          </div>
        </section>
      </div>
    )
  }

  return (
    <section className={styles.panel} role="region" aria-label="Cookie consent">
      <div className={styles.bannerBody}>
        <div className={styles.bannerText}>
          <h2 className={styles.title}>Cookies &amp; privacy</h2>
          <p className={styles.text}>
            We use essential storage to run OpenThorn and cookieless analytics to keep it fast.
            Advertising (including ads from Adsterra) loads only if you enable it. See the{' '}
            <Link to="/cookies" className={styles.link} onClick={() => setView('hidden')}>
              Cookie Policy
            </Link>
            .
          </p>
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primary}
            onClick={() => decide(saveConsent({ advertising: true }))}
          >
            Accept all
          </button>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => decide(saveConsent({ advertising: false }))}
          >
            Reject non-essential
          </button>
          <button type="button" className={styles.ghost} onClick={() => setView('preferences')}>
            Manage preferences
          </button>
        </div>
      </div>
    </section>
  )
}
