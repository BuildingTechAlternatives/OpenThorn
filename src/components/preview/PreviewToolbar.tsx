import { useState, useRef, useEffect } from 'react'
import type { CodeView } from './CodePanel'
import styles from './PreviewToolbar.module.css'

type Device = 'phone' | 'tablet' | 'pc'

interface Props {
  device: Device
  onDeviceChange: (d: Device) => void
  onOpenCode: (view: CodeView) => void
  codeOpen: boolean
}

export default function PreviewToolbar({ device, onDeviceChange, onOpenCode, codeOpen }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const moreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen && !moreOpen) return
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
        setMoreOpen(false)
      }
    }
    window.addEventListener('click', onClick)
    return () => window.removeEventListener('click', onClick)
  }, [menuOpen, moreOpen])

  return (
    <div className={styles.toolbar}>
      {/* Left section */}
      <div className={styles.left}>
        <div className={styles.routeBar}>
          <svg className={styles.routeIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="2" y1="12" x2="22" y2="12"/>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          </svg>
          <input
            className={styles.routeInput}
            type="text"
            defaultValue="/"
            placeholder="/"
          />
        </div>

        <button className={styles.iconBtn} title="Reload preview">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
        </button>
      </div>

      {/* Center — Device Switcher */}
      <div className={styles.center}>
        <div className={styles.devicePill}>
          <button
            className={`${styles.deviceBtn} ${device === 'phone' ? styles.deviceActive : ''}`}
            onClick={() => onDeviceChange('phone')}
            title="Phone view"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
              <line x1="12" y1="18" x2="12.01" y2="18"/>
            </svg>
          </button>
          <button
            className={`${styles.deviceBtn} ${device === 'tablet' ? styles.deviceActive : ''}`}
            onClick={() => onDeviceChange('tablet')}
            title="Tablet view"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="2" width="16" height="20" rx="2" ry="2"/>
              <line x1="12" y1="18" x2="12.01" y2="18"/>
            </svg>
          </button>
          <button
            className={`${styles.deviceBtn} ${device === 'pc' ? styles.deviceActive : ''}`}
            onClick={() => onDeviceChange('pc')}
            title="Desktop view"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
              <line x1="8" y1="21" x2="16" y2="21"/>
              <line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Right section */}
      <div className={styles.right}>
        {/* Menu */}
        <div className={styles.menuWrap} ref={menuRef}>
          <button
            className={`${styles.iconBtn} ${menuOpen ? styles.active : ''}`}
            onClick={() => { setMenuOpen(!menuOpen); setMoreOpen(false) }}
            title="More"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="1.8"/>
              <circle cx="12" cy="12" r="1.8"/>
              <circle cx="12" cy="19" r="1.8"/>
            </svg>
          </button>

          {menuOpen && (
            <div className={styles.dropdown}>
              <button className={styles.dropItem} onClick={() => { onOpenCode('code'); setMenuOpen(false) }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 18 22 12 16 6"/>
                  <polyline points="8 6 2 12 8 18"/>
                </svg>
                Code
              </button>

              <div className={styles.dropDivider} />

              {/* More submenu */}
              <div className={styles.moreWrap} ref={moreRef}>
                <button
                  className={styles.dropItem}
                  onClick={(e) => { e.stopPropagation(); setMoreOpen(!moreOpen) }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M8 12h8 M12 8v8"/>
                  </svg>
                  More
                  <svg className={styles.subChevron} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="9 6 15 12 9 18"/>
                  </svg>
                </button>

                {moreOpen && (
                  <div className={styles.subDropdown}>
                    <button className={styles.dropItem} onClick={() => setMenuOpen(false)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="20" x2="18" y2="10"/>
                        <line x1="12" y1="20" x2="12" y2="4"/>
                        <line x1="6" y1="20" x2="6" y2="14"/>
                      </svg>
                      Analytics
                    </button>
                    <button className={styles.dropItem} onClick={() => setMenuOpen(false)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                      </svg>
                      Cloud
                    </button>
                    <button className={styles.dropItem} onClick={() => setMenuOpen(false)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="1" x2="12" y2="23"/>
                        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                      </svg>
                      Payments
                    </button>
                    <button className={styles.dropItem} onClick={() => setMenuOpen(false)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                      </svg>
                      Security
                    </button>
                    <button className={styles.dropItem} onClick={() => setMenuOpen(false)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8"/>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                        <line x1="11" y1="8" x2="11" y2="14"/>
                        <line x1="8" y1="11" x2="14" y2="11"/>
                      </svg>
                      SEO & AI Search
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Profile */}
        <div className={styles.profile}>
          <div className={styles.avatar}>T</div>
        </div>

        {/* Action buttons */}
        <button className={styles.actionBtn}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
            <polyline points="16 6 12 2 8 6"/>
            <line x1="12" y1="2" x2="12" y2="15"/>
          </svg>
          Share
        </button>
        <button className={styles.publishBtn}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="17 1 21 5 17 9"/>
            <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
            <polyline points="7 23 3 19 7 15"/>
            <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
          </svg>
          Publish
        </button>
      </div>
    </div>
  )
}
