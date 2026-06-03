import * as esbuildWasm from 'esbuild-wasm'
import { initCompiler } from './compiler'
import { createVirtualFsPlugin, type VirtualFile } from './virtualFsPlugin'

export type { VirtualFile } from './virtualFsPlugin'

/** Opaque type matching the esbuild / esbuild-wasm API subset we use. */
type EsbuildLike = Pick<typeof esbuildWasm, 'build'>

/** Virtual entry point that imports App and renders it into #root. */
const ENTRY_PATH = '/src/main.tsx'

const ENTRY_SOURCE = `import { createRoot } from 'react-dom/client'
import App from './App'

const rootEl = document.getElementById('root')
if (rootEl) {
  createRoot(rootEl).render(<App />)
}
`

export function buildFilesMap(files: VirtualFile[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const f of files) {
    map[f.path.startsWith('/') ? f.path : `/${f.path}`] = f.content
  }
  // Include the entry point in the virtual filesystem
  map[ENTRY_PATH] = ENTRY_SOURCE
  return map
}

function getImportMap(): Record<string, string> {
  // Pin exact versions with esm.sh for reliable ESM builds.
  // Using ?external ensures all packages share a single React instance
  // via the import map rather than each bundling their own copy.
  // This prevents "Cannot read properties of null (reading 'useRef')"
  // which happens when react-router-dom gets a different (or null) React.
  const reactUrl = 'https://esm.sh/react@18.2.0'
  const reactDomUrl = 'https://esm.sh/react-dom@18.2.0'

  return {
    'react': reactUrl,
    'react-dom': reactDomUrl,
    'react-dom/client': `${reactDomUrl}/client`,
    'react/jsx-runtime': `${reactUrl}/jsx-runtime`,
    'react/jsx-dev-runtime': `${reactUrl}/jsx-dev-runtime`,
    'react-router-dom': `https://esm.sh/react-router-dom@6.28.0?external=react,react-dom`,
  }
}

export interface PreviewResult {
  html: string
  errors: string[]
}

/**
 * Build a project from an array of virtual files and return an HTML string
 * suitable for rendering in a sandboxed iframe via `srcdoc`.
 */
export async function buildPreview(
  files: VirtualFile[],
  esbuildOverride?: EsbuildLike,
): Promise<PreviewResult> {
  const esbuild = esbuildOverride ?? esbuildWasm

  // esbuild-wasm needs initialization, Node esbuild does not
  if (!esbuildOverride) {
    await initCompiler()
  }

  const fileMap = buildFilesMap(files)

  let buildResult: Awaited<ReturnType<typeof esbuild.build>>
  try {
    // Use `virtual:` namespace prefix so esbuild resolves the entry point
    // through the plugin instead of hitting the (unavailable) real filesystem.
    buildResult = await esbuild.build({
      entryPoints: [`virtual:${ENTRY_PATH}`],
      bundle: true,
      write: false,
      outdir: 'dist',          // needed by Node esbuild for CSS bundling
      format: 'esm',
      target: 'es2020',
      jsx: 'automatic',
      minify: false,
      plugins: [createVirtualFsPlugin(fileMap)],
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { html: '', errors: [message] }
  }

  const errors = (buildResult.errors ?? []).map((e) => e.text)
  const warnings = (buildResult.warnings ?? []).map((w) => w.text)

  if (errors.length > 0) {
    return { html: '', errors: [...errors, ...warnings.map((w) => `Warning: ${w}`)] }
  }

  const outFiles = buildResult.outputFiles ?? []
  const jsFile = outFiles.find((f) => f.path.endsWith('.js'))
  const cssFile = outFiles.find((f) => f.path.endsWith('.css'))
  const js = jsFile?.text ?? ''

  // Escape </script> sequences so user code can't break out of the inline <script> tag
  const safeJs = js.replace(/<\/script>/gi, '<\\/script>')

  const cssBlock = cssFile
    ? `<style>\n${cssFile.text}\n</style>`
    : ''

  const importMap = JSON.stringify({ imports: getImportMap() }, null, 2)

  // In-memory storage polyfill — sandboxed iframes block localStorage/sessionStorage
  // when allow-same-origin is absent, so we provide noop fallbacks that keep
  // user code (React useState, custom hooks, etc.) from throwing.
  const storagePolyfill = `<script>
(function(){
  if (typeof window === 'undefined') return;
  function makeStorage() {
    var s = {};
    return {
      getItem: function(k){ return k in s ? s[k] : null; },
      setItem: function(k,v){ s[k] = String(v); },
      removeItem: function(k){ delete s[k]; },
      clear: function(){ s = {}; },
      get length(){ return Object.keys(s).length; },
      key: function(i){ var ks = Object.keys(s); return ks[i] || null; }
    };
  }
  try { localStorage.getItem('__sbx_test__'); } catch(e) {
    Object.defineProperty(window, 'localStorage', { value: makeStorage(), configurable: true });
  }
  try { sessionStorage.getItem('__sbx_test__'); } catch(e) {
    Object.defineProperty(window, 'sessionStorage', { value: makeStorage(), configurable: true });
  }
})();
</script>`

  const html = sanitizePreviewHtml(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script type="importmap">${importMap}</script>
  ${cssBlock}
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; }
  </style>
  ${storagePolyfill}
</head>
<body>
  <div id="root"></div>
  <script type="module">
${safeJs}
  </script>
</body>
</html>`)

  return { html, errors: [] }
}

/**
 * Strip any Vite dev-server references from the preview HTML.
 * These can leak in if the agent somehow references the dev server.
 * This is a defensive safety net — the bundled output should never
 * contain these, but if it does, we sanitize them out.
 */
function sanitizePreviewHtml(html: string): string {
  // Remove any scripts that reference localhost or Vite dev artifacts
  return html
    // Strip <script> tags referencing localhost or Vite internals
    .replace(/<script[^>]*src=["']https?:\/\/localhost[^"']*["'][^>]*><\/script>/gi, '')
    .replace(/<script[^>]*src=["']https?:\/\/127\.0\.0\.1[^"']*["'][^>]*><\/script>/gi, '')
    // Strip any inline scripts that reference Vite-specific globals
    .replace(/<script[^>]*>[^<]*\/@vite\/client[^<]*<\/script>/gi, '')
    .replace(/<script[^>]*>[^<]*@react-refresh[^<]*<\/script>/gi, '')
    // Strip importmap entries pointing to localhost
    .replace(/"https?:\/\/localhost[^"]*"/gi, '""')
    .replace(/"https?:\/\/127\.0\.0\.1[^"]*"/gi, '""')
}

/**
 * Escape HTML for safe rendering in error messages.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
