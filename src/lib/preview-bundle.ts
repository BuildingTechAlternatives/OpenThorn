import * as esbuildWasm from 'esbuild-wasm'
import { initCompiler } from './compiler'
import { createVirtualFsPlugin, type VirtualFile } from './virtualFsPlugin'
// Import the custom hash router source — injected into previews to replace
// react-router-dom which doesn't work in srcdoc/sandboxed iframes.
import bloomRouterSource from '../../public/openthorn-router.js?raw'
import openthornJsxDevSource from '../../public/openthorn-jsx-dev.js?raw'
import openthornDbSource from '../../public/openthorn-db.js?raw'
import { ALLOWED_PACKAGES } from './allowed-packages'
import { buildSelectModeScript } from './preview-edit'

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

const REACT_VERSION = '18.2.0'

function getImportMap(instrument = false, hasBackend = false): Record<string, string> {
  const reactUrl = `https://esm.sh/react@${REACT_VERSION}`
  const reactDomUrl = `https://esm.sh/react-dom@${REACT_VERSION}`

  // Encode the custom hash router as a data URL so it works in srcdoc
  // contexts where relative URLs have no base. The router replaces
  // react-router-dom entirely — no history library, no URL constructor,
  // just window.location.hash + hashchange events.
  const routerDataUrl = 'data:text/javascript;base64,' + toBase64(bloomRouterSource)

  const map: Record<string, string> = {
    'react': reactUrl,
    'react-dom': reactDomUrl,
    'react-dom/client': `${reactDomUrl}/client`,
    'react/jsx-runtime': `${reactUrl}/jsx-runtime`,
    'react/jsx-dev-runtime': `${reactUrl}/jsx-dev-runtime`,
    'react-router-dom': routerDataUrl,
  }

  // Curated third-party allowlist. Sub-path imports (e.g. "date-fns/locale")
  // resolve through esm.sh too via the trailing-slash entry.
  for (const pkg of ALLOWED_PACKAGES) {
    map[pkg.name] = pkg.url
    map[`${pkg.name}/`] = pkg.url.split('?')[0] + '/'
  }

  // When instrumenting for visual click-to-edit, repoint the dev jsx runtime at
  // our shim (served as a data URL) so host elements get a data-oeid attribute.
  if (instrument) {
    map['react/jsx-dev-runtime'] =
      'data:text/javascript;base64,' + toBase64(openthornJsxDevSource)
  }

  // When a backend is connected, expose the injected data-layer client. It is a
  // data-URL module (like the router) that reads window.__OPENTHORN_SUPABASE__ and
  // imports @supabase/supabase-js (resolved from the allowlist above).
  if (hasBackend) {
    map['@openthorn/db'] = 'data:text/javascript;base64,' + toBase64(openthornDbSource)
  }

  return map
}

export interface PreviewResult {
  html: string
  errors: string[]
}

/**
 * Build a project from an array of virtual files and return an HTML string
 * suitable for rendering in a sandboxed iframe via `srcdoc`.
 */
export interface BuildPreviewOptions {
  /** When true, tag host DOM elements with data-oeid and include the select-mode script. */
  instrument?: boolean
  /**
   * When set, inject the project's Supabase config (public url + anon key) and the
   * @openthorn/db client module so generated apps can read/write data + authenticate.
   */
  backend?: { url: string; anonKey: string }
}

export async function buildPreview(
  files: VirtualFile[],
  esbuildOverride?: EsbuildLike,
  opts: BuildPreviewOptions = {},
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
      jsxDev: opts.instrument === true,
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

  const importMap = JSON.stringify({ imports: getImportMap(opts.instrument, Boolean(opts.backend)) }, null, 2)

  // Public Supabase config for the injected @openthorn/db client. Only the public
  // url + anon key (RLS is the security boundary). JSON is escaped so a stray "<"
  // can't break out of the inline <script>.
  const backendConfig = opts.backend
    ? `<script>window.__OPENTHORN_SUPABASE__=${JSON.stringify({ url: opts.backend.url, anonKey: opts.backend.anonKey }).replace(/</g, '\\u003c')};</script>`
    : ''

  // Select-mode script for visual click-to-edit (inert until the parent enables it).
  const selectModeScript = opts.instrument ? buildSelectModeScript() : ''

  // In-memory storage polyfill — sandboxed iframes block localStorage/sessionStorage
  // when allow-same-origin is absent, so we provide noop fallbacks that keep
  // user code (React useState, custom hooks, etc.) from throwing.
  const storagePolyfill = `<script>
(function(){
  if (typeof window === 'undefined') return;

  // ── process.env stub ────────────────────────────────────────
  // Some esm.sh bundles (e.g. @supabase/supabase-js deps) reference process.env
  // at module load; without this they throw "process is not defined" in the iframe.
  if (typeof window.process === 'undefined') { window.process = { env: {} }; }

  // ── Storage polyfill ────────────────────────────────────────
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

  // Keep generated preview navigation inside the srcdoc iframe. Without this,
  // plain anchors such as href="#cta" or href="/play" resolve against the
  // embedding project URL and navigate the sandboxed iframe to the Vite app.
  const previewNavigationGuard = `<script>
(function(){
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  function isModifiedClick(event) {
    return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
  }

  function isSpecialHref(href) {
    return /^(javascript:|mailto:|tel:|data:|blob:)/i.test(href);
  }

  function scrollToFragment(hash) {
    var id = decodeURIComponent(hash.slice(1));
    if (!id) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    var target = document.getElementById(id) || document.getElementsByName(id)[0];
    if (target && typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function toPreviewRoute(pathname, search, hash) {
    var path = pathname || '/';
    if (!path.startsWith('/')) path = '/' + path;
    return '#' + path + (search || '') + (hash || '');
  }

  document.addEventListener('click', function(event) {
    if (event.defaultPrevented || isModifiedClick(event)) return;

    var anchor = event.target && event.target.closest ? event.target.closest('a[href]') : null;
    if (!anchor) return;

    var rawHref = (anchor.getAttribute('href') || '').trim();
    if (!rawHref || isSpecialHref(rawHref)) return;

    var target = (anchor.getAttribute('target') || '').toLowerCase();
    if (target && target !== '_self') return;

    var hasProtocol = /^[a-zA-Z][a-zA-Z\\d+\\-.]*:/.test(rawHref);
    var isRelative = !hasProtocol && !rawHref.startsWith('//');
    var isPreviewHashRoute = rawHref.startsWith('#/');
    var isPageFragment = rawHref.startsWith('#') && !isPreviewHashRoute;

    if (isPageFragment) {
      event.preventDefault();
      scrollToFragment(rawHref);
      return;
    }

    if (isPreviewHashRoute) {
      event.preventDefault();
      window.location.hash = rawHref.slice(1);
      return;
    }

    var url;
    try {
      url = new URL(rawHref, isRelative ? 'http://preview.local/' : window.location.href);
    } catch (error) {
      return;
    }

    var currentOrigin = new URL(window.location.href).origin;
    var isSameOrigin = url.origin === currentOrigin;
    var isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
    if (!isRelative && !isSameOrigin && !isLocalhost) return;

    event.preventDefault();
    window.location.hash = toPreviewRoute(url.pathname, url.search, url.hash).slice(1);
  }, true);
})();
</script>`

  // Neutralize native form submissions. The preview iframe is sandboxed WITHOUT
  // allow-forms (and without allow-same-origin), so a native submit is either
  // blocked outright or navigates the srcdoc away — either way the app breaks.
  // Generated apps (especially auth pages: sign-up / sign-in) use <form>, and
  // not every one calls preventDefault in its onSubmit. We prevent the default
  // in the capture phase so the document never navigates, while the app's own
  // React onSubmit handler still runs (preventDefault stops the navigation, not
  // propagation). This mirrors the runtime smoke test's submit guard, so what
  // passes verification also works in the live preview.
  const formSubmitGuard = `<script>
(function(){
  if (typeof document === 'undefined') return;
  document.addEventListener('submit', function(event){
    if (!event.defaultPrevented) event.preventDefault();
  }, true);
})();
</script>`

  const html = sanitizePreviewHtml(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script type="importmap">${importMap}</script>
  ${backendConfig}
  ${cssBlock}
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; }
  </style>
  ${storagePolyfill}
  ${previewNavigationGuard}
  ${formSubmitGuard}
  ${selectModeScript}
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

/** Cross-platform base64 encoder (works in Node and browsers). */
function toBase64(str: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  const bytes = new TextEncoder().encode(str)
  let result = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i]
    const b2 = i + 1 < bytes.length ? bytes[i + 1] : 0
    const b3 = i + 2 < bytes.length ? bytes[i + 2] : 0
    result += chars[b1 >> 2]
    result += chars[((b1 & 3) << 4) | (b2 >> 4)]
    result += i + 1 < bytes.length ? chars[((b2 & 15) << 2) | (b3 >> 6)] : '='
    result += i + 2 < bytes.length ? chars[b3 & 63] : '='
  }
  return result
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
