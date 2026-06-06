import * as Sentry from '@sentry/react'

const SENSITIVE_KEYS = /email|password|token|secret|credit_card|card|ssn|phone/i

function scrubObject(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, SENSITIVE_KEYS.test(k) ? '[Filtered]' : v])
  )
}

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) return

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
    beforeSend(event) {
      // Strip PII from request data
      if (event.request?.data && typeof event.request.data === 'object') {
        event.request.data = scrubObject(event.request.data as Record<string, unknown>)
      }
      if (event.request?.headers) {
        event.request.headers = scrubObject(event.request.headers)
      }
      // Strip email from user context — keep only the opaque ID
      if (event.user?.email) {
        delete event.user.email
      }
      return event
    },
  })
}

export function captureException(error: Error, extras?: Record<string, unknown>) {
  if (!import.meta.env.VITE_SENTRY_DSN) return
  Sentry.captureException(error, extras ? { extra: extras } : undefined)
}

export function setSentryUser(user: { id: string; email?: string } | null) {
  if (!import.meta.env.VITE_SENTRY_DSN) return
  // Pass only the opaque ID — never the email — to avoid sending PII to Sentry
  Sentry.setUser(user ? { id: user.id } : null)
}
