# Monitoring & Analytics Integration Design

**Date:** 2026-06-05  
**Status:** Approved

## Overview

Integrate Sentry (error monitoring) and PostHog (product analytics) into Bloom. Both are free-tier services. The goal is production visibility: know when things break and understand how users move through the product.

## Sentry — Error Monitoring

**Package:** `@sentry/react`  
**Config:** `VITE_SENTRY_DSN` env var (from Sentry project settings)

Initialize in `main.tsx` before `createRoot`. If `VITE_SENTRY_DSN` is absent (e.g. local dev without the var set), Sentry is a no-op — no errors thrown.

Wire `ErrorBoundary.componentDidCatch` to call `Sentry.captureException(error, { contexts: { react: { componentStack } } })`. This replaces the existing `// Future: send to error reporting service` comment.

Call `Sentry.setUser({ id, email })` inside `SupabaseAuthProvider` whenever auth state changes so every error is attributed to the right user. Call `Sentry.setUser(null)` on sign-out.

Source maps stay off (`sourcemap: false` in vite.config) — Sentry receives minified stack traces which are still useful for error grouping and message capture.

### New file: `src/lib/sentry.ts`

Thin wrapper that exports:
- `initSentry()` — called once in main.tsx
- `captureException(error, extras?)` — safe wrapper, no-ops if DSN missing
- `setSentryUser(user | null)` — wraps `Sentry.setUser`

## PostHog — Product Analytics

**Package:** `posthog-js`  
**Config:** `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST` (defaults to `https://us.i.posthog.com`)

Initialize in `main.tsx` before `createRoot` with `capture_pageview: false` (we track page views manually to handle SPA routing correctly).

### New file: `src/lib/analytics.ts`

Thin wrapper that exports:
- `initAnalytics()` — called once in main.tsx
- `identifyUser(id, email)` — wraps `posthog.identify`
- `resetAnalytics()` — wraps `posthog.reset` on sign-out
- `trackEvent(name, props?)` — wraps `posthog.capture`, no-ops if key missing

### New file: `src/lib/useAnalytics.ts`

Hook that calls `trackEvent('$pageview', { path })` on every react-router location change. Used once at the top of `App.tsx`.

### Auth integration

In `SupabaseAuthProvider`, call `identifyUser` + `setSentryUser` when a user session is established, and `resetAnalytics` + `setSentryUser(null)` on sign-out/session loss.

### Key product events

Tracked at their natural call sites:

| Event | Where |
|---|---|
| `sign_in` | `AuthContext.signIn` on success |
| `sign_up` | `AuthContext.signUp` on success |
| `project_created` | `DashboardPage` after project is created |
| `project_deployed` | `ProjectBuilderPage` after successful deploy |
| `project_published` | `ProjectBuilderPage` / `DashboardPage` after publish |
| `$pageview` | `useAnalytics` hook on route change |

## File Map

```
src/lib/sentry.ts           new — Sentry init + helpers
src/lib/analytics.ts        new — PostHog init + helpers
src/lib/useAnalytics.ts     new — page view hook
src/main.tsx                modified — init both before createRoot
src/lib/AuthContext.tsx     modified — identify/reset on auth state change
src/components/ErrorBoundary/ErrorBoundary.tsx  modified — captureException in componentDidCatch
src/App.tsx                 modified — use useAnalytics hook
src/pages/DashboardPage.tsx modified — track project_created, project_published
src/pages/ProjectBuilderPage.tsx  modified — track project_deployed, project_published
.env.example                modified — add VITE_SENTRY_DSN, VITE_POSTHOG_KEY, VITE_POSTHOG_HOST
```

## Constraints

- Both integrations are fully optional at runtime: missing env vars = no-op, no thrown errors.
- No loading states. All calls are fire-and-forget.
- No changes to existing error handling logic, only additions.
