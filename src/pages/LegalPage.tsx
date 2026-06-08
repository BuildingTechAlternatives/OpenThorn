import { useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import styles from './LegalPage.module.css'

interface Props {
  title: string
  lastUpdated: string
  children: React.ReactNode
}

interface TocEntry {
  id: string
  text: string
}

const DOC_NAV = [
  { path: '/terms', label: 'Terms of Service' },
  { path: '/privacy', label: 'Privacy Policy' },
  { path: '/cookies', label: 'Cookie Policy' },
  { path: '/moderation', label: 'Moderation & DSA' },
  { path: '/imprint', label: 'Imprint' },
]

export default function LegalPage({ title, lastUpdated, children }: Props) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [toc, setToc] = useState<TocEntry[]>([])
  const [activeId, setActiveId] = useState<string>('')

  // Build TOC by scanning h2s and injecting ids
  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    const headings = Array.from(el.querySelectorAll('h2'))
    const entries = headings.map((h, i) => {
      const id = `section-${i + 1}`
      h.id = id
      return { id, text: h.textContent ?? '' }
    })
    setToc(entries)
  }, [children])

  // Track active section via IntersectionObserver
  useEffect(() => {
    if (toc.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
            break
          }
        }
      },
      { rootMargin: '-10% 0px -80% 0px', threshold: 0 }
    )
    toc.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [toc])

  return (
    <div className={styles.page}>
      <div className={styles.container}>

        {/* Doc nav */}
        <nav className={styles.docNav}>
          {DOC_NAV.map(({ path, label }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                [styles.docNavLink, isActive ? styles.docNavLinkActive : ''].filter(Boolean).join(' ')
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Header */}
        <header className={styles.header}>
          <h1 className={styles.title}>{title}</h1>
          <span className={styles.badge}>Last updated: {lastUpdated}</span>
        </header>
        <hr className={styles.divider} />

        {/* Mobile TOC */}
        <div className={styles.mobileToc}>
          {toc.map(({ id, text }) => (
            <a
              key={id}
              href={`#${id}`}
              className={[styles.mobileTocPill, activeId === id ? styles.mobileTocPillActive : ''].filter(Boolean).join(' ')}
            >
              {text}
            </a>
          ))}
        </div>

        {/* Two-column body */}
        <div className={styles.body}>

          {/* Sticky TOC sidebar */}
          <aside className={styles.toc}>
            <p className={styles.tocLabel}>Contents</p>
            <nav>
              {toc.map(({ id, text }) => (
                <a
                  key={id}
                  href={`#${id}`}
                  className={[styles.tocLink, activeId === id ? styles.tocLinkActive : ''].filter(Boolean).join(' ')}
                >
                  {text}
                </a>
              ))}
            </nav>
          </aside>

          {/* Content */}
          <div className={styles.content} ref={contentRef}>
            {children}
          </div>

        </div>
      </div>
    </div>
  )
}
