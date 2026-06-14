import { describe, it, expect } from 'vitest'
import {
  normalizeWrittenCode,
  findOrphanedStylesheets,
  findDisallowedImageSources,
} from '../agent-lint'

describe('normalizeWrittenCode', () => {
  it('leaves non-code files untouched', () => {
    const css = 'body {\n  color: red;   \n}\n\n\n\n'
    const res = normalizeWrittenCode('css', css)
    expect(res.changed).toBe(false)
    expect(res.code).toBe(css)
  })

  it('strips trailing whitespace and collapses blank-line runs', () => {
    const code = 'const a = 1   \n\n\n\n\nconst b = 2\n'
    const res = normalizeWrittenCode('ts', code)
    expect(res.code).toBe('const a = 1\n\nconst b = 2\n')
    expect(res.changed).toBe(true)
  })

  it('ensures exactly one trailing newline', () => {
    expect(normalizeWrittenCode('ts', 'x\n\n\n').code).toBe('x\n')
    expect(normalizeWrittenCode('ts', 'x').code).toBe('x\n')
  })

  it('removes a provably-unused react hook import', () => {
    const code = [
      "import { useState, useEffect } from 'react'",
      '',
      'export default function App() {',
      '  const [n] = useState(0)',
      '  return <div>{n}</div>',
      '}',
    ].join('\n')
    const res = normalizeWrittenCode('tsx', code)
    expect(res.removedImports).toEqual(['useEffect'])
    expect(res.code).toContain("import { useState } from 'react'")
    expect(res.code).not.toContain('useEffect')
  })

  it('keeps a hook that is actually used (even once in JSX/handler)', () => {
    const code = [
      "import { useState, useCallback } from 'react'",
      'export default function App() {',
      '  const [n, setN] = useState(0)',
      '  const inc = useCallback(() => setN(n + 1), [n])',
      '  return <button onClick={inc}>{n}</button>',
      '}',
    ].join('\n')
    const res = normalizeWrittenCode('tsx', code)
    expect(res.removedImports).toEqual([])
    expect(res.code).toContain('useCallback')
  })

  it('drops the whole import line when every name is unused', () => {
    const code = ["import { useMemo } from 'react'", 'export default function App() {', '  return <div />', '}'].join('\n')
    const res = normalizeWrittenCode('tsx', code)
    expect(res.removedImports).toEqual(['useMemo'])
    expect(res.code).not.toContain("from 'react'")
  })

  it('does not touch aliased imports (conservative)', () => {
    const code = ["import { useState as useS } from 'react'", 'export default () => null'].join('\n')
    const res = normalizeWrittenCode('tsx', code)
    expect(res.removedImports).toEqual([])
    expect(res.code).toContain('useState as useS')
  })

  it('keeps a name that only appears inside a comment (errs toward safe)', () => {
    const code = [
      "import { useRef } from 'react'",
      '// useRef is used elsewhere in a sibling file',
      'export default () => null',
    ].join('\n')
    const res = normalizeWrittenCode('tsx', code)
    expect(res.removedImports).toEqual([])
  })
})

describe('findOrphanedStylesheets', () => {
  const APP_NO_IMPORT = "export default function App(){ return <div/> }"
  const THEME = ':root{ --x: 1 }\nbody{ color: red }'

  it('flags a stylesheet that nothing imports', () => {
    const files = [
      { path: 'src/App.tsx', code: APP_NO_IMPORT },
      { path: 'src/styles/theme.css', code: THEME },
    ]
    expect(findOrphanedStylesheets(files)).toEqual(['src/styles/theme.css'])
  })

  it('treats a stylesheet imported in App.tsx as connected', () => {
    const files = [
      { path: 'src/App.tsx', code: "import './styles/theme.css'\n" + APP_NO_IMPORT },
      { path: 'src/styles/theme.css', code: THEME },
    ]
    expect(findOrphanedStylesheets(files)).toEqual([])
  })

  it('recognizes a CSS @import from another stylesheet', () => {
    const files = [
      { path: 'src/App.tsx', code: "import './index.css'\n" + APP_NO_IMPORT },
      { path: 'src/index.css', code: "@import './theme.css';\nhtml{ height: 100% }" },
      { path: 'src/theme.css', code: THEME },
    ]
    expect(findOrphanedStylesheets(files)).toEqual([])
  })

  it('ignores empty / rule-less stylesheets (nothing to apply)', () => {
    const files = [
      { path: 'src/App.tsx', code: APP_NO_IMPORT },
      { path: 'src/empty.css', code: '/* only a comment */\n' },
    ]
    expect(findOrphanedStylesheets(files)).toEqual([])
  })

  it('does not confuse a longer filename ending with the same name', () => {
    const files = [
      { path: 'src/App.tsx', code: "import './mytheme.css'\n" + APP_NO_IMPORT },
      { path: 'src/mytheme.css', code: THEME },
      { path: 'src/theme.css', code: THEME },
    ]
    // theme.css is NOT imported; mytheme.css is. Only theme.css is orphaned.
    expect(findOrphanedStylesheets(files)).toEqual(['src/theme.css'])
  })
})

describe('findDisallowedImageSources', () => {
  it('allows Unsplash, Picsum, and placehold.co', () => {
    const files = [
      {
        path: 'src/components/Hero.tsx',
        code: [
          '<img src="https://images.unsplash.com/photo-123?auto=format&w=1200&q=80" alt="dish" />',
          '<img src="https://picsum.photos/seed/food/1200/800" alt="x" />',
          '<img src="https://placehold.co/600x400" alt="ph" />',
        ].join('\n'),
      },
    ]
    expect(findDisallowedImageSources(files)).toEqual([])
  })

  it('flags a hotlinked image from a non-free host (by <img src>)', () => {
    const files = [
      { path: 'src/App.tsx', code: '<img src="https://some-brand.com/photo" alt="x" />' },
    ]
    expect(findDisallowedImageSources(files)).toEqual([
      { path: 'src/App.tsx', url: 'https://some-brand.com/photo' },
    ])
  })

  it('flags an image URL by extension and a CSS background url()', () => {
    const files = [
      { path: 'src/data.ts', code: "export const img = 'https://evil.example/cat.jpg'" },
      { path: 'src/styles/theme.css', code: '.hero{ background-image: url("https://news.site/banner.png") }' },
    ]
    const found = findDisallowedImageSources(files).map((b) => b.url).sort()
    expect(found).toEqual([
      'https://evil.example/cat.jpg',
      'https://news.site/banner.png',
    ])
  })

  it('does not flag non-image embeds like a map/video iframe', () => {
    const files = [
      {
        path: 'src/components/Map.tsx',
        code: '<iframe src="https://www.openstreetmap.org/export/embed.html" title="map" />',
      },
    ]
    expect(findDisallowedImageSources(files)).toEqual([])
  })

  it('ignores local/relative and data URIs', () => {
    const files = [
      {
        path: 'src/App.tsx',
        code: '<img src="/logo.png" /><img src="data:image/svg+xml;base64,abc" />',
      },
    ]
    expect(findDisallowedImageSources(files)).toEqual([])
  })
})
