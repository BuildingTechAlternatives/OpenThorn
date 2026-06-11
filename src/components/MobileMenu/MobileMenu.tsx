import { useState } from 'react'
import { useAuth } from '../../lib/AuthContext'
import styles from './MobileMenu.module.css'

interface SubItem {
  label: string
  href: string
}

const solutionsSub: SubItem[] = [
  { label: 'Founders', href: '/blog/introducing-openthorn' },
  { label: 'Developers', href: '/faq' },
  { label: 'Product Managers', href: '/pricing' },
  { label: 'Designers', href: '/templates' },
  { label: 'Marketers', href: '/templates' },
  { label: 'Agencies', href: '/pricing' },
  { label: 'Ops', href: '/faq' },
]

const useCasesSub: SubItem[] = [
  { label: 'Productivity', href: '/templates' },
  { label: 'E-Commerce', href: '/templates' },
  { label: 'Marketing & Sales', href: '/templates' },
  { label: 'SaaS & Startups', href: '/templates' },
  { label: 'HR & Recruitment', href: '/templates' },
  { label: 'Education', href: '/templates' },
  { label: 'Community platforms', href: '/community' },
]

const resourcesSub: SubItem[] = [
  { label: 'Blog', href: '/blog' },
  { label: 'Changelog', href: '/changelog' },
  { label: 'Templates', href: '/templates' },
  { label: 'Docs & FAQs', href: '/faq' },
]

interface MobileMenuProps {
  isOpen: boolean
  onClose: () => void
  onSignIn: () => void
  onSignUp: () => void
}

export default function MobileMenu({ isOpen, onClose, onSignIn, onSignUp }: MobileMenuProps) {
  const { user, loading } = useAuth()
  const [openSection, setOpenSection] = useState<string | null>(null)

  const toggle = (section: string) => {
    setOpenSection((prev) => (prev === section ? null : section))
  }

  const subItems = (section: string): SubItem[] => {
    if (section === 'solutions') return solutionsSub
    if (section === 'useCases') return useCasesSub
    if (section === 'resources') return resourcesSub
    return []
  }

  const sections = [
    { key: 'solutions', label: 'Solutions' },
    { key: 'useCases', label: 'Use Cases' },
    { key: 'resources', label: 'Resources' },
  ]

  const handleSignIn = () => {
    onClose()
    onSignIn()
  }

  const handleSignUp = () => {
    onClose()
    onSignUp()
  }

  return (
    <>
      <div
        className={`${styles.overlay} ${isOpen ? styles.overlayOpen : ''}`}
        onClick={onClose}
      />
      <div className={`${styles.panel} ${isOpen ? styles.panelOpen : ''}`}>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close menu">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        <nav className={styles.nav}>
          {sections.map((s) => (
            <div key={s.key}>
              <button
                className={styles.mobileNavItem}
                onClick={() => toggle(s.key)}
              >
                {s.label}
                <svg
                  className={`${styles.chevron} ${openSection === s.key ? styles.chevronOpen : ''}`}
                  viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2"
                >
                  <path d="M3 5l4 4 4-4" />
                </svg>
              </button>
              <div className={`${styles.subItems} ${openSection === s.key ? styles.subItemsOpen : ''}`}>
                {subItems(s.key).map((item) => (
                  <a key={item.label} href={item.href} className={styles.subItem} onClick={onClose}>
                    {item.label}
                  </a>
                ))}
              </div>
            </div>
          ))}

          <a href="/pricing" className={styles.mobileNavItem} onClick={onClose}>
            Pricing
          </a>
          <a href="https://github.com/BuildingTechAlternatives/OpenThorn" className={styles.mobileNavItem} target="_blank" rel="noopener noreferrer" onClick={onClose}>
            GitHub
          </a>
        </nav>

        {!loading && (
          <div className={styles.actions}>
            {user ? (
              <a className={styles.ctaMobile} href="/dashboard" onClick={onClose}>Dashboard</a>
            ) : (
              <>
                <button className={styles.loginMobile} onClick={handleSignIn} type="button">Sign in</button>
                <button className={styles.ctaMobile} onClick={handleSignUp} type="button">Start free</button>
              </>
            )}
          </div>
        )}
      </div>
    </>
  )
}
