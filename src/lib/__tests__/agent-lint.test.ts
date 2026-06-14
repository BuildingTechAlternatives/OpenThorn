import { describe, it, expect } from 'vitest'
import { normalizeWrittenCode } from '../agent-lint'

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
