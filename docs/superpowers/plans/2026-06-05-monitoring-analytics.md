# Monitoring & Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Sentry error monitoring and PostHog product analytics so production errors surface immediately and user behaviour is measurable.

**Architecture:** Three thin wrapper modules (`sentry.ts`, `analytics.ts`, `useAnalytics.ts`) keep all third-party coupling out of app code. Both are initialised once in `main.tsx` before `createRoot`; both are fully optional — missing env vars make them no-ops. Auth identity is wired in `AuthContext` so every error and event is attributed to a real user.

**Tech Stack:** `@sentry/react` (Sentry SDK for React), `posthog-js` (PostHog JS client), Vite `VITE_` env vars, react-router-dom v7 `useLocation` for SPA page-view tracking.

---

## Prerequisites — create accounts and get keys

Before starting, you need two free accounts:

1. **Sentry** — https://sentry.io → create project → type: React → copy the DSN (looks like `https://abc123@o123.ingest.sentry.io/456`)
2. **PostHog** — https://posthog.com → create project → copy the Project API Key (looks like `phc_abc123…`) and note the host (US cloud: `https://us.i.posthog.com`, EU cloud: `https://eu.i.posthog.com`)

Add to `.env`:
```
VITE_SENTRY_DSN=https://your-dsn@sentry.io/your-project-id
VITE_POSTHOG_KEY=phc_your_key_here
VITE_POSTHOG_HOST=https://us.i.posthog.com
```

Also add these same three vars to your Vercel project's environment variables (Settings → Environment Variables).

---

## Task 1: Install packages

**Files:**
- Modify: `package.json` (via npm install)

- [ ] **Step 1: Install Sentry and PostHog**

```bash
npm install @sentry/react posthog-js
```

Expected output: both packages added to `dependencies` in `package.json`.

- [ ] **Step 2: Verify install**

```bash
npm ls @sentry/react posthog-js
```

Expected: both listed without errors.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install @sentry/react and posthog-js"
```

---

## Task 2: Create `src/lib/sentry.ts`

**Files:**
- Create: `src/lib/sentry.ts`

- [ ] **Step 1: Create the file**

```typescript
import * as Sentry from '@sentry/react'

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) return

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
  })
}

export function captureException(error: Error, extras?: Record<string, unknown>) {
  if (!import.meta.env.VITE_SENTRY_DSN) return
  Sentry.captureException(error, extras ? { extra: extras } : undefined)
}

export function setSentryUser(user: { id: string; email?: string } | null) {
  if (!import.meta.env.VITE_SENTRY_DSN) return
  Sentry.setUser(user)
}
```

Save to `src/lib/sentry.ts`.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build 2>&1 | head -30
```

Expected: build succeeds, no TS errors related to sentry.ts.

- [ ] **Step 3: Commit**

```bash
git add src/lib/sentry.ts
git commit -m "feat: add Sentry wrapper module"
```

---

## Task 3: Create `src/lib/analytics.ts`

**Files:**
- Create: `src/lib/analytics.ts`

- [ ] **Step 1: Create the file**

```typescript
import posthog from 'posthog-js'

export function initAnalytics() {
  const key = import.meta.env.VITE_POSTHOG_KEY
  if (!key) return

  posthog.init(key, {
    api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
    capture_pageview: false,
    persistence: 'localStorage',
  })
}

export function identifyUser(id: string, email?: string) {
  if (!import.meta.env.VITE_POSTHOG_KEY) return
  posthog.identify(id, email ? { email } : undefined)
}

export function resetAnalytics() {
  if (!import.meta.env.VITE_POSTHOG_KEY) return
  posthog.reset()
}

export function trackEvent(name: string, props?: Record<string, unknown>) {
  if (!import.meta.env.VITE_POSTHOG_KEY) return
  posthog.capture(name, props)
}
```

Save to `src/lib/analytics.ts`.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build 2>&1 | head -30
```

Expected: no TS errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/analytics.ts
git commit -m "feat: add PostHog analytics wrapper module"
```

---

## Task 4: Create `src/lib/useAnalytics.ts`

**Files:**
- Create: `src/lib/useAnalytics.ts`

- [ ] **Step 1: Create the file**

```typescript
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { trackEvent } from './analytics'

export function useAnalytics() {
  const location = useLocation()

  useEffect(() => {
    trackEvent('$pageview', { path: location.pathname })
  }, [location.pathname])
}
```

Save to `src/lib/useAnalytics.ts`.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build 2>&1 | head -30
```

Expected: no TS errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/useAnalytics.ts
git commit -m "feat: add useAnalytics hook for SPA page-view tracking"
```

---

## Task 5: Initialise both in `src/main.tsx`

**Files:**
- Modify: `src/main.tsx`

Current file content:
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { SupabaseAuthProvider } from './lib/AuthContext'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <SupabaseAuthProvider>
        <App />
      </SupabaseAuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
```

- [ ] **Step 1: Add imports and init calls**

Replace the entire file with:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { SupabaseAuthProvider } from './lib/AuthContext'
import { initSentry } from './lib/sentry'
import { initAnalytics } from './lib/analytics'
import App from './App'
import './index.css'

initSentry()
initAnalytics()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <SupabaseAuthProvider>
        <App />
      </SupabaseAuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | head -30
```

Expected: clean build.

- [ ] **Step 3: Commit**

```bash
git add src/main.tsx
git commit -m "feat: initialise Sentry and PostHog on app startup"
```

---

## Task 6: Wire page-view tracking in `src/App.tsx`

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Import and use the hook**

Add the import after the existing imports (around line 18):

```tsx
import { useAnalytics } from './lib/useAnalytics'
```

Inside the `App` function (which already renders the `<Routes>`), add a call to `useAnalytics()` as the first line of the function body:

```tsx
export default function App() {
  useAnalytics()

  return (
    <ErrorBoundary>
      ...
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | head -30
```

Expected: clean build.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: track SPA page views on route change"
```

---

## Task 7: Wire user identity in `src/lib/AuthContext.tsx`

**Files:**
- Modify: `src/lib/AuthContext.tsx`

- [ ] **Step 1: Add imports**

At the top of the file, after the existing imports, add:

```tsx
import { identifyUser, resetAnalytics } from './analytics'
import { setSentryUser } from './sentry'
```

- [ ] **Step 2: Wire identity into the auth state listener**

Find the `onAuthStateChange` callback inside the `useEffect` in `SupabaseAuthProvider`. Replace it so it calls the identity helpers:

```tsx
const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
  setSession(session)
  setUser(session?.user ?? null)
  setLoading(false)

  if (session?.user) {
    identifyUser(session.user.id, session.user.email)
    setSentryUser({ id: session.user.id, email: session.user.email })
  } else {
    resetAnalytics()
    setSentryUser(null)
  }
})
```

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | head -30
```

Expected: clean build.

- [ ] **Step 4: Commit**

```bash
git add src/lib/AuthContext.tsx
git commit -m "feat: identify users in Sentry and PostHog on auth state change"
```

---

## Task 8: Wire Sentry into `ErrorBoundary`

**Files:**
- Modify: `src/components/ErrorBoundary/ErrorBoundary.tsx`

- [ ] **Step 1: Add import**

At the top of the file, add:

```tsx
import { captureException } from '../../lib/sentry'
```

- [ ] **Step 2: Replace the comment with an actual call**

Find `componentDidCatch`:

```tsx
componentDidCatch(error: Error, info: ErrorInfo) {
  console.error('[ErrorBoundary]', error, info.componentStack)
  // Future: send to error reporting service (Sentry, etc.)
}
```

Replace with:

```tsx
componentDidCatch(error: Error, info: ErrorInfo) {
  console.error('[ErrorBoundary]', error, info.componentStack)
  captureException(error, { componentStack: info.componentStack ?? undefined })
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | head -30
```

Expected: clean build.

- [ ] **Step 4: Commit**

```bash
git add src/components/ErrorBoundary/ErrorBoundary.tsx
git commit -m "feat: send ErrorBoundary errors to Sentry"
```

---

## Task 9: Track `sign_in` and `sign_up` in `AuthContext`

**Files:**
- Modify: `src/lib/AuthContext.tsx`

- [ ] **Step 1: Track `sign_in` on successful password sign-in**

Find the `signIn` function. After the error check, add the tracking call:

```tsx
const signIn = async (email: string, password: string): Promise<{ error?: string }> => {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: error.message }
  trackEvent('sign_in', { method: 'email' })
  return {}
}
```

Import `trackEvent` at the top of the file (add to the existing analytics import line):

```tsx
import { identifyUser, resetAnalytics, trackEvent } from './analytics'
```

- [ ] **Step 2: Track `sign_up` on successful sign-up**

Find the `signUp` function. After confirming no error, add tracking:

```tsx
const signUp = async (email: string, password: string, name: string): Promise<{ error?: string; needsConfirmation?: boolean }> => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: name } },
  })
  if (error) return { error: error.message }
  trackEvent('sign_up', { method: 'email' })
  if (!data.session) return { needsConfirmation: true }
  return {}
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | head -30
```

Expected: clean build.

- [ ] **Step 4: Commit**

```bash
git add src/lib/AuthContext.tsx
git commit -m "feat: track sign_in and sign_up events"
```

---

## Task 10: Track `project_created` and `project_published` in `DashboardPage`

**Files:**
- Modify: `src/pages/DashboardPage.tsx`

- [ ] **Step 1: Add import**

At the top of `DashboardPage.tsx`, add:

```tsx
import { trackEvent } from '../lib/analytics'
```

- [ ] **Step 2: Track `project_created` in `handlePromptSubmit`**

Find the section in `handlePromptSubmit` after the successful `supabase.upsert` call (around line 262) and before the `navigate` call. Add:

```tsx
trackEvent('project_created', { projectId, title })
```

The relevant section should look like:

```tsx
if (user) {
  const { error } = await supabase
    .from('projects')
    .upsert({ ... }, { onConflict: 'id' })

  if (error) {
    console.error('Failed to save project:', error.message)
  }
}

trackEvent('project_created', { projectId, title })
navigate(`/projects/${projectId}`, { ... })
```

- [ ] **Step 3: Track `project_published` in `handlePublishSubmit`**

Find `handlePublishSubmit`. After `setPublishSuccess(publishingProject.title)` (around line 351), the publish succeeded. Add the tracking call just before the `setPublishingProject(null)` line:

```tsx
trackEvent('project_published', { projectId: publishingProject.id, title: publishingProject.title })
setPublishingProject(null)
setPublishSuccess(publishingProject.title)
```

- [ ] **Step 4: Verify build**

```bash
npm run build 2>&1 | head -30
```

Expected: clean build.

- [ ] **Step 5: Commit**

```bash
git add src/pages/DashboardPage.tsx
git commit -m "feat: track project_created and project_published events from dashboard"
```

---

## Task 11: Track `project_deployed` and `project_published` in `ProjectBuilderPage`

**Files:**
- Modify: `src/pages/ProjectBuilderPage.tsx`

- [ ] **Step 1: Add import**

At the top of `ProjectBuilderPage.tsx`, add:

```tsx
import { trackEvent } from '../lib/analytics'
```

- [ ] **Step 2: Track `project_deployed` in `handleDeploy`**

Find the line `setDeployState('deployed')` (around line 1407). Add the tracking call just before it:

```tsx
trackEvent('project_deployed', { projectId })
setDeployState('deployed')
```

- [ ] **Step 3: Track `project_published` in `handlePublishToCommunity`**

Find `setPublishSuccess(true)` (around line 1369). Add the tracking call just before it:

```tsx
trackEvent('project_published', { projectId, title: title || 'Untitled project' })
setPublishSuccess(true)
```

- [ ] **Step 4: Verify build**

```bash
npm run build 2>&1 | head -30
```

Expected: clean build.

- [ ] **Step 5: Commit**

```bash
git add src/pages/ProjectBuilderPage.tsx
git commit -m "feat: track project_deployed and project_published events from builder"
```

---

## Task 12: Update `.env.example`

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Add the new env vars**

Append to `.env.example`:

```
# Sentry — get DSN from sentry.io > Your Project > Settings > Client Keys
VITE_SENTRY_DSN=https://your-dsn@sentry.io/your-project-id

# PostHog — get key from posthog.com > Your Project > Settings
VITE_POSTHOG_KEY=phc_your_key_here
VITE_POSTHOG_HOST=https://us.i.posthog.com
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "docs: add Sentry and PostHog env var documentation"
```

---

## Task 13: Smoke test in dev

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verify no console errors**

Open the app in the browser and check the browser console. You should see no errors about missing modules or failed initialisation. If `VITE_SENTRY_DSN` / `VITE_POSTHOG_KEY` are not set in `.env`, the wrappers silently no-op — that is correct behaviour.

- [ ] **Step 3: Verify with keys set**

Add real keys to `.env` and restart the dev server. Open the PostHog dashboard — within 30 seconds of navigating between pages in the app you should see `$pageview` events appearing under **Activity**.

- [ ] **Step 4: Verify Sentry**

In the browser console, manually trigger the ErrorBoundary by temporarily throwing in a component, or run:

```js
// In browser console
window.dispatchEvent(new ErrorEvent('error', { error: new Error('test sentry'), message: 'test sentry' }))
```

Check Sentry → Issues — the error should appear within a few seconds.

- [ ] **Step 5: Final build check**

```bash
npm run build && npm run preview
```

Expected: production build compiles, preview server starts without errors.
