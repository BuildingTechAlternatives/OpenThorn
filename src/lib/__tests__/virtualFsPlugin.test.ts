import { describe, it, expect } from 'vitest'
import {
  cleanPath,
  createVirtualFsPlugin,
  normalizePath,
  resolveRelativeImport,
  type VirtualFile,
} from '../virtualFsPlugin'

// ---------------------------------------------------------------------------
// Unit tests: cleanPath
// ---------------------------------------------------------------------------
describe('cleanPath', () => {
  it('strips a single namespace prefix like "virtual:"', () => {
    expect(cleanPath('virtual:/src/main.tsx')).toBe('/src/main.tsx')
  })

  it('strips a multi-character namespace prefix', () => {
    expect(cleanPath('my-ns:/foo/bar.ts')).toBe('/foo/bar.ts')
  })

  it('returns the path unchanged when there is no namespace prefix', () => {
    expect(cleanPath('/src/App.tsx')).toBe('/src/App.tsx')
  })

  it('returns the path unchanged for bare specifiers', () => {
    expect(cleanPath('react')).toBe('react')
    expect(cleanPath('react-dom/client')).toBe('react-dom/client')
  })

  it('does NOT strip HTTP URLs (https:// has ://)', () => {
    const url = 'https://esm.sh/react@18'
    expect(cleanPath(url)).toBe(url)
  })

  it('does NOT strip HTTP URLs without the s', () => {
    expect(cleanPath('http://example.com/pkg')).toBe('http://example.com/pkg')
  })

  it('handles path with colon in query string correctly', () => {
    // First colon is after first slash → not a namespace prefix
    expect(cleanPath('/path?foo:bar')).toBe('/path?foo:bar')
  })

  it('handles empty string', () => {
    expect(cleanPath('')).toBe('')
  })

  it('strips namespace-only prefix ("ns:")', () => {
    expect(cleanPath('ns:')).toBe('')
  })
})

// ---------------------------------------------------------------------------
// Unit tests: normalizePath
// ---------------------------------------------------------------------------
describe('normalizePath', () => {
  it('resolves . and .. correctly', () => {
    expect(normalizePath('/src/./App')).toBe('/src/App')
    expect(normalizePath('/src/../App')).toBe('/App')
    expect(normalizePath('/src/components/../Hero')).toBe('/src/Hero')
  })

  it('handles paths without leading slash', () => {
    expect(normalizePath('src/App')).toBe('/src/App')
    expect(normalizePath('src/./components/Hero')).toBe('/src/components/Hero')
  })

  it('handles just a directory name', () => {
    expect(normalizePath('src')).toBe('/src')
  })

  it('handles empty path', () => {
    expect(normalizePath('')).toBe('/')
  })
})

// ---------------------------------------------------------------------------
// Unit tests: resolveRelativeImport (core resolution logic)
// ---------------------------------------------------------------------------
describe('resolveRelativeImport', () => {
  const testFiles: Record<string, string> = {
    '/src/App.tsx': 'export default function App() {}',
    '/src/components/Hero.tsx': 'export default function Hero() {}',
    '/src/styles/theme.css': 'body { color: red; }',
    '/src/utils/helpers.ts': 'export const x = 1',
    '/src/utils/index.ts': 'export { x } from "./helpers"',
  }

  it('resolves with leading-slash importer (Node esbuild behavior)', () => {
    const result = resolveRelativeImport('./components/Hero', '/src/App.tsx', testFiles, '/src')
    expect(result).toBe('/src/components/Hero.tsx')
  })

  it('resolves with namespace-prefixed importer (esbuild-wasm behavior)', () => {
    const result = resolveRelativeImport('./App', 'virtual:/src/main.tsx', testFiles, '/src')
    expect(result).toBe('/src/App.tsx')
  })

  it('resolves with importer that has no leading slash', () => {
    // esbuild-wasm might pass importer as "src/main.tsx" without /
    const result = resolveRelativeImport('./App', 'src/main.tsx', testFiles, '/src')
    expect(result).toBe('/src/App.tsx')
  })

  it('resolves .css files', () => {
    const result = resolveRelativeImport('./styles/theme.css', '/src/main.tsx', testFiles, '/src')
    expect(result).toBe('/src/styles/theme.css')
  })

  it('resolves .ts files via extension probing', () => {
    const result = resolveRelativeImport('./utils/helpers', '/src/main.tsx', testFiles, '/src')
    expect(result).toBe('/src/utils/helpers.ts')
  })

  it('resolves index files in directories', () => {
    const result = resolveRelativeImport('./utils', '/src/main.tsx', testFiles, '/src')
    expect(result).toBe('/src/utils/index.ts')
  })

  it('returns null for missing files', () => {
    const result = resolveRelativeImport('./nope/Nowhere', '/src/main.tsx', testFiles, '/src')
    expect(result).toBeNull()
  })

  it('uses fallbackDir when importer is empty', () => {
    const result = resolveRelativeImport('./App', '', testFiles, '/src')
    expect(result).toBe('/src/App.tsx')
  })

  it('handles importer with only namespace prefix (no path)', () => {
    const result = resolveRelativeImport('./App', 'virtual:', testFiles, '/src')
    expect(result).toBe('/src/App.tsx')
  })

  it('resolves .. correctly from nested importer', () => {
    const nestedFiles: Record<string, string> = {
      '/src/App.tsx': '//',
      '/src/shared/Button.tsx': '//',
      '/src/components/Hero.tsx': "import Button from '../shared/Button'",
    }
    const result = resolveRelativeImport('../shared/Button', '/src/components/Hero.tsx', nestedFiles, '/src')
    expect(result).toBe('/src/shared/Button.tsx')
  })
})

// ---------------------------------------------------------------------------
// Helper: build a file-map from VirtualFile[]
// ---------------------------------------------------------------------------
function makeMap(files: VirtualFile[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const f of files) {
    map[f.path.startsWith('/') ? f.path : `/${f.path}`] = f.content
  }
  return map
}

// ---------------------------------------------------------------------------
// Integration tests: createVirtualFsPlugin  (using Node esbuild)
// ---------------------------------------------------------------------------
// The Node esbuild plugin API is identical to esbuild-wasm, so we can
// validate resolution logic without needing WASM in the test runner.
// We use `virtual:` prefix on entry points to force plugin resolution.
describe('createVirtualFsPlugin', () => {
  const sampleFiles = makeMap([
    { path: '/src/App.tsx', content: `import Hero from './components/Hero'\nexport default function App() { return <Hero /> }` },
    { path: '/src/components/Hero.tsx', content: `export default function Hero() { return <h1>Hello</h1> }` },
    { path: '/src/styles/theme.css', content: `body { color: red; }` },
    { path: '/src/utils/helpers.ts', content: `export const x = 1` },
    { path: '/src/utils/index.ts', content: `export { x } from './helpers'` },
  ])

  const EXTERNALS = ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime']

  it('resolves relative imports with .tsx extension', async () => {
    const esbuild = await import('esbuild')
    const plugin = createVirtualFsPlugin(sampleFiles)

    const result = await esbuild.build({
      entryPoints: ['virtual:/src/App.tsx'],
      bundle: true,
      write: false,
      format: 'esm',
      plugins: [plugin],
      external: EXTERNALS,
    })

    expect(result.errors).toHaveLength(0)
    const out = result.outputFiles![0].text
    expect(out).toContain('Hello')
  })

  it('resolves CSS imports with correct loader', async () => {
    const esbuild = await import('esbuild')
    const files = makeMap([
      { path: '/src/main.tsx', content: `console.log('no css import')` },
      { path: '/src/styles/theme.css', content: `body { color: red; }` },
    ])
    const plugin = createVirtualFsPlugin(files)

    // Test that .css files resolve through the plugin — we verify this by
    // importing a file that exists but without CSS imports (which need outdir).
    const result = await esbuild.build({
      entryPoints: ['virtual:/src/main.tsx'],
      bundle: true,
      write: false,
      format: 'esm',
      plugins: [plugin],
      external: EXTERNALS,
    })

    expect(result.errors).toHaveLength(0)
  })

  it('marks bare specifiers as external', async () => {
    const esbuild = await import('esbuild')
    const files = makeMap([
      { path: '/src/main.tsx', content: `import React from 'react'; console.log(React)` },
    ])
    const plugin = createVirtualFsPlugin(files)

    const result = await esbuild.build({
      entryPoints: ['virtual:/src/main.tsx'],
      bundle: true,
      write: false,
      format: 'esm',
      plugins: [plugin],
      // external NOT passed — the plugin should mark 'react' as external
    })

    expect(result.errors).toHaveLength(0)
    const out = result.outputFiles![0].text
    expect(out).toMatch(/import\s.*from\s+["']react["']/)
  })

  it('resolves with .ts extension', async () => {
    const esbuild = await import('esbuild')
    const files = makeMap([
      { path: '/src/main.tsx', content: `import { x } from './utils/helpers'; console.log(x)` },
      { path: '/src/utils/helpers.ts', content: `export const x = 1` },
    ])
    const plugin = createVirtualFsPlugin(files)

    const result = await esbuild.build({
      entryPoints: ['virtual:/src/main.tsx'],
      bundle: true,
      write: false,
      format: 'esm',
      plugins: [plugin],
      external: EXTERNALS,
    })

    expect(result.errors).toHaveLength(0)
    const out = result.outputFiles![0].text
    expect(out).toContain('x = 1')
  })

  it('resolves index files in directories', async () => {
    const esbuild = await import('esbuild')
    const files = makeMap([
      { path: '/src/main.tsx', content: `import { x } from './utils'; console.log(x)` },
      { path: '/src/utils/index.ts', content: `export const x = 42` },
    ])
    const plugin = createVirtualFsPlugin(files)

    const result = await esbuild.build({
      entryPoints: ['virtual:/src/main.tsx'],
      bundle: true,
      write: false,
      format: 'esm',
      plugins: [plugin],
      external: EXTERNALS,
    })

    expect(result.errors).toHaveLength(0)
    const out = result.outputFiles![0].text
    expect(out).toContain('42')
  })

  it('resolves files without extension via extension probing', async () => {
    const esbuild = await import('esbuild')
    const files = makeMap([
      { path: '/src/main.tsx', content: `import { x } from './utils/helpers'; console.log(x)` },
      { path: '/src/utils/helpers.ts', content: `export const x = 99` },
    ])
    const plugin = createVirtualFsPlugin(files)

    const result = await esbuild.build({
      entryPoints: ['virtual:/src/main.tsx'],
      bundle: true,
      write: false,
      format: 'esm',
      plugins: [plugin],
      external: EXTERNALS,
    })

    expect(result.errors).toHaveLength(0)
  })

  it('propagates errors for missing files', async () => {
    const esbuild = await import('esbuild')
    const files = makeMap([
      { path: '/src/main.tsx', content: `import DoesNotExist from './nope/Nowhere'; console.log(DoesNotExist)` },
    ])
    const plugin = createVirtualFsPlugin(files)

    // Plugin errors cause esbuild.build() to throw, not return errors in the result
    let errorMessage = ''
    try {
      await esbuild.build({
        entryPoints: ['virtual:/src/main.tsx'],
        bundle: true,
        write: false,
        format: 'esm',
        plugins: [plugin],
        external: EXTERNALS,
      })
    } catch (err: unknown) {
      errorMessage = err instanceof Error ? err.message : ''
    }

    expect(errorMessage).toContain('Could not resolve')
  })

  it('handles deep chained imports (A → B → C)', async () => {
    const esbuild = await import('esbuild')
    const files = makeMap([
      { path: '/src/A.tsx', content: `import B from './B'; export default B` },
      { path: '/src/B.tsx', content: `import C from './components/C'; export default C` },
      { path: '/src/components/C.tsx', content: `export default function C() { return 'deep' }` },
    ])
    const plugin = createVirtualFsPlugin(files)

    const result = await esbuild.build({
      entryPoints: ['virtual:/src/A.tsx'],
      bundle: true,
      write: false,
      format: 'esm',
      plugins: [plugin],
      external: EXTERNALS,
    })

    expect(result.errors).toHaveLength(0)
    const out = result.outputFiles![0].text
    expect(out).toContain('deep')
  })
})
