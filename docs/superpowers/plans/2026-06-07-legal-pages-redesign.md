# Legal Pages Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade `LegalPage` into a professional two-column layout with a sticky TOC, doc nav bar, and polished typography using the design system tokens.

**Architecture:** All changes are confined to `LegalPage.tsx` and `LegalPage.module.css`. `LegalPage` gains a doc nav bar, a header zone, and a two-column grid (sticky left TOC + content). The TOC is auto-generated at mount by scanning rendered `h2` elements and injecting `id` attributes. Active section is tracked via `IntersectionObserver`. The three content pages (`TermsPage`, `PrivacyPage`, `CookiesPage`) are untouched.

**Tech Stack:** React 18, React Router v6 `NavLink`, CSS Modules, CSS custom properties from `src/index.css`

---

### Task 1: Rewrite `LegalPage.module.css`

**Files:**
- Modify: `src/pages/LegalPage.module.css`

- [ ] **Step 1: Replace the entire file with the new styles**

Open `src/pages/LegalPage.module.css` and replace its full contents with:

```css
/* ===== Page shell ===== */
.page {
  min-height: calc(100vh - var(--header-height));
  padding: var(--space-3xl) var(--space-lg) var(--space-6xl);
}

.container {
  max-width: 900px;
  margin: 0 auto;
}

/* ===== Doc nav bar ===== */
.docNav {
  display: flex;
  gap: var(--space-sm);
  margin-bottom: var(--space-2xl);
  flex-wrap: wrap;
}

.docNavLink {
  padding: 6px 14px;
  border-radius: var(--radius-full);
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-text-muted);
  text-decoration: none;
  border: 1px solid transparent;
  transition: color 0.15s, background 0.15s, border-color 0.15s;
}

.docNavLink:hover {
  color: var(--color-text-secondary);
  border-color: var(--color-border-visible);
}

.docNavLinkActive {
  color: var(--color-accent);
  background: var(--color-accent-subtle);
  border-color: var(--color-border-glow);
}

/* ===== Header ===== */
.header {
  margin-bottom: var(--space-lg);
}

.title {
  font-family: var(--font-display);
  font-size: clamp(1.8rem, 4vw, 2.75rem);
  font-weight: 700;
  color: var(--color-text);
  line-height: 1.2;
  margin: 0 0 var(--space-sm);
}

.badge {
  display: inline-block;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  border: 1px solid var(--color-border-visible);
  border-radius: var(--radius-full);
  padding: 3px 10px;
}

.divider {
  border: none;
  border-top: 1px solid var(--color-border-visible);
  margin: 0 0 var(--space-2xl);
}

/* ===== Mobile TOC (hidden on desktop) ===== */
.mobileToc {
  display: none;
}

.mobileTocPill {
  display: inline-block;
  white-space: nowrap;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  border: 1px solid var(--color-border-visible);
  border-radius: var(--radius-full);
  padding: 4px 12px;
  text-decoration: none;
  flex-shrink: 0;
  transition: color 0.15s, background 0.15s, border-color 0.15s;
}

.mobileTocPill:hover {
  color: var(--color-text-secondary);
}

.mobileTocPillActive {
  color: var(--color-accent);
  background: var(--color-accent-subtle);
  border-color: var(--color-border-glow);
}

/* ===== Two-column body ===== */
.body {
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: var(--space-3xl);
  align-items: start;
}

/* ===== TOC sidebar ===== */
.toc {
  position: sticky;
  top: calc(var(--header-height) + var(--space-lg));
  max-height: calc(100vh - var(--header-height) - var(--space-xl));
  overflow-y: auto;
}

.tocLabel {
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-text-muted);
  margin: 0 0 var(--space-md);
}

.tocLink {
  display: block;
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  text-decoration: none;
  padding: 5px 0 5px 12px;
  border-left: 2px solid transparent;
  line-height: 1.4;
  margin-bottom: 2px;
  transition: color 0.15s, border-color 0.15s;
}

.tocLink:hover {
  color: var(--color-text);
}

.tocLinkActive {
  color: var(--color-text);
  border-left-color: var(--color-accent);
}

/* ===== Content ===== */
.content {
  color: var(--color-text-secondary);
  font-size: 1rem;
  line-height: 1.75;
  min-width: 0;
}

.content h2 {
  font-family: var(--font-display);
  font-size: 1.35rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 2.75rem 0 0.875rem;
  line-height: 1.3;
  padding: 4px 0 4px 12px;
  border-left: 2px solid var(--color-accent);
  background: linear-gradient(90deg, var(--color-accent-wash) 0%, transparent 70%);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}

.content p {
  margin: 0 0 1.1rem;
}

.content ul,
.content ol {
  margin: 0 0 1.1rem 1.5rem;
  padding: 0;
}

.content li {
  margin-bottom: 0.35rem;
}

.content a {
  color: var(--color-accent);
  text-underline-offset: 3px;
  transition: filter 0.15s;
}

.content a:hover {
  filter: brightness(1.15);
}

.content strong {
  color: var(--color-text);
  font-weight: 600;
}

.content code {
  font-family: var(--font-mono);
  font-size: 0.875em;
  color: var(--color-accent);
  background: var(--color-accent-subtle);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
}

/* ===== Mobile ===== */
@media (max-width: 768px) {
  .body {
    grid-template-columns: 1fr;
  }

  .toc {
    display: none;
  }

  .mobileToc {
    display: flex;
    gap: var(--space-sm);
    overflow-x: auto;
    padding-bottom: var(--space-sm);
    margin-bottom: var(--space-xl);
    scrollbar-width: none;
  }

  .mobileToc::-webkit-scrollbar {
    display: none;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/LegalPage.module.css
git commit -m "style: rewrite LegalPage CSS with design system tokens and two-column layout"
```

---

### Task 2: Rewrite `LegalPage.tsx`

**Files:**
- Modify: `src/pages/LegalPage.tsx`

- [ ] **Step 1: Replace the entire file**

Open `src/pages/LegalPage.tsx` and replace its full contents with:

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/LegalPage.tsx
git commit -m "feat: professional legal page layout with sticky TOC, doc nav, and design system polish"
```

---

### Task 3: Visual verification

**Files:** (read-only)

- [ ] **Step 1: Run the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Check each legal page**

Open each URL and verify:

| URL | Check |
|-----|-------|
| `http://localhost:5173/terms` | Active pill = "Terms of Service", TOC shows 15 entries, active section tracks on scroll |
| `http://localhost:5173/privacy` | Active pill = "Privacy Policy", TOC entries match h2 headings |
| `http://localhost:5173/cookies` | Active pill = "Cookie Policy", TOC entries match h2 headings |

- [ ] **Step 3: Check mobile layout**

In browser devtools, set viewport to 375px wide. Verify:
- Sticky sidebar is hidden
- Horizontal pill scroller appears above content
- Active pill updates as user scrolls

- [ ] **Step 4: Commit any fixes found during verification, then done**
