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
