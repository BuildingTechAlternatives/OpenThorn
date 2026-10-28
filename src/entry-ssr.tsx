import { StrictMode } from 'react'
import { prerender } from 'react-dom/static'
// StaticRouter lives in the core react-router package in v7 (react-router-dom
// re-exports only the DOM/browser APIs).
import { StaticRouter } from 'react-router'
import { StaticAuthProvider } from './lib/AuthContext'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary'

/**
 * Build-time SSR used by scripts/prerender.mjs. react-dom/static's prerender
 * (unlike renderToString) waits for Suspense — including the React.lazy route
 * pages — so the returned HTML contains the fully rendered page body.
 */
export async function render(path: string): Promise<string> {
  const { prelude } = await prerender(
    <StrictMode>
      <ErrorBoundary>
        <StaticRouter location={path}>
          <StaticAuthProvider>
            <App />
          </StaticAuthProvider>
        </StaticRouter>
      </ErrorBoundary>
    </StrictMode>
  )

  const reader = prelude.getReader()
  const decoder = new TextDecoder()
  let html = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    html += decoder.decode(value, { stream: true })
  }
  return html
}
