# Bloom Homepage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Bloom marketing homepage with all 6 sections (Header, Hero, Meet Bloom, BYOK Detail, Bottom CTA, Footer) using the Organic Modern design system.

**Architecture:** Single-page React 19 app with TypeScript, CSS Modules for scoped styling, and Framer Motion for animations. Each section is a self-contained component with its own styles. No routing needed — everything renders on one page. Google Fonts (Fraunces + DM Sans) loaded via CSS `@import`.

**Tech Stack:** Vite 8, React 19, TypeScript 6, CSS Modules, Framer Motion 12

---

## File Structure

```
bloom/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── eslint.config.js
├── public/
│   └── favicon.svg
├── assets/
│   └── logo.png              (already exists)
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── App.module.css
    ├── index.css              (global styles + CSS variables + fonts)
    ├── vite-env.d.ts
    └── components/
        ├── Header/
        │   ├── Header.tsx
        │   └── Header.module.css
        ├── HeroSection/
        │   ├── HeroSection.tsx
        │   └── HeroSection.module.css
        ├── MeetBloomSection/
        │   ├── MeetBloomSection.tsx
        │   └── MeetBloomSection.module.css
        ├── BYOKSection/
        │   ├── BYOKSection.tsx
        │   └── BYOKSection.module.css
        ├── BottomCTA/
        │   ├── BottomCTA.tsx
        │   └── BottomCTA.module.css
        ├── Footer/
        │   ├── Footer.tsx
        │   └── Footer.module.css
        └── PromptInput/
            ├── PromptInput.tsx
            └── PromptInput.module.css
```

---

### Task 1: Project Scaffold

**Files:**
- Create: `index.html`
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.app.json`
- Create: `tsconfig.node.json`
- Create: `eslint.config.js`
- Create: `public/favicon.svg`
- Create: `src/vite-env.d.ts`

- [ ] **Step 1: Create index.html**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="Bloom — Build beautiful websites by talking to AI. BYOK. No hidden costs." />
    <title>Bloom — Build with AI</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Create package.json**

```json
{
  "name": "bloom",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "preview": "vite preview"
  },
  "dependencies": {
    "framer-motion": "^12.12.1",
    "react": "^19.2.6",
    "react-dom": "^19.2.6"
  },
  "devDependencies": {
    "@eslint/js": "^9.39.1",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^4.7.0",
    "eslint": "^9.39.1",
    "eslint-plugin-react-hooks": "^5.2.0",
    "eslint-plugin-react-refresh": "^0.4.24",
    "globals": "^16.5.0",
    "typescript": "~5.8.3",
    "typescript-eslint": "^8.48.0",
    "vite": "^6.4.1"
  }
}
```

- [ ] **Step 3: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
```

- [ ] **Step 4: Create tsconfig.json**

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

- [ ] **Step 5: Create tsconfig.app.json**

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true
  },
  "include": ["src"]
}
```

- [ ] **Step 6: Create tsconfig.node.json**

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 7: Create eslint.config.js**

```javascript
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
)
```

- [ ] **Step 8: Create public/favicon.svg**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#7C3AED"/>
      <stop offset="100%" style="stop-color:#6366F1"/>
    </linearGradient>
  </defs>
  <circle cx="16" cy="16" r="14" fill="url(#g)"/>
  <circle cx="12" cy="11" r="4" fill="white" opacity="0.9"/>
  <circle cx="20" cy="11" r="4" fill="white" opacity="0.9"/>
  <circle cx="15" cy="18" r="3.5" fill="white" opacity="0.9"/>
  <circle cx="11" cy="14" r="3.5" fill="white" opacity="0.9"/>
  <circle cx="21" cy="14" r="3.5" fill="white" opacity="0.9"/>
</svg>
```

- [ ] **Step 9: Create src/vite-env.d.ts**

```typescript
/// <reference types="vite/client" />
```

- [ ] **Step 10: Install dependencies**

Run: `npm install`

Expected: All packages install without errors.

- [ ] **Step 11: Commit**

```bash
git add index.html package.json package-lock.json vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json eslint.config.js public/favicon.svg src/vite-env.d.ts
git commit -m "chore: scaffold Vite + React + TypeScript project for Bloom"
```

---

### Task 2: Global Styles & Design System Tokens

**Files:**
- Create: `src/index.css`
- Create: `src/main.tsx`

- [ ] **Step 1: Create global CSS with design tokens**

File: `src/index.css`

```css
/* ===== Fonts ===== */
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;0,9..144,800;1,9..144,400&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap');

/* ===== Design Tokens ===== */
:root {
  /* Colors */
  --color-primary: #7C3AED;
  --color-primary-deep: #4C1D95;
  --color-petal-blue: #6366F1;
  --color-surface-warm: #FCFAF7;
  --color-surface-card: #FFFFFF;
  --color-surface-muted: #F5F0EB;
  --color-ink: #1A1225;
  --color-ink-soft: #6B6278;
  --color-border-subtle: #E8E0D8;
  --color-success-mint: #10B981;
  --color-glow: rgba(124, 58, 237, 0.15);

  /* Typography */
  --font-display: 'Fraunces', Georgia, serif;
  --font-body: 'DM Sans', -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;

  /* Spacing (4pt grid) */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  --space-2xl: 48px;
  --space-3xl: 64px;
  --space-4xl: 96px;

  /* Shadows */
  --shadow-card: 0 1px 3px rgba(26, 18, 37, 0.06), 0 1px 2px rgba(26, 18, 37, 0.04);
  --shadow-card-hover: 0 4px 16px rgba(124, 58, 237, 0.12), 0 2px 4px rgba(26, 18, 37, 0.08);
  --shadow-input: 0 2px 8px rgba(26, 18, 37, 0.04), 0 1px 2px rgba(26, 18, 37, 0.06);
  --shadow-input-focus: 0 4px 20px rgba(124, 58, 237, 0.15), 0 2px 4px rgba(26, 18, 37, 0.06);

  /* Radii */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 24px;
  --radius-full: 9999px;

  /* Transitions */
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);

  /* Layout */
  --max-width: 1200px;
  --header-height: 64px;
}

/* ===== Reset ===== */
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  scroll-behavior: smooth;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  font-family: var(--font-body);
  font-size: 18px;
  line-height: 1.6;
  color: var(--color-ink);
  background-color: var(--color-surface-warm);
  overflow-x: hidden;
}

img {
  display: block;
  max-width: 100%;
}

a {
  color: inherit;
  text-decoration: none;
}

button {
  font-family: inherit;
  cursor: pointer;
  border: none;
  background: none;
}

input, textarea {
  font-family: inherit;
  font-size: inherit;
}

::selection {
  background: rgba(124, 58, 237, 0.2);
  color: var(--color-primary-deep);
}

/* Focus ring */
:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
  border-radius: 4px;
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 2: Create main.tsx entry point**

File: `src/main.tsx`

```typescript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 3: Commit**

```bash
git add src/index.css src/main.tsx
git commit -m "feat: add global styles and design system tokens"
```

---

### Task 3: PromptInput Component (Shared)

**Files:**
- Create: `src/components/PromptInput/PromptInput.tsx`
- Create: `src/components/PromptInput/PromptInput.module.css`

- [ ] **Step 1: Create PromptInput.module.css**

```css
.wrapper {
  position: relative;
  width: 100%;
  max-width: 640px;
  margin: 0 auto;
}

.card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--color-surface-card);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-input);
  transition: box-shadow 0.3s var(--ease-out), transform 0.3s var(--ease-out);
}

.card:focus-within {
  box-shadow: var(--shadow-input-focus);
  transform: scale(1.01);
}

.input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 16px;
  color: var(--color-ink);
  background: transparent;
  min-width: 0;
}

.input::placeholder {
  color: var(--color-ink-soft);
}

.leftIcon {
  display: flex;
  align-items: center;
  color: var(--color-primary);
  flex-shrink: 0;
}

.rightIcon {
  display: flex;
  align-items: center;
  color: var(--color-ink-soft);
  flex-shrink: 0;
  cursor: pointer;
  transition: color 0.2s;
}

.rightIcon:hover {
  color: var(--color-primary);
}

.submitBtn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  background: linear-gradient(135deg, var(--color-primary), var(--color-petal-blue));
  color: white;
  border-radius: var(--radius-full);
  font-size: 15px;
  font-weight: 600;
  white-space: nowrap;
  transition: transform 0.2s var(--ease-spring), box-shadow 0.2s var(--ease-out);
  box-shadow: 0 2px 8px rgba(124, 58, 237, 0.25);
}

.submitBtn:hover {
  transform: translateY(-1px) scale(1.02);
  box-shadow: 0 4px 16px rgba(124, 58, 237, 0.35);
}

.submitBtn:active {
  transform: translateY(0) scale(0.98);
}

.small .card {
  padding: 10px 14px;
  max-width: 520px;
}

.small .submitBtn {
  padding: 8px 16px;
  font-size: 14px;
}
```

- [ ] **Step 2: Create PromptInput.tsx**

```typescript
import { type FormEvent, useState } from 'react'
import styles from './PromptInput.module.css'

interface PromptInputProps {
  size?: 'default' | 'small'
  onSubmit?: (prompt: string) => void
}

export default function PromptInput({ size = 'default', onSubmit }: PromptInputProps) {
  const [value, setValue] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (value.trim() && onSubmit) {
      onSubmit(value.trim())
    }
  }

  return (
    <form
      className={`${styles.wrapper} ${size === 'small' ? styles.small : ''}`}
      onSubmit={handleSubmit}
    >
      <div className={styles.card}>
        <span className={styles.leftIcon} aria-hidden="true">
          <SparkleIcon />
        </span>
        <input
          className={styles.input}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Describe the app or website you want to create..."
          aria-label="Describe your website idea"
        />
        <span className={styles.rightIcon} aria-label="Attach file" role="button" tabIndex={0}>
          <PaperclipIcon />
        </span>
        <button type="submit" className={styles.submitBtn}>
          <span>Build</span>
        </button>
      </div>
    </form>
  )
}

function SparkleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 0L12.5 7.5L20 10L12.5 12.5L10 20L7.5 12.5L0 10L7.5 7.5L10 0Z" fill="currentColor" opacity="0.8" />
    </svg>
  )
}

function PaperclipIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
    </svg>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/PromptInput/
git commit -m "feat: add shared PromptInput component"
```

---

### Task 4: Header Component

**Files:**
- Create: `src/components/Header/Header.tsx`
- Create: `src/components/Header/Header.module.css`

- [ ] **Step 1: Create Header.module.css**

```css
.header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  height: var(--header-height);
  display: flex;
  align-items: center;
  background: rgba(252, 250, 247, 0.8);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid transparent;
  transition: border-color 0.3s var(--ease-out), background 0.3s var(--ease-out);
}

.headerScrolled {
  border-bottom-color: var(--color-border-subtle);
  background: rgba(252, 250, 247, 0.92);
}

.inner {
  width: 100%;
  max-width: var(--max-width);
  margin: 0 auto;
  padding: 0 var(--space-lg);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-xl);
}

.logo {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 700;
  color: var(--color-primary-deep);
  flex-shrink: 0;
}

.logoImg {
  height: 28px;
  width: auto;
}

.nav {
  display: flex;
  align-items: center;
  gap: var(--space-lg);
}

.navItem {
  position: relative;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 15px;
  font-weight: 500;
  color: var(--color-ink);
  padding: 8px 4px;
  border-radius: var(--radius-sm);
  transition: color 0.2s;
  cursor: pointer;
  user-select: none;
}

.navItem:hover {
  color: var(--color-primary);
}

.chevron {
  transition: transform 0.2s var(--ease-out);
  width: 14px;
  height: 14px;
}

.chevronOpen {
  transform: rotate(180deg);
}

.dropdown {
  display: none;
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  padding-top: var(--space-sm);
}

.dropdownOpen {
  display: block;
}

.dropdownInner {
  background: var(--color-surface-card);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  box-shadow: 0 12px 40px rgba(26, 18, 37, 0.12);
  padding: var(--space-sm);
  min-width: 220px;
  overflow: hidden;
}

.dropdownItem {
  display: block;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  transition: background 0.15s;
  white-space: nowrap;
}

.dropdownItem:hover {
  background: var(--color-surface-muted);
}

.dropdownItemTitle {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-ink);
}

.dropdownItemDesc {
  font-size: 12px;
  color: var(--color-ink-soft);
  margin-top: 2px;
}

.actions {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  flex-shrink: 0;
}

.loginBtn {
  font-size: 15px;
  font-weight: 500;
  color: var(--color-ink);
  padding: 8px 16px;
  border-radius: var(--radius-full);
  transition: color 0.2s, background 0.2s;
}

.loginBtn:hover {
  color: var(--color-primary);
  background: rgba(124, 58, 237, 0.06);
}

.ctaBtn {
  font-size: 15px;
  font-weight: 600;
  padding: 10px 22px;
  background: linear-gradient(135deg, var(--color-primary), var(--color-petal-blue));
  color: white;
  border-radius: var(--radius-full);
  box-shadow: 0 2px 8px rgba(124, 58, 237, 0.2);
  transition: transform 0.2s var(--ease-spring), box-shadow 0.2s var(--ease-out);
}

.ctaBtn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(124, 58, 237, 0.3);
}

.mobileMenuBtn {
  display: none;
}

@media (max-width: 767px) {
  .nav {
    display: none;
  }

  .actions .loginBtn {
    display: none;
  }

  .mobileMenuBtn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px;
    color: var(--color-ink);
  }
}
```

- [ ] **Step 2: Create Header.tsx**

```typescript
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
          <img src="/assets/logo.png" alt="Bloom" className={styles.logoImg} />
          Bloom
        </a>

        <nav className={styles.nav}>
          {/* Solutions */}
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

          {/* GitHub */}
          <a href="https://github.com" className={styles.navItem} target="_blank" rel="noopener noreferrer">
            GitHub
          </a>

          {/* Resources */}
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
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Header/
git commit -m "feat: add glass-morphism Header with dropdown nav"
```

---

### Task 5: HeroSection Component

**Files:**
- Create: `src/components/HeroSection/HeroSection.tsx`
- Create: `src/components/HeroSection/HeroSection.module.css`

- [ ] **Step 1: Create HeroSection.module.css**

```css
.section {
  padding: calc(var(--header-height) + var(--space-4xl)) var(--space-lg) var(--space-4xl);
  text-align: center;
  position: relative;
  overflow: hidden;
}

/* Background ambient glow */
.bgGlow {
  position: absolute;
  top: -20%;
  right: -10%;
  width: 60vw;
  height: 60vw;
  max-width: 700px;
  max-height: 700px;
  background: radial-gradient(circle, rgba(124, 58, 237, 0.08) 0%, rgba(99, 102, 241, 0.04) 40%, transparent 70%);
  border-radius: 50%;
  pointer-events: none;
  z-index: 0;
}

.bgBlob1 {
  position: absolute;
  bottom: 10%;
  left: -5%;
  width: 40vw;
  height: 40vw;
  max-width: 500px;
  max-height: 500px;
  background: radial-gradient(circle, rgba(99, 102, 241, 0.04) 0%, transparent 60%);
  border-radius: 50%;
  pointer-events: none;
  z-index: 0;
}

.content {
  position: relative;
  z-index: 1;
  max-width: 800px;
  margin: 0 auto;
}

.headline {
  font-family: var(--font-display);
  font-size: clamp(42px, 6vw, 72px);
  font-weight: 800;
  line-height: 1.05;
  color: var(--color-primary-deep);
  letter-spacing: -0.02em;
  margin-bottom: var(--space-lg);
}

.headlineGradient {
  background: linear-gradient(135deg, var(--color-primary-deep) 0%, var(--color-primary) 50%, var(--color-petal-blue) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.subtitle {
  font-size: clamp(17px, 2.5vw, 20px);
  color: var(--color-ink-soft);
  max-width: 520px;
  margin: 0 auto var(--space-2xl);
  line-height: 1.6;
}

.inputWrapper {
  margin-bottom: var(--space-lg);
}

.trustBar {
  display: flex;
  justify-content: center;
  gap: var(--space-md);
  flex-wrap: wrap;
  margin-top: var(--space-lg);
}

.trustPill {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: rgba(124, 58, 237, 0.06);
  border: 1px solid rgba(124, 58, 237, 0.1);
  border-radius: var(--radius-full);
  font-size: 13px;
  font-weight: 500;
  color: var(--color-ink);
  white-space: nowrap;
}

.trustIcon {
  color: var(--color-success-mint);
  flex-shrink: 0;
}

.scrollIndicator {
  display: flex;
  justify-content: center;
  margin-top: var(--space-3xl);
  animation: float 2.5s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(8px); }
}

.scrollDot {
  width: 28px;
  height: 44px;
  border: 2px solid var(--color-border-subtle);
  border-radius: 14px;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 8px;
}

.scrollDot::after {
  content: '';
  width: 4px;
  height: 8px;
  border-radius: 2px;
  background: var(--color-primary);
  animation: scrollDot 2s ease-in-out infinite;
}

@keyframes scrollDot {
  0% { opacity: 1; transform: translateY(0); }
  50% { opacity: 0.3; transform: translateY(8px); }
  100% { opacity: 1; transform: translateY(0); }
}
```

- [ ] **Step 2: Create HeroSection.tsx**

```typescript
import { motion } from 'framer-motion'
import PromptInput from '../PromptInput/PromptInput'
import styles from './HeroSection.module.css'

const stagger = {
  initial: {},
  animate: {
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
}

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
  },
}

const trustPills = [
  { icon: 'key', text: 'Configure your own API keys' },
  { icon: 'check', text: 'No hidden costs, no ads' },
  { icon: 'shield', text: 'Full control, full privacy' },
]

export default function HeroSection() {
  return (
    <section className={styles.section}>
      <div className={styles.bgGlow} />
      <div className={styles.bgBlob1} />

      <motion.div
        className={styles.content}
        variants={stagger}
        initial="initial"
        animate="animate"
      >
        <motion.h1 className={styles.headline} variants={fadeUp}>
          Build with{' '}
          <span className={styles.headlineGradient}>Bloom</span>
        </motion.h1>

        <motion.p className={styles.subtitle} variants={fadeUp}>
          Create beautiful websites just by talking to AI. Describe what you want
          and watch it come to life — no coding required.
        </motion.p>

        <motion.div className={styles.inputWrapper} variants={fadeUp}>
          <PromptInput />
        </motion.div>

        <motion.div className={styles.trustBar} variants={fadeUp}>
          {trustPills.map((pill) => (
            <div key={pill.text} className={styles.trustPill}>
              <span className={styles.trustIcon} aria-hidden="true">
                {pill.icon === 'key' && <KeyIcon />}
                {pill.icon === 'check' && <CheckIcon />}
                {pill.icon === 'shield' && <ShieldIcon />}
              </span>
              {pill.text}
            </div>
          ))}
        </motion.div>

        <motion.div
          className={styles.scrollIndicator}
          variants={fadeUp}
          aria-hidden="true"
        >
          <div className={styles.scrollDot} />
        </motion.div>
      </motion.div>
    </section>
  )
}

function KeyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/HeroSection/
git commit -m "feat: add Hero section with animated headline, prompt input, and trust bar"
```

---

### Task 6: MeetBloomSection Component

**Files:**
- Create: `src/components/MeetBloomSection/MeetBloomSection.tsx`
- Create: `src/components/MeetBloomSection/MeetBloomSection.module.css`

- [ ] **Step 1: Create MeetBloomSection.module.css**

```css
.section {
  padding: var(--space-4xl) var(--space-lg);
  position: relative;
}

.sectionLabel {
  text-align: center;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-primary);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: var(--space-sm);
}

.sectionTitle {
  text-align: center;
  font-family: var(--font-display);
  font-size: clamp(32px, 4.5vw, 40px);
  font-weight: 700;
  color: var(--color-primary-deep);
  margin-bottom: var(--space-3xl);
  line-height: 1.15;
}

.steps {
  display: flex;
  gap: var(--space-2xl);
  max-width: var(--max-width);
  margin: 0 auto;
  padding: 0 var(--space-lg);
  align-items: flex-start;
}

.stepCard {
  flex: 1;
  text-align: center;
  background: var(--color-surface-card);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-xl);
  padding: var(--space-2xl) var(--space-lg);
  box-shadow: var(--shadow-card);
  transition: transform 0.3s var(--ease-spring), box-shadow 0.3s var(--ease-out);
  position: relative;
}

.stepCard:hover {
  transform: translateY(-6px);
  box-shadow: var(--shadow-card-hover);
}

.iconWrapper {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: var(--radius-lg);
  background: rgba(124, 58, 237, 0.08);
  margin-bottom: var(--space-lg);
  position: relative;
}

.iconGlow {
  position: absolute;
  inset: -4px;
  border-radius: inherit;
  background: transparent;
  transition: background 0.3s var(--ease-out);
}

.stepCard:hover .iconGlow {
  background: var(--color-glow);
}

.icon {
  color: var(--color-primary);
  position: relative;
  z-index: 1;
  transition: transform 0.3s var(--ease-spring);
}

.stepCard:hover .icon {
  transform: scale(1.15);
}

.stepNumber {
  display: inline-block;
  font-size: 12px;
  font-weight: 700;
  color: var(--color-primary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: var(--space-sm);
}

.stepTitle {
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 700;
  color: var(--color-ink);
  margin-bottom: var(--space-sm);
}

.stepDesc {
  font-size: 15px;
  color: var(--color-ink-soft);
  line-height: 1.6;
}

/* SVG connector */
.connectors {
  display: none;
}

@media (min-width: 768px) {
  .connectors {
    display: block;
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    height: 0;
    pointer-events: none;
  }
}

@media (max-width: 767px) {
  .steps {
    flex-direction: column;
    gap: var(--space-lg);
  }
}
```

- [ ] **Step 2: Create MeetBloomSection.tsx**

```typescript
import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import styles from './MeetBloomSection.module.css'

const steps = [
  {
    number: '01',
    title: 'Start with an idea',
    description:
      'Describe the app or website you want to create or drop in screenshots and docs — Bloom understands your vision.',
    icon: BulbIcon,
  },
  {
    number: '02',
    title: 'Watch it come to life',
    description:
      'See your vision transform into a working prototype in real-time as AI builds it for you, component by component.',
    icon: EyeIcon,
  },
  {
    number: '03',
    title: 'Refine and ship',
    description:
      'Iterate on your creation with simple feedback and deploy to the world with one click. No DevOps required.',
    icon: RocketIcon,
  },
]

export default function MeetBloomSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start 60%', 'end 40%'],
  })

  const lineProgress = useTransform(scrollYProgress, [0, 1], [0, 1])

  return (
    <section className={styles.section} ref={sectionRef}>
      <p className={styles.sectionLabel}>Meet Bloom</p>
      <h2 className={styles.sectionTitle}>From idea to live in minutes</h2>

      <div style={{ position: 'relative', maxWidth: 'var(--max-width)', margin: '0 auto' }}>
        <div className={styles.steps}>
          {steps.map((step, i) => (
            <motion.div
              key={step.number}
              className={styles.stepCard}
              initial={{ opacity: 0, y: 40, rotate: i === 0 ? -2 : i === 2 ? 2 : 0 }}
              whileInView={{ opacity: 1, y: 0, rotate: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{
                duration: 0.6,
                delay: i * 0.15,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <div className={styles.iconWrapper}>
                <div className={styles.iconGlow} />
                <div className={styles.icon}>
                  <step.icon />
                </div>
              </div>
              <span className={styles.stepNumber}>Step {step.number}</span>
              <h3 className={styles.stepTitle}>{step.title}</h3>
              <p className={styles.stepDesc}>{step.description}</p>
            </motion.div>
          ))}
        </div>

        {/* SVG connector lines — desktop only */}
        <svg
          className={styles.connectors}
          style={{
            position: 'absolute',
            top: '35%',
            left: '18%',
            right: '18%',
            width: '64%',
            height: '40px',
            pointerEvents: 'none',
          }}
          viewBox="0 0 400 40"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="connectorGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.2" />
              <stop offset="50%" stopColor="var(--color-primary)" stopOpacity="0.5" />
              <stop offset="100%" stopColor="var(--color-petal-blue)" stopOpacity="0.2" />
            </linearGradient>
          </defs>
          <motion.path
            d="M10 20 Q 80 20 80 20 Q 120 20 180 20"
            stroke="url(#connectorGrad)"
            strokeWidth="1.5"
            fill="none"
            strokeDasharray="200"
            initial={{ strokeDashoffset: 200 }}
            whileInView={{ strokeDashoffset: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.4 }}
          />
          <motion.path
            d="M220 20 Q 280 20 280 20 Q 320 20 390 20"
            stroke="url(#connectorGrad)"
            strokeWidth="1.5"
            fill="none"
            strokeDasharray="200"
            initial={{ strokeDashoffset: 200 }}
            whileInView={{ strokeDashoffset: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.6 }}
          />
        </svg>
      </div>
    </section>
  )
}

function BulbIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function RocketIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z" />
      <path d="M12 15l-3-3a22 22 0 012.81-4.81l.17-.19a22 22 0 013.84 3.84L12 15z" />
      <path d="M13.5 4.5A22 22 0 0019 2s-1.5 4-3 6.5M9 17.5V21l3-3M15 10.5V5l-3 3" />
    </svg>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/MeetBloomSection/
git commit -m "feat: add Meet Bloom section with animated step cards and connector lines"
```

---

### Task 7: BYOKSection Component

**Files:**
- Create: `src/components/BYOKSection/BYOKSection.tsx`
- Create: `src/components/BYOKSection/BYOKSection.module.css`

- [ ] **Step 1: Create BYOKSection.module.css**

```css
.section {
  padding: var(--space-4xl) var(--space-lg);
  background: var(--color-surface-muted);
  position: relative;
}

.inner {
  max-width: var(--max-width);
  margin: 0 auto;
}

.header {
  text-align: center;
  margin-bottom: var(--space-2xl);
}

.sectionTitle {
  font-family: var(--font-display);
  font-size: clamp(28px, 4vw, 36px);
  font-weight: 700;
  color: var(--color-primary-deep);
  margin-bottom: var(--space-md);
}

.sectionBody {
  max-width: 600px;
  margin: 0 auto;
  font-size: 17px;
  color: var(--color-ink-soft);
  line-height: 1.7;
}

.highlight {
  color: var(--color-primary);
  font-weight: 500;
}

.cards {
  display: flex;
  gap: var(--space-lg);
  max-width: 900px;
  margin: var(--space-2xl) auto 0;
}

.card {
  flex: 1;
  background: var(--color-surface-card);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  padding: var(--space-xl);
  text-align: center;
  box-shadow: var(--shadow-card);
  transition: transform 0.3s var(--ease-spring), box-shadow 0.3s var(--ease-out);
}

.card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-card-hover);
}

.cardIcon {
  width: 44px;
  height: 44px;
  margin: 0 auto var(--space-md);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  background: rgba(124, 58, 237, 0.08);
  color: var(--color-primary);
}

.cardTitle {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-ink);
  margin-bottom: var(--space-xs);
}

.cardDesc {
  font-size: 14px;
  color: var(--color-ink-soft);
  line-height: 1.5;
}

.marketPosition {
  text-align: center;
  margin-top: var(--space-xl);
  font-size: 14px;
  color: var(--color-ink-soft);
  font-style: italic;
}

@media (max-width: 767px) {
  .cards {
    flex-direction: column;
  }
}
```

- [ ] **Step 2: Create BYOKSection.tsx**

```typescript
import { motion } from 'framer-motion'
import styles from './BYOKSection.module.css'

const features = [
  {
    title: 'Bring your own API keys',
    description: 'Connect OpenAI, Anthropic, Google, or any provider. Use the models you already pay for.',
    icon: KeyCardIcon,
  },
  {
    title: 'Zero platform markup',
    description: 'Unlike other tools, Bloom never charges a premium on your API usage. You pay exactly what the provider charges.',
    icon: ZeroIcon,
  },
  {
    title: 'Full data privacy',
    description: 'Your API keys, your data, your control. Nothing runs through our servers — everything happens in your browser.',
    icon: PrivacyIcon,
  },
]

export default function BYOKSection() {
  return (
    <section className={styles.section}>
      <div className={styles.inner}>
        <motion.div
          className={styles.header}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 className={styles.sectionTitle}>Your keys, your control</h2>
          <p className={styles.sectionBody}>
            Unlike <span className={styles.highlight}>Lovable</span> or{' '}
            <span className={styles.highlight}>Base44</span>, Bloom doesn't lock
            you into a subscription. Configure your own API keys from any provider
            and pay only for what you use. <span className={styles.highlight}>No markup, no ads, no hidden costs.</span>
          </p>
        </motion.div>

        <div className={styles.cards}>
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              className={styles.card}
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{
                duration: 0.5,
                delay: i * 0.12,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <div className={styles.cardIcon}>
                <feature.icon />
              </div>
              <h3 className={styles.cardTitle}>{feature.title}</h3>
              <p className={styles.cardDesc}>{feature.description}</p>
            </motion.div>
          ))}
        </div>

        <p className={styles.marketPosition}>
          Bloom is the only AI website builder that puts you in control of your stack.
        </p>
      </div>
    </section>
  )
}

function KeyCardIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  )
}

function ZeroIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <path d="M9 9h.01M15 9h.01" />
    </svg>
  )
}

function PrivacyIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/BYOKSection/
git commit -m "feat: add BYOK section with feature cards and market positioning"
```

---

### Task 8: BottomCTA Component

**Files:**
- Create: `src/components/BottomCTA/BottomCTA.tsx`
- Create: `src/components/BottomCTA/BottomCTA.module.css`

- [ ] **Step 1: Create BottomCTA.module.css**

```css
.section {
  padding: var(--space-4xl) var(--space-lg);
  text-align: center;
  position: relative;
}

.bgGlow {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 50vw;
  height: 40vw;
  max-width: 600px;
  max-height: 400px;
  background: radial-gradient(circle, rgba(124, 58, 237, 0.06) 0%, transparent 60%);
  border-radius: 50%;
  pointer-events: none;
}

.content {
  position: relative;
  z-index: 1;
}

.title {
  font-family: var(--font-display);
  font-size: clamp(28px, 4vw, 36px);
  font-weight: 700;
  color: var(--color-primary-deep);
  margin-bottom: var(--space-lg);
}

.subtitle {
  font-size: 17px;
  color: var(--color-ink-soft);
  margin-bottom: var(--space-xl);
}

.inputWrapper {
  max-width: 560px;
  margin: 0 auto;
}
```

- [ ] **Step 2: Create BottomCTA.tsx**

```typescript
import { motion } from 'framer-motion'
import PromptInput from '../PromptInput/PromptInput'
import styles from './BottomCTA.module.css'

export default function BottomCTA() {
  return (
    <section className={styles.section}>
      <div className={styles.bgGlow} />
      <motion.div
        className={styles.content}
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <h2 className={styles.title}>Ready to build something great?</h2>
        <p className={styles.subtitle}>Start building now — no credit card required.</p>
        <div className={styles.inputWrapper}>
          <PromptInput size="small" />
        </div>
      </motion.div>
    </section>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/BottomCTA/
git commit -m "feat: add Bottom CTA section with prompt input"
```

---

### Task 9: Footer Component

**Files:**
- Create: `src/components/Footer/Footer.tsx`
- Create: `src/components/Footer/Footer.module.css`

- [ ] **Step 1: Create Footer.module.css**

```css
.footer {
  background: var(--color-ink);
  color: rgba(255, 255, 255, 0.7);
  padding: var(--space-3xl) var(--space-lg) var(--space-xl);
}

.inner {
  max-width: var(--max-width);
  margin: 0 auto;
}

.top {
  display: flex;
  justify-content: space-between;
  gap: var(--space-2xl);
  margin-bottom: var(--space-2xl);
  flex-wrap: wrap;
}

.brand {
  max-width: 260px;
}

.logo {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 700;
  color: white;
  margin-bottom: var(--space-sm);
}

.logoImg {
  height: 24px;
  width: auto;
  filter: brightness(0) invert(1);
}

.tagline {
  font-size: 14px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.5);
}

.links {
  display: flex;
  gap: var(--space-3xl);
  flex-wrap: wrap;
}

.linkGroup {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.linkGroupTitle {
  font-size: 13px;
  font-weight: 600;
  color: white;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 4px;
}

.linkGroup a {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.5);
  transition: color 0.2s;
}

.linkGroup a:hover {
  color: white;
}

.bottom {
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding-top: var(--space-lg);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-md);
  font-size: 13px;
  color: rgba(255, 255, 255, 0.4);
}

.socialLinks {
  display: flex;
  gap: var(--space-md);
}

.socialLinks a {
  color: rgba(255, 255, 255, 0.4);
  transition: color 0.2s;
}

.socialLinks a:hover {
  color: white;
}
```

- [ ] **Step 2: Create Footer.tsx**

```typescript
import styles from './Footer.module.css'

const footerLinks = {
  Product: [
    { label: 'Overview', href: '#' },
    { label: 'Pricing', href: '#' },
    { label: 'Changelog', href: '#' },
  ],
  Resources: [
    { label: 'Documentation', href: '#' },
    { label: 'API Reference', href: '#' },
    { label: 'Templates', href: '#' },
    { label: 'Blog', href: '#' },
  ],
  Company: [
    { label: 'About', href: '#' },
    { label: 'GitHub', href: '#' },
    { label: 'Privacy Policy', href: '#' },
    { label: 'Terms of Service', href: '#' },
  ],
}

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.top}>
          <div className={styles.brand}>
            <a href="/" className={styles.logo}>
              <img src="/assets/logo.png" alt="" className={styles.logoImg} />
              Bloom
            </a>
            <p className={styles.tagline}>
              Build with AI. Ship with confidence. <br />
              By developers, for developers.
            </p>
          </div>

          <div className={styles.links}>
            {Object.entries(footerLinks).map(([group, items]) => (
              <div key={group} className={styles.linkGroup}>
                <span className={styles.linkGroupTitle}>{group}</span>
                {items.map((link) => (
                  <a key={link.label} href={link.href}>
                    {link.label}
                  </a>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className={styles.bottom}>
          <span>&copy; {new Date().getFullYear()} Bloom. All rights reserved.</span>
          <div className={styles.socialLinks}>
            <a href="https://github.com" aria-label="GitHub" target="_blank" rel="noopener noreferrer">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
            </a>
            <a href="https://x.com" aria-label="X / Twitter" target="_blank" rel="noopener noreferrer">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Footer/
git commit -m "feat: add Footer with link columns and social icons"
```

---

### Task 10: App Shell — Wire Everything Together

**Files:**
- Create: `src/App.tsx`
- Create: `src/App.module.css`

- [ ] **Step 1: Create App.module.css**

```css
.app {
  min-height: 100vh;
}
```

- [ ] **Step 2: Create App.tsx**

```typescript
import Header from './components/Header/Header'
import HeroSection from './components/HeroSection/HeroSection'
import MeetBloomSection from './components/MeetBloomSection/MeetBloomSection'
import BYOKSection from './components/BYOKSection/BYOKSection'
import BottomCTA from './components/BottomCTA/BottomCTA'
import Footer from './components/Footer/Footer'
import styles from './App.module.css'

export default function App() {
  return (
    <div className={styles.app}>
      <Header />
      <main>
        <HeroSection />
        <MeetBloomSection />
        <BYOKSection />
        <BottomCTA />
      </main>
      <Footer />
    </div>
  )
}
```

- [ ] **Step 3: Verify the build compiles**

Run: `npx tsc -b`

Expected: No TypeScript errors.

- [ ] **Step 4: Verify the dev server starts**

Run: `npm run dev` (then kill it after confirming startup)

Expected: Vite dev server starts without errors.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/App.module.css
git commit -m "feat: wire all homepage sections into App shell"
```

---

### Task 11: Final Polish & Assets

- [ ] **Step 1: Copy logo to public directory**

```bash
cp assets/logo.png public/logo.png
```

- [ ] **Step 2: Update .gitignore if needed**

Create `.gitignore`:

```gitignore
node_modules
dist
.vite
*.local
```

- [ ] **Step 3: Run full build check**

Run: `npm run build`

Expected: Vite production build completes successfully.

- [ ] **Step 4: Start dev server and manually verify**

Run: `npm run dev`
Navigate to http://localhost:5173

Checklist:
- [ ] All 6 sections render
- [ ] Header is fixed and glass-morphism
- [ ] Hero animations play (staggered entrance)
- [ ] Solutions/Resources dropdowns work on hover
- [ ] Meet Bloom cards animate on scroll
- [ ] BYOK section renders with feature cards
- [ ] Footer is dark with links
- [ ] Fonts (Fraunces, DM Sans) load correctly
- [ ] Responsive: check 375px, 768px, 1024px, 1440px
- [ ] No horizontal scroll on mobile
- [ ] Touch targets ≥ 44px

- [ ] **Step 5: Commit**

```bash
git add public/logo.png .gitignore
git commit -m "chore: add public assets and final polish"
```
