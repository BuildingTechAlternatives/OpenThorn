import { describe, it, expect } from 'vitest'
import {
  injectOeidProps,
  composeEditInstruction,
  anchorPopover,
  formatEditLabel,
  applyTextEdit,
  resolveOeidPath,
  type EditSelection,
} from '../preview-edit'

describe('injectOeidProps', () => {
  const source = { fileName: 'virtual:/src/App.tsx', lineNumber: 14, columnNumber: 9 }

  it('adds data-oeid to host (string type) elements', () => {
    const props = { className: 'x' }
    const out = injectOeidProps('h1', props, source)
    expect(out['data-oeid']).toBe('App.tsx:14:9')
    expect(out.className).toBe('x')
  })

  it('does not mutate the caller props object', () => {
    const props = { className: 'x' }
    injectOeidProps('h1', props, source)
    expect('data-oeid' in props).toBe(false)
  })

  it('leaves component (function/non-string type) elements untouched', () => {
    const props = { foo: 1 }
    const Comp = () => null
    expect(injectOeidProps(Comp, props, source)).toBe(props)
  })

  it('returns props unchanged when source is missing', () => {
    const props = { a: 1 }
    expect(injectOeidProps('div', props, undefined)).toBe(props)
  })
})

describe('composeEditInstruction', () => {
  const sel: EditSelection = {
    oeid: 'App.tsx:14:9',
    tag: 'h1',
    text: 'Welcome',
    rect: { top: 10, left: 20, width: 100, height: 40 },
    styles: { color: 'rgb(17,17,17)', fontSize: '48px', fontWeight: '700' },
  }

  it('includes tag, source location, text and the user request', () => {
    const out = composeEditInstruction(sel, 'make it navy and bigger')
    expect(out).toContain('App.tsx:14')
    expect(out).toContain('<h1>')
    expect(out).toContain('Welcome')
    expect(out).toContain('make it navy and bigger')
  })

  it('omits the source location gracefully when oeid is null', () => {
    const out = composeEditInstruction({ ...sel, oeid: null }, 'center this')
    expect(out).not.toContain('null')
    expect(out).toContain('<h1>')
    expect(out).toContain('center this')
  })
})

describe('formatEditLabel', () => {
  const sel: EditSelection = {
    oeid: 'Navbar.tsx:9:5',
    tag: 'a',
    text: 'Features',
    rect: { top: 0, left: 0, width: 0, height: 0 },
    styles: {},
  }

  it('produces a short human-readable label with file and request', () => {
    expect(formatEditLabel(sel, 'The image is not loading')).toBe(
      'Edit <a> in Navbar.tsx: The image is not loading',
    )
  })

  it('omits the file when oeid is null', () => {
    expect(formatEditLabel({ ...sel, oeid: null }, 'make it red')).toBe('Edit <a>: make it red')
  })
})

describe('resolveOeidPath', () => {
  const paths = ['/src/components/Navbar.tsx', '/src/App.tsx']

  it('matches a unique basename', () => {
    expect(resolveOeidPath(paths, 'Navbar.tsx:9:5')).toBe('/src/components/Navbar.tsx')
  })

  it('returns null for null oeid', () => {
    expect(resolveOeidPath(paths, null)).toBeNull()
  })

  it('returns null when the basename is ambiguous', () => {
    expect(resolveOeidPath(['/a/Card.tsx', '/b/Card.tsx'], 'Card.tsx:1:1')).toBeNull()
  })
})

describe('applyTextEdit', () => {
  it('replaces a uniquely-occurring text', () => {
    const code = `<a>Features</a>`
    expect(applyTextEdit(code, 'Features', 'Kebab')).toBe('<a>Kebab</a>')
  })

  it('returns null when the text is absent', () => {
    expect(applyTextEdit('<a>Home</a>', 'Features', 'Kebab')).toBeNull()
  })

  it('returns null when the text occurs more than once (ambiguous)', () => {
    expect(applyTextEdit('<a>Go</a><b>Go</b>', 'Go', 'Stop')).toBeNull()
  })

  it('treats the search text literally (no regex)', () => {
    expect(applyTextEdit('price: $1.50 (each)', '$1.50 (each)', '$2.00')).toBe('price: $2.00')
  })
})

describe('anchorPopover', () => {
  const viewport = { width: 1000, height: 800 }
  const popover = { width: 280, height: 160 }

  it('places the popover below the element when there is room', () => {
    const pos = anchorPopover({ top: 100, left: 100, width: 50, height: 30 }, popover, viewport)
    expect(pos.top).toBe(100 + 30 + 8)
    expect(pos.left).toBe(100)
  })

  it('flips above when there is not enough room below', () => {
    const pos = anchorPopover({ top: 720, left: 100, width: 50, height: 30 }, popover, viewport)
    expect(pos.top).toBe(720 - 160 - 8)
  })

  it('clamps to the right/left edges', () => {
    const pos = anchorPopover({ top: 100, left: 950, width: 50, height: 30 }, popover, viewport)
    expect(pos.left).toBe(1000 - 280 - 8)
    const pos2 = anchorPopover({ top: 100, left: -20, width: 50, height: 30 }, popover, viewport)
    expect(pos2.left).toBe(8)
  })
})
