import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { initAnalytics } from '../../lib/analytics'
import styles from './CookieBanner.module.css'

const CONSENT_KEY = 'openthorn-cookie-consent'

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY)
    if (stored === 'accepted') {
      initAnalytics()
    } else if (!stored) {
      setVisible(true)
    }
  }, [])

  function accept() {
    localStorage.setItem(CONSENT_KEY, 'accepted')
    initAnalytics()
    setVisible(false)
  }

  function reject() {
    localStorage.setItem(CONSENT_KEY, 'rejected')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className={styles.banner} role="dialog" aria-label="Cookie consent">
      <p className={styles.text}>
        We use essential cookies to keep you signed in, and optional analytics to improve
        the service.{' '}
        <Link to="/cookies" className={styles.link}>Learn more</Link>
      </p>
      <div className={styles.actions}>
        <button onClick={reject} className={styles.reject}>Reject</button>
        <button onClick={accept} className={styles.accept}>Accept</button>
      </div>
    </div>
  )
}
