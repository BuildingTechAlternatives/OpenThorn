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
  return {
    'react': 'https://esm.sh/react@18',
    'react-dom': 'https://esm.sh/react-dom@18',
    'react-dom/client': 'https://esm.sh/react-dom@18/client',
    'react/jsx-runtime': 'https://esm.sh/react@18/jsx-runtime',
    'react/jsx-dev-runtime': 'https://esm.sh/react@18/jsx-dev-runtime',
    'react-router-dom': 'https://esm.sh/react-router-dom@6',
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

  const html = `<!DOCTYPE html>
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
</head>
<body>
  <div id="root"></div>
  <script type="module">
${safeJs}
  </script>
</body>
</html>`

  return { html, errors: [] }
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
