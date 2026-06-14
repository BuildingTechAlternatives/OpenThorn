import { describe, it, expect } from 'vitest'
import {
  extractLessonFromError,
  consolidateLessons,
  type LessonEntry,
} from '../agent-memory'

describe('extractLessonFromError', () => {
  it('returns null for empty/flaky input', () => {
    expect(extractLessonFromError('')).toBeNull()
    expect(extractLessonFromError('   ')).toBeNull()
    expect(extractLessonFromError('network timeout while fetching esm.sh')).toBeNull()
  })

  it('flags the React default-import crash', () => {
    const l = extractLessonFromError('ReferenceError: React is not defined')
    expect(l).toMatch(/named hook imports/i)
  })

  it('names an undefined identifier', () => {
    const l = extractLessonFromError('Uncaught ReferenceError: isJumping is not defined')
    expect(l).toContain('isJumping')
  })

  it('catches a package outside the allowlist', () => {
    const l = extractLessonFromError(`Could not resolve "d3-scale"`)
    expect(l).toContain('d3-scale')
    expect(l).toMatch(/allowlist/i)
  })

  it('catches reading a property off undefined', () => {
    const l = extractLessonFromError("TypeError: Cannot read properties of undefined (reading 'map')")
    expect(l).toContain('.map')
    expect(l).toMatch(/guard/i)
  })

  it('catches an infinite render loop', () => {
    const l = extractLessonFromError('Error: Maximum update depth exceeded')
    expect(l).toMatch(/render loop/i)
  })

  it('caps very long output', () => {
    const l = extractLessonFromError('x'.repeat(50) + ' is not defined')
    expect(l && l.length).toBeLessThanOrEqual(170)
  })
})

describe('consolidateLessons', () => {
  const mk = (date: string, content: string, type: LessonEntry['type'] = 'GOTCHA'): LessonEntry => ({
    date,
    type,
    content,
  })

  it('collapses exact duplicates, keeping the newest date', () => {
    const out = consolidateLessons([
      mk('2026-01-01', 'Use named hook imports.'),
      mk('2026-06-01', 'Use named hook imports.'),
    ])
    expect(out).toHaveLength(1)
    expect(out[0].date).toBe('2026-06-01')
  })

  it('treats punctuation/whitespace/case differences as the same lesson', () => {
    const out = consolidateLessons([
      mk('2026-01-01', 'Guard the value before reading .map'),
      mk('2026-02-01', 'guard the value   before reading .map.'),
    ])
    expect(out).toHaveLength(1)
  })

  it('keeps distinct lessons and caps to maxEntries (newest kept)', () => {
    const entries = Array.from({ length: 10 }, (_, i) =>
      mk(`2026-01-${String(i + 1).padStart(2, '0')}`, `lesson ${i}`),
    )
    const out = consolidateLessons(entries, 3)
    expect(out).toHaveLength(3)
    expect(out.map((e) => e.content)).toEqual(['lesson 7', 'lesson 8', 'lesson 9'])
  })

  it('returns empty for empty input', () => {
    expect(consolidateLessons([])).toEqual([])
  })
})
