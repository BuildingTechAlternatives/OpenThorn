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
