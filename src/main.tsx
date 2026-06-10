import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <SupabaseAuthProvider>
          <App />
        </SupabaseAuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
