import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { SupabaseAuthProvider } from './lib/AuthContext'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary'
import '@fontsource-variable/fraunces/opsz.css'
import '@fontsource/roboto/300.css'
import '@fontsource/roboto/400.css'
import '@fontsource/roboto/400-italic.css'
import '@fontsource/roboto/500.css'
import '@fontsource/roboto/700.css'
import '@fontsource/roboto/900.css'
import './index.css'

// Prerendered per-route JSON-LD (scripts/prerender.mjs) exists for crawlers
// that don't run JS. Once the app boots, useJsonLd re-injects the schema for
// the current route, so drop the static copies — otherwise Google's rendered
// view sees every schema twice and flags "Duplicate field" errors.
document
  .querySelectorAll('script[type="application/ld+json"][data-prerendered]')
  .forEach((el) => el.remove())

const container = document.getElementById('root')!
const app = (
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <SupabaseAuthProvider>
          <App />
        </SupabaseAuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>
)

// Prerendered routes ship real SSR markup inside #root — hydrate it. The dev
// server and any non-prerendered entry HTML have an empty root — render fresh.
// A hydration mismatch (e.g. visiting /dashboard, which is served the
// prerendered home shell by the SPA rewrite) makes React discard the server
// DOM and client-render — same end state as createRoot.
if (container.hasChildNodes()) {
  hydrateRoot(container, app, {
    // Hydration mismatches are expected on prerendered pages (the SSR build
    // renders logged-out, non-loading auth state; the client's first frame has
    // loading=true) and React recovers by client-rendering. The default
    // handler is reportError, which would trip App's global error banner.
    // In production the recovery is silent and automatic; in dev we log so
    // the mismatch is visible when debugging.
    onRecoverableError: (error) => {
      if (import.meta.env.DEV) console.warn('[hydration]', error)
    },
  })
} else {
  createRoot(container).render(app)
}
