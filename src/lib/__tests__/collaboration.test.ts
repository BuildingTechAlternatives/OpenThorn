import { describe, it, expect } from 'vitest'
import { getInitials } from '../useCollaboration'

describe('getInitials', () => {
  it('returns single letter for single name', () => {
    expect(getInitials('Thomas')).toBe('T')
  })

  it('returns two initials for full name', () => {
    expect(getInitials('Thomas Tschinkel')).toBe('TT')
  })

  it('handles extra whitespace', () => {
    expect(getInitials('  John  Doe  ')).toBe('JD')
  })

  it('truncates to 2 chars for multi-word names', () => {
    expect(getInitials('A B C D')).toBe('AB')
  })

  it('uppercases result', () => {
    expect(getInitials('john doe')).toBe('JD')
  })

  it('returns empty string for empty input', () => {
    expect(getInitials('')).toBe('')
  })
})

describe('presence deduplication', () => {
  it('deduplicates entries with the same userId', () => {
    const rawEntries = [
      { userId: 'u1', name: 'Alice', initials: 'A', email: 'alice@x.com' },
      { userId: 'u1', name: 'Alice', initials: 'A', email: 'alice@x.com' },
      { userId: 'u2', name: 'Bob', initials: 'B', email: 'bob@x.com' },
    ]
    const seen = new Set<string>()
    const deduped = rawEntries.filter(p => {
      if (seen.has(p.userId)) return false
      seen.add(p.userId)
      return true
    })
    expect(deduped).toHaveLength(2)
    expect(deduped[0].userId).toBe('u1')
    expect(deduped[1].userId).toBe('u2')
  })
})
