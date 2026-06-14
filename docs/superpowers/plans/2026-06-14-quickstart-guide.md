# First-login Quickstart Guide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a one-time, 5-slide welcome modal to brand-new users on their first Dashboard visit, pointing them to Providers, Templates, the Restaurant Landing template, and the build/deploy flow.

**Architecture:** A DB flag `profiles.has_seen_quickstart` gates the modal (existing users backfilled to `true`). DashboardPage fetches the flag, renders a new `QuickstartGuide` component when it is `false`, and flips it to `true` on dismiss. Pure slide config + show-once predicate live in a testable `src/lib/quickstart.ts` module. A small deep-link addition to TemplatesPage lets the Restaurant slide open that template's preview directly.

**Tech Stack:** React 19 + TypeScript, React Router v7, Supabase (Postgres + RLS), CSS Modules, Vitest (node env).

---

## File Structure

- Create: `supabase/migrations/20260614010000_add_quickstart_flag.sql` — add + backfill the flag.
- Create: `src/lib/quickstart.ts` — slide config + `shouldShowQuickstart` predicate (pure, testable).
- Create: `src/lib/__tests__/quickstart.test.ts` — unit tests for the above.
- Create: `src/components/QuickstartGuide/QuickstartGuide.tsx` — the modal component.
- Create: `src/components/QuickstartGuide/QuickstartGuide.module.css` — modal styles.
- Modify: `src/pages/DashboardPage.tsx` — fetch flag, render guide, persist dismissal.
- Modify: `src/pages/TemplatesPage.tsx` — auto-open a template from `location.state.openTemplateId`.

---

## Task 1: Database migration for the show-once flag

**Files:**
- Create: `supabase/migrations/20260614010000_add_quickstart_flag.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260614010000_add_quickstart_flag.sql`:

```sql
-- First-login quickstart guide: track whether a user has seen it.
alter table public.profiles
  add column if not exists has_seen_quickstart boolean not null default false;

-- Existing users have already used the app — don't re-onboard them.
-- New signups created after this migration get the default `false`.
update public.profiles set has_seen_quickstart = true;
```

- [ ] **Step 2: Verify it is valid SQL by inspection**

The existing `profiles_update_own` RLS policy (in
`20260603000000_profiles_and_collaboration.sql`) already permits a user to update
their own row, so no new policy is required. Confirm no other migration adds a
`has_seen_quickstart` column (it does not).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260614010000_add_quickstart_flag.sql
git commit -m "feat(db): add has_seen_quickstart flag to profiles"
```

> **Note for the implementer:** This migration must be applied to the live
> database with `supabase db push` (or via the dashboard) before the feature
> works end-to-end. Applying it is a deploy step, not part of the code commit.

---

## Task 2: Pure quickstart logic and slide config

**Files:**
- Create: `src/lib/quickstart.ts`
- Test: `src/lib/__tests__/quickstart.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/quickstart.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { QUICKSTART_SLIDES, shouldShowQuickstart } from '../quickstart'

describe('shouldShowQuickstart', () => {
  it('shows only when the flag is explicitly false', () => {
    expect(shouldShowQuickstart(false)).toBe(true)
  })
  it('does not show when already seen', () => {
    expect(shouldShowQuickstart(true)).toBe(false)
  })
  it('does not show while unknown/loading (null or undefined)', () => {
    expect(shouldShowQuickstart(null)).toBe(false)
    expect(shouldShowQuickstart(undefined)).toBe(false)
  })
})

describe('QUICKSTART_SLIDES', () => {
  it('starts with an advance action and ends with a finish action', () => {
    expect(QUICKSTART_SLIDES[0].action.type).toBe('advance')
    expect(QUICKSTART_SLIDES[QUICKSTART_SLIDES.length - 1].action.type).toBe('finish')
  })
  it('routes the Providers slide to /providers', () => {
    const slide = QUICKSTART_SLIDES.find((s) => s.id === 'providers')
    expect(slide?.action).toEqual({ type: 'navigate', label: 'Go to Providers', to: '/providers' })
  })
  it('deep-links the Restaurant slide to the restaurant-landing template', () => {
    const slide = QUICKSTART_SLIDES.find((s) => s.id === 'restaurant')
    expect(slide?.action).toMatchObject({
      type: 'navigate',
      to: '/templates',
      state: { openTemplateId: 'restaurant-landing' },
    })
  })
  it('has unique slide ids', () => {
    const ids = QUICKSTART_SLIDES.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/quickstart.test.ts`
Expected: FAIL — cannot resolve module `../quickstart`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/quickstart.ts`:

```ts
/** Action taken when a quickstart slide's primary button is pressed. */
export type QuickstartAction =
  | { type: 'advance'; label: string }
  | { type: 'finish'; label: string }
  | { type: 'navigate'; label: string; to: string; state?: Record<string, unknown> }

export interface QuickstartSlide {
  id: string
  heading: string
  body: string
  action: QuickstartAction
}

/**
 * Slides shown to a brand-new user on their first dashboard visit.
 * `navigate` actions close the guide (persisting the flag) and route the user.
 */
export const QUICKSTART_SLIDES: QuickstartSlide[] = [
  {
    id: 'welcome',
    heading: 'Welcome to OpenThorn',
    body: 'OpenThorn builds complete websites from a single prompt — using your own AI provider key.',
    action: { type: 'advance', label: 'Next' },
  },
  {
    id: 'providers',
    heading: 'Connect a provider',
    body: 'Your API key stays yours (BYOK). Add it under Providers in the sidebar to start generating.',
    action: { type: 'navigate', label: 'Go to Providers', to: '/providers' },
  },
  {
    id: 'templates',
    heading: 'Browse Templates',
    body: 'Prefer a head start? Production-ready starting points live under Templates.',
    action: { type: 'navigate', label: 'Open Templates', to: '/templates' },
  },
  {
    id: 'restaurant',
    heading: 'Try the Restaurant Landing template',
    body: 'Open Templates, click a card to preview it, then “Use this template” to customize it with AI.',
    action: {
      type: 'navigate',
      label: 'Open Restaurant template',
      to: '/templates',
      state: { openTemplateId: 'restaurant-landing' },
    },
  },
  {
    id: 'build',
    heading: 'Build & deploy',
    body: 'Describe your idea in the prompt box on the dashboard, then deploy your site when it’s ready.',
    action: { type: 'finish', label: 'Get started' },
  },
]

/** Show the guide only when the persisted flag is explicitly false. */
export function shouldShowQuickstart(hasSeen: boolean | null | undefined): boolean {
  return hasSeen === false
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/quickstart.test.ts`
Expected: PASS (9 assertions across the two describe blocks).

- [ ] **Step 5: Commit**

```bash
git add src/lib/quickstart.ts src/lib/__tests__/quickstart.test.ts
git commit -m "feat: add quickstart slide config and show-once predicate"
```

---

## Task 3: QuickstartGuide component

**Files:**
- Create: `src/components/QuickstartGuide/QuickstartGuide.tsx`
- Create: `src/components/QuickstartGuide/QuickstartGuide.module.css`

- [ ] **Step 1: Write the component**

Create `src/components/QuickstartGuide/QuickstartGuide.tsx`:

```tsx
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { QUICKSTART_SLIDES } from '../../lib/quickstart'
import styles from './QuickstartGuide.module.css'

interface QuickstartGuideProps {
  firstName: string
  /** Called whenever the guide is dismissed (finish, navigate, or close). The
   *  parent persists the has_seen_quickstart flag here. */
  onClose: () => void
}

export default function QuickstartGuide({ firstName, onClose }: QuickstartGuideProps) {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const slide = QUICKSTART_SLIDES[step]
  const isFirst = step === 0
  const total = QUICKSTART_SLIDES.length

  const handleAction = useCallback(() => {
    const action = slide.action
    if (action.type === 'advance') {
      setStep((s) => Math.min(s + 1, total - 1))
      return
    }
    // Both 'finish' and 'navigate' dismiss the guide.
    onClose()
    if (action.type === 'navigate') {
      navigate(action.to, action.state ? { state: action.state } : undefined)
    }
  }, [slide, onClose, navigate, total])

  // Escape closes the guide.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const heading = slide.id === 'welcome'
    ? `Welcome to OpenThorn, ${firstName}`
    : slide.heading

  return (
    <div
      className={styles.backdrop}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      role="dialog"
      aria-modal="true"
      aria-label="Quickstart guide"
    >
      <div className={styles.modal}>
        <button className={styles.close} type="button" onClick={onClose} aria-label="Close quickstart">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <span className={styles.eyebrow}>Getting started · {step + 1}/{total}</span>
        <h2 className={styles.heading}>{heading}</h2>
        <p className={styles.body}>{slide.body}</p>

        <div className={styles.dots} aria-hidden="true">
          {QUICKSTART_SLIDES.map((s, i) => (
            <span key={s.id} className={`${styles.dot} ${i === step ? styles.dotActive : ''}`} />
          ))}
        </div>

        <div className={styles.actions}>
          {!isFirst && (
            <button
              className={styles.back}
              type="button"
              onClick={() => setStep((s) => Math.max(s - 1, 0))}
            >
              Back
            </button>
          )}
          <button className={styles.primary} type="button" onClick={handleAction}>
            {slide.action.label}
          </button>
        </div>

        <button className={styles.skip} type="button" onClick={onClose}>
          Skip for now
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write the styles**

Create `src/components/QuickstartGuide/QuickstartGuide.module.css`. Use design
tokens from `src/index.css` (`--color-bg`, `--color-text`, `--color-accent`); do
not hardcode brand hex values:

```css
.backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(4px);
  z-index: 300;
  display: grid;
  place-items: center;
  padding: 1.5rem;
  animation: pageFade 0.2s ease both;
}

.modal {
  position: relative;
  width: 100%;
  max-width: 460px;
  background: var(--color-bg);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  padding: 2.25rem 2rem 1.5rem;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.5);
  text-align: center;
  animation: pageRise 0.25s ease both;
}

.close {
  position: absolute;
  top: 1rem;
  right: 1rem;
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  color: var(--color-text);
  opacity: 0.6;
  transition: opacity 0.15s, background 0.15s;
}
.close:hover { opacity: 1; background: rgba(255, 255, 255, 0.08); }

.eyebrow {
  display: inline-block;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-accent);
  margin-bottom: 0.85rem;
}

.heading {
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin-bottom: 0.75rem;
  color: var(--color-text);
}

.body {
  font-size: 0.95rem;
  line-height: 1.65;
  color: var(--color-text);
  opacity: 0.75;
  margin: 0 auto 1.5rem;
  max-width: 36ch;
}

.dots {
  display: flex;
  justify-content: center;
  gap: 0.4rem;
  margin-bottom: 1.5rem;
}
.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  transition: background 0.2s, transform 0.2s;
}
.dotActive { background: var(--color-accent); transform: scale(1.25); }

.actions {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
}

.primary {
  flex: 1;
  max-width: 280px;
  padding: 0.8rem 1.5rem;
  background: var(--color-accent);
  color: #fff;
  border-radius: 12px;
  font-weight: 600;
  font-size: 0.95rem;
  transition: opacity 0.15s, transform 0.15s;
}
.primary:hover { opacity: 0.9; transform: translateY(-1px); }

.back {
  padding: 0.8rem 1.25rem;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  color: var(--color-text);
  font-weight: 500;
  font-size: 0.95rem;
  transition: border-color 0.15s;
}
.back:hover { border-color: var(--color-accent); }

.skip {
  margin-top: 1rem;
  font-size: 0.8rem;
  color: var(--color-text);
  opacity: 0.5;
  transition: opacity 0.15s;
}
.skip:hover { opacity: 0.85; }
```

> **Note:** `pageFade` and `pageRise` keyframes are defined globally in
> `src/index.css` (per CLAUDE.md). If a lint/build error reports them missing,
> replace the `animation` lines with a local `@keyframes` fallback, but they
> should resolve globally.

- [ ] **Step 3: Verify it compiles**

Run: `npm run build`
Expected: `tsc -b && vite build` completes with no errors referencing
`QuickstartGuide`.

- [ ] **Step 4: Commit**

```bash
git add src/components/QuickstartGuide/QuickstartGuide.tsx src/components/QuickstartGuide/QuickstartGuide.module.css
git commit -m "feat: add QuickstartGuide modal component"
```

---

## Task 4: Wire the guide into DashboardPage

**Files:**
- Modify: `src/pages/DashboardPage.tsx`

- [ ] **Step 1: Add the import**

Near the other component imports (after the `PromptInput` import around
`src/pages/DashboardPage.tsx:9`), add:

```tsx
import QuickstartGuide from '../components/QuickstartGuide/QuickstartGuide'
import { shouldShowQuickstart } from '../lib/quickstart'
```

- [ ] **Step 2: Add state for the guide**

After the `const [sidebarOpen, setSidebarOpen] = useState(false)` line
(`src/pages/DashboardPage.tsx:110`), add:

```tsx
  const [showQuickstart, setShowQuickstart] = useState(false)
```

- [ ] **Step 3: Fetch the flag on mount**

Add a new effect immediately after the provider-status effect (which ends near
`src/pages/DashboardPage.tsx:286`). Insert:

```tsx
  // First-login quickstart guide — show once per account.
  useEffect(() => {
    if (!user) return
    let cancelled = false
    supabase
      .from('profiles')
      .select('has_seen_quickstart')
      .eq('id', user.id)
      .single()
      .then(({ data, error }) => {
        if (error) {
          logError('DashboardQuickstartFlag', error)
          return
        }
        if (!cancelled && shouldShowQuickstart(data?.has_seen_quickstart)) {
          setShowQuickstart(true)
        }
      })
    return () => { cancelled = true }
  }, [user])
```

- [ ] **Step 4: Add the dismiss handler**

Add this `useCallback` alongside the other handlers (e.g. after
`handleExampleClick` near `src/pages/DashboardPage.tsx:507`):

```tsx
  const handleQuickstartClose = useCallback(async () => {
    setShowQuickstart(false)
    if (!user) return
    const { error } = await supabase
      .from('profiles')
      .update({ has_seen_quickstart: true })
      .eq('id', user.id)
    if (error) logError('DashboardQuickstartDismiss', error)
  }, [user])
```

- [ ] **Step 5: Render the guide**

Inside the top-level `<>...</>` return, render the guide as a sibling of the
other modals — directly after the opening `<>` is fine, but to match the
existing "modals live after `</div>` root" pattern, add it right before the
Publish modal block (`{publishingProject && (` near
`src/pages/DashboardPage.tsx:1033`):

```tsx
      {showQuickstart && (
        <QuickstartGuide firstName={firstName} onClose={handleQuickstartClose} />
      )}

```

(`firstName` is already computed at `src/pages/DashboardPage.tsx:124`.)

- [ ] **Step 6: Verify build and lint**

Run: `npm run build && npm run lint`
Expected: no errors. (`useCallback` and `useEffect` are already imported at
`src/pages/DashboardPage.tsx:1`.)

- [ ] **Step 7: Commit**

```bash
git add src/pages/DashboardPage.tsx
git commit -m "feat: show quickstart guide to first-login users on dashboard"
```

---

## Task 5: TemplatesPage deep-link to a template

**Files:**
- Modify: `src/pages/TemplatesPage.tsx`

- [ ] **Step 1: Read the route state**

`useNavigate` is already imported. Add `useLocation` to the existing
`react-router-dom` import at `src/pages/TemplatesPage.tsx:2`:

```tsx
import { useNavigate, useLocation } from 'react-router-dom'
```

Then, inside the component after `const navigate = useNavigate()`
(`src/pages/TemplatesPage.tsx:32`), add:

```tsx
  const location = useLocation()
```

- [ ] **Step 2: Auto-open the requested template**

Add a new effect after the existing "Build live previews" effect (which ends near
`src/pages/TemplatesPage.tsx:55`):

```tsx
  // Deep-link: open a specific template's preview when navigated here with state
  // (e.g. from the first-login quickstart guide).
  useEffect(() => {
    const openId = (location.state as { openTemplateId?: string } | null)?.openTemplateId
    if (!openId) return
    const match = templates.find((t) => t.id === openId)
    if (match) {
      setSelected(match)
      setDeviceMode('desktop')
    }
  }, [location.state, templates])
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: compiles cleanly. The Restaurant template (`id: 'restaurant-landing'`,
confirmed in `src/lib/templates.ts:1515`) will auto-open its preview overlay when
the quickstart "Open Restaurant template" button routes here.

- [ ] **Step 4: Commit**

```bash
git add src/pages/TemplatesPage.tsx
git commit -m "feat: deep-link templates page to auto-open a template preview"
```

---

## Task 6: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm run test`
Expected: all tests pass, including the new `quickstart.test.ts`.

- [ ] **Step 2: Lint and build**

Run: `npm run lint && npm run build`
Expected: no errors.

- [ ] **Step 3: Manual smoke test (requires migration applied)**

After `supabase db push` against a dev project:
1. Create a fresh account (or set `has_seen_quickstart = false` on your profile
   row via SQL).
2. Land on `/dashboard` → the guide appears starting at "Welcome to OpenThorn,
   <name>".
3. Step through with Next/Back; dots track position.
4. Press "Go to Providers" → guide closes, routes to `/providers`.
5. Reload `/dashboard` → guide does NOT reappear (flag persisted).
6. Reset the flag to `false`, reload, advance to the Restaurant slide, press
   "Open Restaurant template" → lands on `/templates` with the Restaurant
   preview overlay open.

- [ ] **Step 4: Final commit (if any cleanup)**

```bash
git add -A
git commit -m "chore: quickstart guide verification cleanup"
```

---

## Self-Review notes

- **Spec coverage:** show-once DB flag (Task 1), read/dismiss flow (Task 4),
  component + 5 slides with action buttons (Tasks 2–3), Providers/Templates/
  Restaurant deep-link CTAs (Tasks 2 & 5), backfill of existing users (Task 1),
  out-of-scope items omitted. All spec sections mapped.
- **Type consistency:** `QuickstartSlide.action` discriminated union is defined
  in Task 2 and consumed unchanged in Task 3; `shouldShowQuickstart` signature
  matches its use in Task 4; `openTemplateId` state key is identical in the slide
  config (Task 2) and the TemplatesPage reader (Task 5).
- **No placeholders:** every code step contains complete, copy-ready content.
