import { useState, useEffect, useRef } from 'react'
import SlideInButton from '../SlideInButton/SlideInButton'
import NeumorphButton from '../NeumorphButton/NeumorphButton'
import styles from './Header.module.css'

interface DropdownItem {
  label: string
  description: string
  href: string
}

const solutionsItems: DropdownItem[] = [
  { label: 'Founders', description: 'Ship before you pitch', href: '#' },
  { label: 'Sales', description: 'Build the demo live', href: '#' },
  { label: 'Product managers', description: 'Prototype, don\'t spec', href: '#' },
  { label: 'Designers', description: 'Your designs, built', href: '#' },
  { label: 'Marketers', description: 'Launch pages in minutes', href: '#' },
  { label: 'Ops', description: 'Tools that fit your flow', href: '#' },
  { label: 'People', description: 'HR tools your team loves', href: '#' },
]

const useCasesItems: DropdownItem[] = [
  { label: 'Productivity', description: 'Dashboards, planners, and internal tools', href: '#' },
  { label: 'E-Commerce & Retail', description: 'Storefronts with payments and inventory', href: '#' },
  { label: 'Marketing & Sales', description: 'Landing pages, funnels, and CRM portals', href: '#' },
  { label: 'Finance', description: 'Analytics dashboards and fintech apps', href: '#' },
  { label: 'HR & Recruitment', description: 'Career pages, onboarding, and team tools', href: '#' },
  { label: 'Education', description: 'Course platforms and learning apps', href: '#' },
  { label: 'Health & Wellness', description: 'Booking, patient portals, and wellness apps', href: '#' },
]

const resourcesItems: DropdownItem[] = [
  { label: 'Blog', description: 'Stories, updates, and product news', href: '#' },
  { label: 'Templates', description: 'Start with pre-built designs', href: '#' },
  { label: 'Guides', description: 'In-depth tutorials and walkthroughs', href: '#' },
  { label: 'Docs & FAQs', description: 'Documentation and common questions', href: '#' },
]

type DropdownKey = 'solutions' | 'useCases' | 'resources'

function DropdownMenu({ items, isOpen, cols = 2 }: { items: DropdownItem[]; isOpen: boolean; cols?: number }) {
  const perCol = Math.ceil(items.length / cols)
  const columns: DropdownItem[][] = []
  for (let i = 0; i < items.length; i += perCol) {
    columns.push(items.slice(i, i + perCol))
  }

  return (
    <div className={`${styles.dropdown} ${isOpen ? styles.dropdownOpen : ''}`}>
      <div className={styles.dropdownInner}>
        <div className={styles.dropdownInnerCols} style={{ gridTemplateColumns: `repeat(${columns.length}, auto)` }}>
          {columns.map((col, ci) => (
            <div key={ci}>
              {col.map((item) => (
                <a key={item.label} href={item.href} className={styles.dropdownItem}>
                  <div className={styles.dropdownItemTitle}>{item.label}</div>
                  <div className={styles.dropdownItemDesc}>{item.description}</div>
                </a>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [openDropdown, setOpenDropdown] = useState<DropdownKey | null>(null)
  const solutionsRef = useRef<HTMLDivElement>(null)
  const useCasesRef = useRef<HTMLDivElement>(null)
  const resourcesRef = useRef<HTMLDivElement>(null)

  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const refs = [solutionsRef, useCasesRef, resourcesRef]
      if (refs.every((ref) => ref.current && !ref.current.contains(e.target as Node))) {
        setOpenDropdown(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleEnter = (key: DropdownKey) => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setOpenDropdown(key)
  }

  const handleLeave = () => {
    closeTimer.current = setTimeout(() => setOpenDropdown(null), 150)
  }

  return (
    <header className={`${styles.header} ${scrolled ? styles.headerScrolled : ''}`}>
      <div className={styles.inner}>
        <a href="/" className={styles.logo}>
          <img src="/assets/logo.png" alt="" className={styles.logoImg} />
          <span className={styles.logoText}>Bloom</span>
        </a>

        <nav className={styles.nav}>
          {/* Solutions */}
          <div
            ref={solutionsRef}
            className={styles.navItem}
            onMouseEnter={() => handleEnter('solutions')}
            onMouseLeave={handleLeave}
            role="button"
            tabIndex={0}
            aria-expanded={openDropdown === 'solutions'}
          >
            Solutions
            <svg className={`${styles.chevron} ${openDropdown === 'solutions' ? styles.chevronOpen : ''}`} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 5l4 4 4-4" />
            </svg>
            <DropdownMenu items={solutionsItems} isOpen={openDropdown === 'solutions'} />
          </div>

          <span className={styles.divider} />

          {/* Use Cases */}
          <div
            ref={useCasesRef}
            className={styles.navItem}
            onMouseEnter={() => handleEnter('useCases')}
            onMouseLeave={handleLeave}
            role="button"
            tabIndex={0}
            aria-expanded={openDropdown === 'useCases'}
          >
            Use Cases
            <svg className={`${styles.chevron} ${openDropdown === 'useCases' ? styles.chevronOpen : ''}`} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 5l4 4 4-4" />
            </svg>
            <DropdownMenu items={useCasesItems} isOpen={openDropdown === 'useCases'} />
          </div>

          <span className={styles.divider} />

          {/* GitHub */}
          <a href="https://github.com" className={styles.navItem} target="_blank" rel="noopener noreferrer">
            GitHub
          </a>

          <span className={styles.divider} />

          {/* Resources */}
          <div
            ref={resourcesRef}
            className={styles.navItem}
            onMouseEnter={() => handleEnter('resources')}
            onMouseLeave={handleLeave}
            role="button"
            tabIndex={0}
            aria-expanded={openDropdown === 'resources'}
          >
            Resources
            <svg className={`${styles.chevron} ${openDropdown === 'resources' ? styles.chevronOpen : ''}`} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 5l4 4 4-4" />
            </svg>
            <DropdownMenu items={resourcesItems} isOpen={openDropdown === 'resources'} />
          </div>
        </nav>

        <div className={styles.actions}>
          <NeumorphButton>Login</NeumorphButton>
          <SlideInButton>Get Started</SlideInButton>
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
