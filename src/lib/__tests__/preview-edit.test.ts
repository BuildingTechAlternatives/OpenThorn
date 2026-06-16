import { describe, it, expect } from 'vitest'
import { injectOeidProps } from '../preview-edit'

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
