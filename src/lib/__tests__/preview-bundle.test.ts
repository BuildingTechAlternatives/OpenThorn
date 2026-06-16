import { describe, it, expect } from 'vitest'
import { buildFilesMap, escapeHtml, type VirtualFile } from '../preview-bundle'

// ---------------------------------------------------------------------------
// Unit tests: escapeHtml
// ---------------------------------------------------------------------------
describe('escapeHtml', () => {
  it('escapes < and >', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;'
    )
  })

  it('escapes double quotes', () => {
    expect(escapeHtml('say "hello"')).toBe('say &quot;hello&quot;')
  })

  it('escapes single quotes', () => {
    expect(escapeHtml("it's")).toBe('it&#39;s')
  })

  it('escapes ampersands', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b')
  })

  it('returns plain text unchanged', () => {
    expect(escapeHtml('Hello World')).toBe('Hello World')
  })

  it('handles empty string', () => {
    expect(escapeHtml('')).toBe('')
  })

  it('escapes a full HTML snippet', () => {
    const input = '<div class="greeting">Hello & welcome</div>'
    const output = escapeHtml(input)
    expect(output).not.toContain('<')
    expect(output).not.toContain('>')
    expect(output).not.toContain('"')
    expect(output).toContain('&lt;')
    expect(output).toContain('&gt;')
    expect(output).toContain('&quot;')
    expect(output).toContain('&amp;')
  })
})

// ---------------------------------------------------------------------------
// Unit tests: buildFilesMap
// ---------------------------------------------------------------------------
describe('buildFilesMap', () => {
  it('prepends / to paths without leading slash', () => {
    const files: VirtualFile[] = [
      { path: 'src/App.tsx', content: '// App' },
      { path: 'src/components/Hero.tsx', content: '// Hero' },
    ]
    const map = buildFilesMap(files)
    expect(map['/src/App.tsx']).toBe('// App')
    expect(map['/src/components/Hero.tsx']).toBe('// Hero')
  })

  it('keeps paths that already have a leading slash', () => {
    const files: VirtualFile[] = [
      { path: '/src/App.tsx', content: '// App' },
    ]
    const map = buildFilesMap(files)
    expect(map['/src/App.tsx']).toBe('// App')
  })

  it('includes the entry point at /src/main.tsx', () => {
    const files: VirtualFile[] = [
      { path: '/src/App.tsx', content: 'export default function App() {}' },
    ]
    const map = buildFilesMap(files)
    expect(map['/src/main.tsx']).toBeDefined()
    expect(map['/src/main.tsx']).toContain('createRoot')
    expect(map['/src/main.tsx']).toContain("import App from './App'")
  })

  it('handles empty file array', () => {
    const map = buildFilesMap([])
    expect(map['/src/main.tsx']).toBeDefined()
  })

  it('maps files with "code" field (ProjectBuilderPage format)', () => {
    // The ProjectBuilderPage codeFiles use "code" not "content".
    // buildFilesMap expects VirtualFile with "content", so we must
    // map before passing. This test guards against regressions.
    const pageFiles = [
      { path: 'src/App.tsx', language: 'tsx', code: '// App code' },
      { path: 'src/components/Hero.tsx', language: 'tsx', code: '// Hero code' },
    ]

    // Simulate the mapping done in ProjectBuilderPage
    const mapped: VirtualFile[] = pageFiles.map((f) => ({ path: f.path, content: f.code }))
    const map = buildFilesMap(mapped)

    // All values must be NON-undefined strings
    for (const value of Object.values(map)) {
      expect(value).toBeDefined()
      expect(typeof value).toBe('string')
    }

    expect(map['/src/App.tsx']).toBe('// App code')
    expect(map['/src/components/Hero.tsx']).toBe('// Hero code')
  })

  it('BUSTED: using "code" field directly produces undefined content', () => {
    // This demonstrates the bug that was fixed:
    // codeFiles use { code } but VirtualFile expects { content }
    const pageFiles = [
      { path: 'src/App.tsx', language: 'tsx', code: '// App code' },
    ]

    // Passing directly — f.content is undefined because the field is f.code
    const map = buildFilesMap(pageFiles as unknown as VirtualFile[])
    expect(map['/src/App.tsx']).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Integration: buildPreview  (using Node esbuild override)
// ---------------------------------------------------------------------------
describe('buildPreview', () => {
  async function runBuild(files: VirtualFile[]) {
    const { buildPreview } = await import('../preview-bundle')
    const esbuild = await import('esbuild')
    return buildPreview(files, esbuild as unknown as typeof import('esbuild-wasm'))
  }

  it('builds a simple project and returns valid HTML', async () => {
    const result = await runBuild([
      { path: '/src/App.tsx', content: `export default function App() { return null }` },
      { path: '/src/styles/theme.css', content: `body { margin: 0 }` },
    ])

    expect(result.errors).toHaveLength(0)
    expect(result.html).toContain('<!DOCTYPE html>')
    expect(result.html).toContain('<div id="root">')
    expect(result.html).toContain('<script type="importmap">')
    expect(result.html).toContain('esm.sh/react@18')
    expect(result.html).toContain('<script type="module">')
  })

  it('returns errors for invalid TypeScript/JSX syntax', async () => {
    const result = await runBuild([
      { path: '/src/App.tsx', content: `export default function App( { return <` },
    ])

    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.html).toBe('')
  })

  it('escapes </script> in the bundled JS output', async () => {
    const result = await runBuild([
      // Use console.log to prevent tree-shaking of the </script> literal
      { path: '/src/App.tsx', content: `const closingTag = '</script>';\nconsole.log(closingTag);\nexport default function App() { return null }` },
    ])

    expect(result.errors).toHaveLength(0)

    // The raw </script> inside the module script must be escaped
    const moduleMatch = result.html.match(/<script type="module">\s*([\s\S]*?)\s*<\/script>/)
    expect(moduleMatch).not.toBeNull()
    const js = moduleMatch![1]
    // Should contain the escaped version, not the raw </script>
    expect(js).toContain('<\\/script>')
    // Should NOT contain the unescaped closing tag
    expect(js).not.toMatch(/(?<!<\\\/)<\/script>/)
  })

  it('includes the import map for react and react-dom', async () => {
    const result = await runBuild([
      { path: '/src/App.tsx', content: `export default function App() { return <div>hi</div> }` },
    ])

    expect(result.errors).toHaveLength(0)

    // Parse the import map from the HTML
    const importMapMatch = result.html.match(/<script type="importmap">([\s\S]*?)<\/script>/)
    expect(importMapMatch).not.toBeNull()
    const importMap = JSON.parse(importMapMatch![1])
    expect(importMap.imports['react']).toContain('esm.sh/react')
    expect(importMap.imports['react-dom']).toContain('esm.sh/react-dom')
    expect(importMap.imports['react-dom/client']).toContain('esm.sh/react-dom')
    expect(importMap.imports['react/jsx-runtime']).toContain('esm.sh/react')
  })

  it('injects a navigation guard for srcdoc hash anchors', async () => {
    const result = await runBuild([
      { path: '/src/App.tsx', content: `export default function App() { return <a href="#cta">Go</a> }` },
    ])

    expect(result.errors).toHaveLength(0)
    expect(result.html).toContain('scrollToFragment')
    expect(result.html).toContain('isPageFragment')
    expect(result.html).toContain("event.target.closest('a[href]')")
  })

  it('injects a navigation guard for internal preview routes', async () => {
    const result = await runBuild([
      { path: '/src/App.tsx', content: `export default function App() { return <a href="/play">Play</a> }` },
    ])

    expect(result.errors).toHaveLength(0)
    expect(result.html).toContain('toPreviewRoute')
    expect(result.html).toContain("window.location.hash = toPreviewRoute(url.pathname, url.search, url.hash).slice(1)")
    expect(result.html).toContain("url.hostname === 'localhost'")
  })

  it('builds a multi-file project with components and CSS', async () => {
    const result = await runBuild([
      { path: '/src/App.tsx', content: `import Hero from './components/Hero'\nimport Features from './components/Features'\nimport './styles/theme.css'\n\nexport default function App() {\n  return (\n    <div>\n      <Hero />\n      <Features />\n    </div>\n  )\n}` },
      { path: '/src/components/Hero.tsx', content: `export default function Hero() {\n  return (\n    <section className="hero">\n      <h1>Build stunning websites<span className="highlight"> with AI</span></h1>\n      <p>Production-ready frontends in seconds.</p>\n    </section>\n  )\n}` },
      { path: '/src/components/Features.tsx', content: `function Card({ title }: { title: string }) { return <div className="feature-card"><h3>{title}</h3></div> }\nconst ITEMS = [{ title: 'Lightning fast' }, { title: 'Beautiful by default' }]\nexport default function Features() {\n  return <section className="features"><div className="features-grid">{ITEMS.map((f) => <Card key={f.title} title={f.title} />)}</div></section>\n}` },
      { path: '/src/styles/theme.css', content: `.hero h1 { font-size: 64px; font-weight: 900; }\n.hero .highlight { color: #7c3aed; }\n.features { padding: 100px 32px; }\n.features-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }\n.feature-card { padding: 32px; border-radius: 16px; background: #fff; }` },
    ])

    expect(result.errors).toHaveLength(0)
    expect(result.html).toContain('<!DOCTYPE html>')
    expect(result.html).toContain('Build stunning websites')
    expect(result.html).toContain('#7c3aed')
    expect(result.html).toContain('feature-card')
  })
})

// ---------------------------------------------------------------------------
// Integration: instrumented preview (visual click-to-edit)
// ---------------------------------------------------------------------------
describe('buildPreview instrument option', () => {
  const FILES: VirtualFile[] = [
    { path: '/src/App.tsx', content: `export default function App(){ return <h1>Hi</h1> }` },
  ]

  async function build(opts?: { instrument?: boolean }) {
    const { buildPreview } = await import('../preview-bundle')
    const esbuild = await import('esbuild')
    return buildPreview(FILES, esbuild as unknown as typeof import('esbuild-wasm'), opts)
  }

  it('uses the dev jsx runtime + data-URL shim when instrument is true', async () => {
    const { html, errors } = await build({ instrument: true })
    expect(errors).toEqual([])
    expect(html).toMatch(/"react\/jsx-dev-runtime":\s*"data:text\/javascript/)
    expect(html).toContain('jsxDEV')
  })

  it('is unchanged (prod runtime, no shim, no data-oeid) when instrument is omitted', async () => {
    const { html, errors } = await build()
    expect(errors).toEqual([])
    expect(html).not.toContain('jsxDEV')
    expect(html).not.toContain('data-oeid')
    expect(html).toMatch(/"react\/jsx-dev-runtime":\s*"https:\/\/esm\.sh/)
  })

  it('injects the select-mode script when instrument is true', async () => {
    const { html } = await build({ instrument: true })
    expect(html).toContain('__openthornEdit')
  })

  it('omits the select-mode script by default', async () => {
    const { html } = await build()
    expect(html).not.toContain('__openthornEdit')
  })
})
