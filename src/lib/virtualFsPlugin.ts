import type * as esbuild from 'esbuild-wasm'

const EXTENSIONS = ['', '.tsx', '.ts', '.jsx', '.js', '.css']

function getLoader(path: string): esbuild.Loader {
  if (path.endsWith('.tsx')) return 'tsx'
  if (path.endsWith('.ts')) return 'ts'
  if (path.endsWith('.jsx')) return 'jsx'
  if (path.endsWith('.css')) return 'css'
  if (path.endsWith('.json')) return 'json'
  return 'js'
}

/**
 * Strip a namespace prefix like "virtual:" from a path.
 * esbuild-wasm passes the full string (e.g. "virtual:/src/main.tsx") as args.path
 * instead of just "/src/main.tsx", so we need to strip it everywhere.
 *
 * Does NOT strip URL schemes like "https://".
 */
export function cleanPath(p: string): string {
  const colonIdx = p.indexOf(':')
  if (colonIdx === -1) return p

  // URL scheme like "https://" — colon immediately followed by "//"
  if (p[colonIdx + 1] === '/' && p[colonIdx + 2] === '/') return p

  const slashIdx = p.indexOf('/')
  // Namespace prefix: colon before first slash, or no slash at all
  if (slashIdx === -1 || colonIdx < slashIdx) {
    return p.substring(colonIdx + 1)
  }
  return p
}

export function normalizePath(path: string): string {
  const parts = path.split('/')
  const out: string[] = []
  for (const p of parts) {
    if (p === '..') {
      out.pop()
    } else if (p !== '.' && p !== '') {
      out.push(p)
    }
  }
  return '/' + out.join('/')
}

/**
 * Resolve a relative import against a virtual file map.
 * Exported for testing — this is the core logic the plugin uses.
 *
 * The lookup tolerates keys with or without leading slash, mirroring the
 * dual-key map the plugin builds internally.
 */
export function resolveRelativeImport(
  importPath: string,
  importerPath: string,
  sourceFiles: Record<string, string>,
  fallbackDir: string,
): string | null {
  // Build a tolerance lookup (same as the plugin does)
  const lookup: Record<string, string> = {}
  for (const [key, value] of Object.entries(sourceFiles)) {
    lookup[key] = value
    if (key.startsWith('/')) {
      lookup[key.slice(1)] = value
    } else {
      lookup['/' + key] = value
    }
  }

  const importerClean = cleanPath(importerPath)
  const dir = importerClean
    ? importerClean.replace(/\/[^/]*$/, '')
    : fallbackDir

  const candidateBase = normalizePath(`${dir}/${importPath}`)

  for (const ext of EXTENSIONS) {
    const candidate = candidateBase + ext
    if (lookup[candidate] !== undefined) {
      return candidate
    }
  }

  // Try index files
  for (const ext of ['.tsx', '.ts', '.jsx', '.js']) {
    const indexCandidate = candidateBase.replace(/\/$/, '') + '/index' + ext
    if (lookup[indexCandidate] !== undefined) {
      return indexCandidate
    }
  }

  return null
}

export interface VirtualFile {
  path: string
  content: string
}

/**
 * Creates an esbuild plugin that serves files from an in-memory map.
 * External npm packages stay as bare specifiers so the browser import map resolves them.
 *
 * @param files    File map keyed by absolute paths (e.g. '/src/App.tsx').
 *                 Keys WITHOUT a leading slash are also accepted as aliases.
 * @param resolveDir Fallback directory for relative imports when the importer
 *                   path is unavailable (e.g. stdin / entry-point resolution).
 */
export function createVirtualFsPlugin(files: Record<string, string>, resolveDir = '/src') {
  // Build a dual-key map so lookups work regardless of leading-slash format
  const lookup: Record<string, string> = {}
  for (const [key, value] of Object.entries(files)) {
    lookup[key] = value
    if (key.startsWith('/')) {
      lookup[key.slice(1)] = value
    } else {
      lookup['/' + key] = value
    }
  }

  return {
    name: 'virtual-fs',
    setup(build: esbuild.PluginBuild) {
      build.onResolve({ filter: /.*/ }, (args) => {
        // Already resolved to an external URL — pass through
        if (args.path.startsWith('https://') || args.path.startsWith('http://')) {
          return { path: args.path, external: true }
        }

        // Strip namespace prefix — esbuild-wasm passes "virtual:/src/main.tsx"
        let resolvedPath = cleanPath(args.path)

        if (args.path.startsWith('.')) {
          // Extract directory from the importer's virtual path.
          // We avoid args.resolveDir because Node esbuild converts it to a real
          // filesystem path (e.g. C:\...\src on Windows), which breaks virtual
          // path resolution. The importer is always a clean virtual path.
          const importerClean = cleanPath(args.importer || '')
          const dir = importerClean
            ? importerClean.replace(/\/[^/]*$/, '')
            : resolveDir

          resolvedPath = normalizePath(`${dir}/${args.path}`)
        } else if (!resolvedPath.startsWith('/')) {
          // Bare specifier — keep as-is; the browser import map resolves it
          return { path: resolvedPath, external: true }
        }

        // Try the path as-is, then with extensions
        for (const ext of EXTENSIONS) {
          const candidate = resolvedPath + ext
          if (lookup[candidate] !== undefined) {
            return { path: candidate, namespace: 'virtual' }
          }
        }

        // Try index files
        for (const ext of ['.tsx', '.ts', '.jsx', '.js']) {
          const indexCandidate = resolvedPath.replace(/\/$/, '') + '/index' + ext
          if (lookup[indexCandidate] !== undefined) {
            return { path: indexCandidate, namespace: 'virtual' }
          }
        }

        // For relative / absolute imports we couldn't resolve: produce an error.
        // Bare specifiers (npm packages) fall through — other plugins or the
        // browser import map may handle them.
        if (args.path.startsWith('.') || args.path.startsWith('/')) {
          return {
            errors: [{ text: `Could not resolve "${args.path}"`, location: { file: args.importer || resolvedPath } }],
          }
        }

        return undefined
      })

      // Serve file contents from the in-memory map
      build.onLoad({ filter: /.*/, namespace: 'virtual' }, (args) => {
        const clean = cleanPath(args.path)
        const content = lookup[clean]
        if (content === undefined) {
          return {
            errors: [{ text: `File not found: ${clean}`, location: { line: 0, column: 0, file: clean } }],
          }
        }
        return {
          contents: content,
          loader: getLoader(clean),
          resolveDir: clean.substring(0, clean.lastIndexOf('/')),
        }
      })
    },
  }
}
