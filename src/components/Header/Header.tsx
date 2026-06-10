import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../lib/AuthContext'
import SlideInButton from '../SlideInButton/SlideInButton'
import NeumorphButton from '../NeumorphButton/NeumorphButton'
import MobileMenu from '../MobileMenu/MobileMenu'
import BtaMark from '../BtaMark/BtaMark'
import styles from './Header.module.css'

interface HeaderProps {
  onSignIn: () => void
  onSignUp: () => void
}

interface DropdownItem {
  label: string
  description: string
  href: string
}

const solutionsItems: DropdownItem[] = [
  { label: 'Founders', description: 'Go from idea to working MVP in hours', href: '/blog/introducing-openthorn' },
  { label: 'Developers', description: 'Scaffold full-stack apps from a description', href: '/faq' },
  { label: 'Product managers', description: 'Skip the handoff, build it directly', href: '/pricing' },
  { label: 'Designers', description: 'Turn mockups into real interfaces', href: '/templates' },
  { label: 'Marketers', description: 'Landing pages, A/B tests, campaigns', href: '/templates' },
  { label: 'Agencies', description: 'Deliver client projects in half the time', href: '/pricing' },
  { label: 'Ops', description: 'Internal tools that match your exact workflow', href: '/faq' },
]

const useCasesItems: DropdownItem[] = [
  { label: 'Productivity', description: 'Dashboards, planners, and internal tools', href: '/templates' },
  { label: 'E-Commerce & Retail', description: 'Storefronts with payments and inventory', href: '/templates' },
  { label: 'Marketing & Sales', description: 'Landing pages, funnels, and CRM portals', href: '/templates' },
  { label: 'SaaS & Startups', description: 'Waitlists, onboarding flows, and product pages', href: '/templates' },
  { label: 'HR & Recruitment', description: 'Career pages, onboarding, and team tools', href: '/templates' },
  { label: 'Education', description: 'Course platforms and learning apps', href: '/templates' },
  { label: 'Community platforms', description: 'Forums, directories, and member portals', href: '/community' },
]

const resourcesItems: DropdownItem[] = [
  { label: 'Blog', description: 'Changelog, product updates, and behind-the-scenes', href: '/blog' },
  { label: 'Templates', description: 'Jump-start your next project', href: '/templates' },
  { label: 'Docs & FAQs', description: 'How OpenThorn works, answered clearly', href: '/faq' },
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
              {col.map((item) =>
                item.href.startsWith('/') ? (
                  <Link key={item.label} to={item.href} className={styles.dropdownItem}>
                    <div className={styles.dropdownItemTitle}>{item.label}</div>
                    <div className={styles.dropdownItemDesc}>{item.description}</div>
                  </Link>
                ) : (
                  <a key={item.label} href={item.href} className={styles.dropdownItem}>
                    <div className={styles.dropdownItemTitle}>{item.label}</div>
                    <div className={styles.dropdownItemDesc}>{item.description}</div>
                  </a>
                )
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Header({ onSignIn, onSignUp }: HeaderProps) {
  const { user, loading } = useAuth()
  const [scrolled, setScrolled] = useState(false)
  const [openDropdown, setOpenDropdown] = useState<DropdownKey | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
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
    <>
      <header className={`${styles.header} ${scrolled ? styles.headerScrolled : ''}`}>
      <div className={styles.inner}>
        <a href="/" className={styles.logo}>
          <img src="/assets/logo.png" alt="" className={styles.logoImg} />
          <span className={styles.logoStack}>
            <span className={styles.logoText}>OpenThorn</span>
            <span className={styles.logoByline}>
              by
              <BtaMark className={styles.btaMark} />
            </span>
          </span>
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

          {/* Pricing */}
          <Link to="/pricing" className={styles.navItem}>
            Pricing
          </Link>

          <span className={styles.divider} />

          {/* GitHub */}
          <a href="https://github.com/thomastschinkel/OpenThorn" className={styles.navItem} target="_blank" rel="noopener noreferrer">
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
          {loading ? null : user ? (
            <>
              <div className={styles.avatar} title={user.email}>
                {user.user_metadata?.full_name
                  ? user.user_metadata.full_name.charAt(0).toUpperCase()
                  : user.email?.charAt(0).toUpperCase()}
              </div>
              <SlideInButton href="/dashboard">Dashboard</SlideInButton>
            </>
          ) : (
            <>
              <NeumorphButton onClick={onSignIn}>Sign in</NeumorphButton>
              <SlideInButton onClick={onSignUp}>Start free</SlideInButton>
            </>
          )}
          <button className={styles.mobileMenuBtn} aria-label="Menu" onClick={() => setMobileOpen(true)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
          </button>
        </div>
      </div>
    </header>
      <MobileMenu isOpen={mobileOpen} onClose={() => setMobileOpen(false)} onSignIn={onSignIn} onSignUp={onSignUp} />
    </>
  )
}
