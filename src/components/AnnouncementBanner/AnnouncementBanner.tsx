import { useState, useEffect, useRef } from 'react'
import { getAnnouncement, type Announcement } from '../../lib/app-config'
import styles from './AnnouncementBanner.module.css'

const DISMISS_KEY = 'openthorn:announcement-dismissed'
/** Shown when admin config has no announcement — equity transfer to NixSite. */
const FALLBACK_ANNOUNCEMENT: Announcement = {
  text: 'OpenThorn continues as NixSite at BTA Labs — same free BYOK builder, no subscription.',
  link: 'https://btalabs.dev/nixsite',
  enabled: true,
}
const ANNOUNCEMENT_OFFSET_VAR = '--announcement-offset'

/** Stable id so a changed announcement re-appears after a dismissal. */
function announcementId(a: Announcement): string {
  return `${a.text}|${a.link ?? ''}`
}

export default function AnnouncementBanner() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null)
  const bannerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let cancelled = false
    getAnnouncement().then((a) => {
      if (cancelled || !a) return
      try {
        if (localStorage.getItem(DISMISS_KEY) === announcementId(a)) return
      } catch { /* storage unavailable - show the banner */ }
      setAnnouncement(a)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const root = document.documentElement
    if (!announcement || !bannerRef.current) {
      root.style.removeProperty(ANNOUNCEMENT_OFFSET_VAR)
      return
    }

    const updateOffset = () => {
      root.style.setProperty(ANNOUNCEMENT_OFFSET_VAR, `${bannerRef.current?.offsetHeight ?? 0}px`)
    }

    updateOffset()
    const resizeObserver = new ResizeObserver(updateOffset)
    resizeObserver.observe(bannerRef.current)
    window.addEventListener('resize', updateOffset)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', updateOffset)
      root.style.removeProperty(ANNOUNCEMENT_OFFSET_VAR)
    }
  }, [announcement])

  if (!announcement) return null

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, announcementId(announcement)) } catch { /* ignore */ }
    setAnnouncement(null)
  }

  return (
    <div className={styles.banner} role="status" aria-label="Site announcement" ref={bannerRef}>
      <div className={styles.inner}>
        <span className={styles.badge}>Update</span>
        <p className={styles.text}>
          <span>{announcement.text}</span>
          {announcement.link && (
            <a className={styles.link} href={announcement.link} target="_blank" rel="noreferrer">
              {/btalabs\.dev|\/nixsite|\/build/.test(announcement.link)
                ? 'Open NixSite →'
                : 'Learn more'}
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M7 17L17 7M9 7h8v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          )}
        </p>
      </div>
      <button className={styles.dismiss} type="button" aria-label="Dismiss announcement" onClick={dismiss}>
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}
