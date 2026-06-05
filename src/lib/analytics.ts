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
