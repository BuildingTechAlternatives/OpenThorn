import { describe, it, expect } from 'vitest'
import { findLineTrimmedMatch, applySingleEdit } from '../agent'
import { formatRuntimeReport } from '../preview-runtime-check'

describe('findLineTrimmedMatch', () => {
  const code = [
    'function Game() {',
    '  const { dinoY, score } = state',
    '  return (',
    '    <div className="game">',
    '      <span>{score}</span>',
    '    </div>',
    '  )',
    '}',
  ].join('\n')

  it('matches a block when indentation differs', () => {
    // Model used wrong indentation (no leading spaces) — should still match.
    const target = 'const { dinoY, score } = state'
    const match = findLineTrimmedMatch(code, target)
    expect(match).toEqual({ start: 1, end: 1 })
  })

  it('matches a multi-line block ignoring leading whitespace', () => {
    const target = ['<div className="game">', '<span>{score}</span>', '</div>'].join('\n')
    const match = findLineTrimmedMatch(code, target)
    expect(match).toEqual({ start: 3, end: 5 })
  })

  it('returns null when there is no match', () => {
    expect(findLineTrimmedMatch(code, 'const nope = 1')).toBeNull()
  })

  it('returns null for ambiguous (multiple) matches', () => {
    const dup = ['  return null', '  return null'].join('\n')
    expect(findLineTrimmedMatch(dup, 'return null')).toBeNull()
  })

  it('refuses to match an all-whitespace block', () => {
    expect(findLineTrimmedMatch(code, '   \n  ')).toBeNull()
  })

  it('tolerates a trailing newline in the target', () => {
    const match = findLineTrimmedMatch(code, 'const { dinoY, score } = state\n')
    expect(match).toEqual({ start: 1, end: 1 })
  })
})

describe('applySingleEdit', () => {
  const code = 'const a = 1\nconst b = 2\nconst c = 3'

  it('applies an exact replacement', () => {
    const r = applySingleEdit(code, 'const b = 2', 'const b = 20')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.code).toBe('const a = 1\nconst b = 20\nconst c = 3')
      expect(r.fuzzy).toBe(false)
    }
  })

  it('applies a whitespace-tolerant replacement', () => {
    const r = applySingleEdit(code, '  const b = 2  ', 'const b = 20')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.fuzzy).toBe(true)
  })

  it('rejects empty old_string', () => {
    const r = applySingleEdit(code, '', 'x')
    expect(r).toEqual({ ok: false, reason: 'EMPTY_OLD_STRING' })
  })

  it('rejects identical strings', () => {
    const r = applySingleEdit(code, 'const a = 1', 'const a = 1')
    expect(r).toEqual({ ok: false, reason: 'IDENTICAL_STRINGS' })
  })

  it('rejects multiple matches', () => {
    const dup = 'x = 1\nx = 1'
    const r = applySingleEdit(dup, 'x = 1', 'x = 2')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('MULTIPLE_MATCHES')
  })

  it('reports not found', () => {
    const r = applySingleEdit(code, 'const z = 9', 'const z = 8')
    expect(r).toEqual({ ok: false, reason: 'STRING_NOT_FOUND' })
  })

  it('chains edits like multi_edit does', () => {
    let working = code
    for (const [o, n] of [['const a = 1', 'const a = 10'], ['const c = 3', 'const c = 30']]) {
      const r = applySingleEdit(working, o, n)
      expect(r.ok).toBe(true)
      if (r.ok) working = r.code
    }
    expect(working).toBe('const a = 10\nconst b = 2\nconst c = 30')
  })
})

describe('formatRuntimeReport', () => {
  it('returns null for a clean run', () => {
    expect(
      formatRuntimeReport({ ok: true, ran: true, fatalErrors: [], consoleErrors: [], rendered: true }),
    ).toBeNull()
  })

  it('returns null when the check did not run (no DOM)', () => {
    expect(
      formatRuntimeReport({ ok: true, ran: false, fatalErrors: [], consoleErrors: [], rendered: false }),
    ).toBeNull()
  })

  it('reports fatal runtime errors', () => {
    const report = formatRuntimeReport({
      ok: false,
      ran: true,
      fatalErrors: ['ReferenceError: isJumping is not defined'],
      consoleErrors: [],
      rendered: false,
    })
    expect(report).toContain('isJumping is not defined')
    expect(report).toContain('RUNTIME errors')
  })
})
