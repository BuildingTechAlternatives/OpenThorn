import { useState, useEffect, useRef } from 'react'
import styles from './Header.module.css'

interface DropdownItem {
  label: string
  description: string
  href: string
}

const solutionsItems: DropdownItem[] = [
  { label: 'For Designers', description: 'Turn Figma ideas into code', href: '#' },
  { label: 'For Developers', description: 'Prototype faster with AI', href: '#' },
  { label: 'For Startups', description: 'Launch MVPs in hours', href: '#' },
  { label: 'For Agencies', description: 'Deliver client projects at speed', href: '#' },
]

const resourcesItems: DropdownItem[] = [
  { label: 'Documentation', description: 'Learn how to use Bloom', href: '#' },
  { label: 'API Reference', description: 'Integrate with our API', href: '#' },
  { label: 'Templates', description: 'Start with pre-built designs', href: '#' },
  { label: 'Blog', description: 'Stories and updates', href: '#' },
]

export default function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [openDropdown, setOpenDropdown] = useState<'solutions' | 'resources' | null>(null)
  const solutionsRef = useRef<HTMLDivElement>(null)
  const resourcesRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        solutionsRef.current && !solutionsRef.current.contains(e.target as Node) &&
        resourcesRef.current && !resourcesRef.current.contains(e.target as Node)
      ) {
        setOpenDropdown(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <header className={`${styles.header} ${scrolled ? styles.headerScrolled : ''}`}>
      <div className={styles.inner}>
        <a href="/" className={styles.logo}>
          <img src="/assets/logo.png" alt="" className={styles.logoImg} />
          <span className={styles.logoText}>Bloom</span>
        </a>

        <nav className={styles.nav}>
          <div
            ref={solutionsRef}
            className={styles.navItem}
            onMouseEnter={() => setOpenDropdown('solutions')}
            onMouseLeave={() => setOpenDropdown(null)}
            role="button"
            tabIndex={0}
            aria-expanded={openDropdown === 'solutions'}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setOpenDropdown(openDropdown === 'solutions' ? null : 'solutions') }}
          >
            Solutions
            <svg className={`${styles.chevron} ${openDropdown === 'solutions' ? styles.chevronOpen : ''}`} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 5l4 4 4-4" />
            </svg>
            <div className={`${styles.dropdown} ${openDropdown === 'solutions' ? styles.dropdownOpen : ''}`}>
              <div className={styles.dropdownInner}>
                {solutionsItems.map((item) => (
                  <a key={item.label} href={item.href} className={styles.dropdownItem}>
                    <div className={styles.dropdownItemTitle}>{item.label}</div>
                    <div className={styles.dropdownItemDesc}>{item.description}</div>
                  </a>
                ))}
              </div>
            </div>
          </div>

          <a href="https://github.com" className={styles.navItem} target="_blank" rel="noopener noreferrer">
            GitHub
          </a>

          <div
            ref={resourcesRef}
            className={styles.navItem}
            onMouseEnter={() => setOpenDropdown('resources')}
            onMouseLeave={() => setOpenDropdown(null)}
            role="button"
            tabIndex={0}
            aria-expanded={openDropdown === 'resources'}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setOpenDropdown(openDropdown === 'resources' ? null : 'resources') }}
          >
            Resources
            <svg className={`${styles.chevron} ${openDropdown === 'resources' ? styles.chevronOpen : ''}`} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 5l4 4 4-4" />
            </svg>
            <div className={`${styles.dropdown} ${openDropdown === 'resources' ? styles.dropdownOpen : ''}`}>
              <div className={styles.dropdownInner}>
                {resourcesItems.map((item) => (
                  <a key={item.label} href={item.href} className={styles.dropdownItem}>
                    <div className={styles.dropdownItemTitle}>{item.label}</div>
                    <div className={styles.dropdownItemDesc}>{item.description}</div>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </nav>

        <div className={styles.actions}>
          <button className={styles.loginBtn}>Login</button>
          <button className={styles.ctaBtn}>Get Started</button>
          <button className={styles.mobileMenuBtn} aria-label="Menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  )
}
