# Mobile Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every page usable on mobile phones by fixing the DashboardSidebar (which currently covers ~66% of the screen), adding mobile top bars to app pages, giving SettingsPage a tab strip on mobile, and polishing the ProjectBuilder topbar and Footer on very small screens.

**Architecture:** Pure CSS Modules + minimal React state. DashboardSidebar gains `isOpen`/`onClose` props and becomes a slide-in drawer. DashboardPage and ProfilePage each add a fixed 56 px mobile top bar with a hamburger that toggles the drawer. SettingsPage replaces its fixed sidebar with a horizontally-scrollable tab strip via a new CSS class + a small JSX addition. No new dependencies.

**Tech Stack:** React 18, CSS Modules, TypeScript, Vite

**Note:** `index.html` already has the correct viewport meta (`width=device-width, initial-scale=1.0`). `MeetOpenThornSection` and `BYOKSection` already have mobile CSS — skip them.

---

### Task 1: Global touch-action fix

**Files:**
- Modify: `src/index.css` (around line 125)

- [ ] **Step 1: Add `touch-action: manipulation` to the global button and anchor reset**

Find these two lines in `src/index.css`:
```css
button { font-family: inherit; cursor: pointer; border: none; background: none; color: inherit; }
a { color: inherit; text-decoration: none; }
```

Replace with:
```css
button { font-family: inherit; cursor: pointer; border: none; background: none; color: inherit; touch-action: manipulation; }
a { color: inherit; text-decoration: none; touch-action: manipulation; }
```

- [ ] **Step 2: Verify build**

```
npm run build
```
Expected: exits 0, no TypeScript errors.

- [ ] **Step 3: Commit**

```
git add src/index.css
git commit -m "fix(mobile): eliminate 300ms tap delay with touch-action manipulation"
```

---

### Task 2: DashboardSidebar — slide-in drawer (CSS + TSX)

**Files:**
- Modify: `src/components/DashboardSidebar/DashboardSidebar.module.css`
- Modify: `src/components/DashboardSidebar/DashboardSidebar.tsx`

- [ ] **Step 1: Add overlay class + drawer media query to `DashboardSidebar.module.css`**

Append to the **end** of the file:

```css
.overlay {
  position: fixed;
  inset: 0;
  z-index: 49;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
}

@media (max-width: 768px) {
  .sidebar {
    transform: translateX(-100%);
    transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .sidebarOpen {
    transform: translateX(0);
    box-shadow: 4px 0 40px rgba(0, 0, 0, 0.6);
  }
}
```

- [ ] **Step 2: Add `isOpen` and `onClose` to `DashboardSidebarProps` (line 21)**

Replace the interface:
```tsx
interface DashboardSidebarProps {
  projects?: Project[]
  activeFilter?: ProjectFilter
  onProjectFilterChange?: (filter: ProjectFilter) => void
  notifications?: SidebarNotification[]
  onNotificationsRead?: () => void
  isOpen?: boolean
  onClose?: () => void
}
```

- [ ] **Step 3: Destructure the new props in the component signature (line 130)**

Replace the function signature line:
```tsx
export default function DashboardSidebar({ projects = [], activeFilter = 'all', onProjectFilterChange, notifications: externalNotifications, onNotificationsRead, isOpen = false, onClose }: DashboardSidebarProps) {
```

- [ ] **Step 4: Wrap the return in a fragment, add overlay, apply `sidebarOpen` class**

Find `return (` near the end of the component and replace the opening tag:

```tsx
return (
  <>
    {isOpen && <div className={styles.overlay} onClick={onClose} aria-hidden="true" />}
    <aside className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : ''}`}>
```

At the very end of the return, replace `</aside>` with `</aside></>`.

- [ ] **Step 5: Call `onClose?.()` at the start of `handleNavClick` (line 162)**

```tsx
const handleNavClick = (label: string) => {
  onClose?.()
  setActiveNav(label)
  if (label === 'Providers') navigate('/providers')
  if (label === 'Home') navigate('/dashboard')
  if (label === 'Templates') navigate('/templates')
  if (label === 'Community') navigate('/community')
}
```

- [ ] **Step 6: Call `onClose?.()` at the start of `handleProjectFilterClick` (line 170)**

```tsx
const handleProjectFilterClick = (label: string) => {
  onClose?.()
  const filter = filterMap[label]
  if (!filter) return
  if (onProjectFilterChange) onProjectFilterChange(filter)
  setActiveNav(label)
  navigate('/dashboard', { state: { activeFilter: filter, scrollToProjects: true } })
}
```

- [ ] **Step 7: Verify build**

```
npm run build
```
Expected: exits 0.

- [ ] **Step 8: Commit**

```
git add src/components/DashboardSidebar/DashboardSidebar.tsx src/components/DashboardSidebar/DashboardSidebar.module.css
git commit -m "feat(mobile): DashboardSidebar slides in as a drawer on small screens"
```

---

### Task 3: DashboardPage — mobile top bar + sidebar wiring

**Files:**
- Modify: `src/pages/DashboardPage.tsx`
- Modify: `src/pages/DashboardPage.module.css`

- [ ] **Step 1: Add mobile top bar styles to `DashboardPage.module.css`**

Append to the **end** of the file:

```css
.mobileTopbar {
  display: none;
}

@media (max-width: 768px) {
  .mobileTopbar {
    display: flex;
    align-items: center;
    gap: 12px;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 40;
    height: 56px;
    padding: 0 16px;
    background: rgba(9, 7, 11, 0.92);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--color-border);
  }

  .mobileMenuBtn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 8px;
    color: var(--color-text-secondary);
    background: transparent;
    border: none;
    cursor: pointer;
    flex-shrink: 0;
    touch-action: manipulation;
    transition: color 0.15s, background 0.15s;
  }

  .mobileMenuBtn:hover {
    color: var(--color-text);
    background: rgba(255, 255, 255, 0.06);
  }

  .mobileLogo {
    display: flex;
    align-items: center;
  }

  .mobileLogoImg {
    height: 24px;
    width: auto;
  }
}
```

- [ ] **Step 2: Add `sidebarOpen` state to `DashboardPage.tsx`**

Inside the `DashboardPage` component function, alongside the other `useState` calls near the top, add:

```tsx
const [sidebarOpen, setSidebarOpen] = useState(false)
```

- [ ] **Step 3: Pass `isOpen` and `onClose` to `<DashboardSidebar>` in the return JSX**

Find the `<DashboardSidebar` JSX in the return and add `isOpen` and `onClose` to the existing prop list without removing any existing props:

```tsx
isOpen={sidebarOpen}
onClose={() => setSidebarOpen(false)}
```

- [ ] **Step 4: Add the mobile top bar JSX**

In the return, add this immediately after the closing `/>` of `<DashboardSidebar`:

```tsx
<div className={styles.mobileTopbar}>
  <button
    className={styles.mobileMenuBtn}
    onClick={() => setSidebarOpen(true)}
    aria-label="Open menu"
    type="button"
  >
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6"/>
      <line x1="3" y1="12" x2="21" y2="12"/>
      <line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  </button>
  <a href="/dashboard" className={styles.mobileLogo}>
    <img src="/assets/logo.png" alt="OpenThorn" className={styles.mobileLogoImg} />
  </a>
</div>
```

- [ ] **Step 5: Verify build**

```
npm run build
```
Expected: exits 0.

- [ ] **Step 6: Commit**

```
git add src/pages/DashboardPage.tsx src/pages/DashboardPage.module.css
git commit -m "feat(mobile): DashboardPage mobile top bar with hamburger drawer toggle"
```

---

### Task 4: ProfilePage — mobile top bar + sidebar wiring

**Files:**
- Modify: `src/pages/ProfilePage.tsx`
- Modify: `src/pages/ProfilePage.module.css`

- [ ] **Step 1: Add mobile styles to `ProfilePage.module.css`**

Append to the **end** of the file:

```css
.mobileTopbar {
  display: none;
}

@media (max-width: 768px) {
  .main {
    margin-left: 0;
    padding: 80px 20px 80px;
  }

  .mobileTopbar {
    display: flex;
    align-items: center;
    gap: 12px;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 40;
    height: 56px;
    padding: 0 16px;
    background: rgba(9, 7, 11, 0.92);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .mobileMenuBtn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 8px;
    color: rgba(200, 193, 211, 0.8);
    background: transparent;
    border: none;
    cursor: pointer;
    flex-shrink: 0;
    touch-action: manipulation;
    transition: color 0.15s, background 0.15s;
  }

  .mobileMenuBtn:hover {
    color: #e8e8f0;
    background: rgba(255, 255, 255, 0.06);
  }

  .mobileLogo {
    display: flex;
    align-items: center;
  }

  .mobileLogoImg {
    height: 24px;
    width: auto;
  }
}
```

- [ ] **Step 2: Add `sidebarOpen` state to `ProfilePage.tsx`**

Inside the `ProfilePage` component function, alongside the other `useState` calls, add:

```tsx
const [sidebarOpen, setSidebarOpen] = useState(false)
```

- [ ] **Step 3: Add `isOpen` and `onClose` to the `<DashboardSidebar />` in `ProfilePage.tsx`**

Find the `<DashboardSidebar` render (currently rendered with no props or existing props) and wire up:

```tsx
<DashboardSidebar
  isOpen={sidebarOpen}
  onClose={() => setSidebarOpen(false)}
/>
```

- [ ] **Step 4: Add mobile top bar JSX after `<DashboardSidebar ... />`**

```tsx
<div className={styles.mobileTopbar}>
  <button
    className={styles.mobileMenuBtn}
    onClick={() => setSidebarOpen(true)}
    aria-label="Open menu"
    type="button"
  >
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6"/>
      <line x1="3" y1="12" x2="21" y2="12"/>
      <line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  </button>
  <a href="/dashboard" className={styles.mobileLogo}>
    <img src="/assets/logo.png" alt="OpenThorn" className={styles.mobileLogoImg} />
  </a>
</div>
```

- [ ] **Step 5: Verify build**

```
npm run build
```
Expected: exits 0.

- [ ] **Step 6: Commit**

```
git add src/pages/ProfilePage.tsx src/pages/ProfilePage.module.css
git commit -m "feat(mobile): ProfilePage mobile top bar with hamburger drawer toggle"
```

---

### Task 5: SettingsPage — mobile horizontal tab strip

**Files:**
- Modify: `src/pages/SettingsPage.module.css`
- Modify: `src/pages/SettingsPage.tsx`

- [ ] **Step 1: Add mobile CSS to `SettingsPage.module.css`**

Append to the **end** of the file:

```css
.mobileTabBar {
  display: none;
}

@media (max-width: 768px) {
  .sidebar {
    display: none;
  }

  .main {
    margin-left: 0;
    padding: 0 16px 80px;
  }

  .panel {
    max-width: 100%;
    padding-top: 24px;
  }

  .fieldRow {
    grid-template-columns: 1fr;
  }

  .mobileTabBar {
    display: flex;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    padding: 0 16px;
    background: var(--color-surface);
    border-bottom: 1px solid var(--color-border);
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .mobileTabBar::-webkit-scrollbar {
    display: none;
  }

  .mobileTab {
    flex-shrink: 0;
    padding: 14px 16px;
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text-muted);
    background: none;
    border: none;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    transition: color 0.15s, border-color 0.15s;
    font-family: var(--font-body);
    white-space: nowrap;
    touch-action: manipulation;
  }

  .mobileTab:hover {
    color: var(--color-text-secondary);
  }

  .mobileTabActive {
    color: var(--color-accent);
    border-bottom-color: var(--color-accent);
  }

  .mobileTabDanger {
    color: rgba(248, 113, 113, 0.65);
  }

  .mobileTabDanger:hover {
    color: #fca5a5;
  }

  .mobileTabDanger.mobileTabActive {
    color: #fca5a5;
    border-bottom-color: #ef4444;
  }
}
```

- [ ] **Step 2: Add the mobile tab bar JSX to `SettingsPage.tsx`**

In the `return (` of `SettingsPage`, insert the mobile tab bar immediately after the closing `</aside>` of the settings sidebar:

```tsx
{/* Mobile tab strip — visible only at ≤768px */}
<div className={styles.mobileTabBar}>
  {navItems.map((item) => (
    <button
      key={item.id}
      className={[
        styles.mobileTab,
        tab === item.id ? styles.mobileTabActive : '',
        item.danger ? styles.mobileTabDanger : '',
      ].join(' ')}
      onClick={() => setTab(item.id)}
      type="button"
    >
      {item.label}
    </button>
  ))}
</div>
```

- [ ] **Step 3: Verify build**

```
npm run build
```
Expected: exits 0.

- [ ] **Step 4: Commit**

```
git add src/pages/SettingsPage.tsx src/pages/SettingsPage.module.css
git commit -m "feat(mobile): SettingsPage horizontal scrollable tab strip on small screens"
```

---

### Task 6: ProjectBuilder — very small phone topbar tweaks

**Files:**
- Modify: `src/pages/ProjectBuilderPage.module.css`

- [ ] **Step 1: Add ≤480px breakpoint**

Append to the **end** of the file:

```css
@media (max-width: 480px) {
  .modeSwitch {
    display: none;
  }

  .topbar {
    padding: 0 10px;
    gap: 8px;
  }

  .projectNameBtn {
    max-width: 130px;
    font-size: 13px;
  }

  .projectMeta {
    display: none;
  }

  .modelBadge {
    display: none;
  }

  .shareBtn {
    padding: 0 10px;
    font-size: 11.5px;
  }

  .deployBtn {
    padding: 0 10px;
    font-size: 11.5px;
  }
}
```

- [ ] **Step 2: Verify build**

```
npm run build
```
Expected: exits 0.

- [ ] **Step 3: Commit**

```
git add src/pages/ProjectBuilderPage.module.css
git commit -m "fix(mobile): tighten ProjectBuilder topbar on very small phones"
```

---

### Task 7: Footer — single column at ≤480px

**Files:**
- Modify: `src/components/Footer/Footer.module.css`

- [ ] **Step 1: Add ≤480px breakpoint after the existing `@media (max-width: 768px)` block**

Append to the **end** of the file:

```css
@media (max-width: 480px) {
  .footer {
    padding: var(--space-3xl) var(--space-lg) var(--space-xl);
  }

  .top {
    grid-template-columns: 1fr;
    gap: var(--space-xl);
  }

  .newsletter {
    flex-direction: column;
  }

  .newsInput {
    border-radius: var(--radius-full);
  }

  .newsBtn {
    border-radius: var(--radius-full);
    width: 100%;
  }
}
```

- [ ] **Step 2: Verify build**

```
npm run build
```
Expected: exits 0.

- [ ] **Step 3: Commit**

```
git add src/components/Footer/Footer.module.css
git commit -m "fix(mobile): Footer single-column layout on very small phones"
```
