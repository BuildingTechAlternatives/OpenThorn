import { describe, expect, it } from 'vitest'
import {
  isRetryableStatus,
  parseRetryAfter,
  emptyUsage,
  addUsage,
  type RunUsage,
} from '../agent'

describe('isRetryableStatus', () => {
  it('retries timeouts, rate limits, and server errors', () => {
    expect(isRetryableStatus(408)).toBe(true)
    expect(isRetryableStatus(429)).toBe(true)
    expect(isRetryableStatus(500)).toBe(true)
    expect(isRetryableStatus(502)).toBe(true)
    expect(isRetryableStatus(503)).toBe(true)
    expect(isRetryableStatus(529)).toBe(true) // Anthropic "overloaded"
  })

  it('does not retry auth or validation errors', () => {
    expect(isRetryableStatus(400)).toBe(false)
    expect(isRetryableStatus(401)).toBe(false)
    expect(isRetryableStatus(403)).toBe(false)
    expect(isRetryableStatus(404)).toBe(false)
    expect(isRetryableStatus(422)).toBe(false)
    expect(isRetryableStatus(200)).toBe(false)
  })
})

describe('parseRetryAfter', () => {
  it('returns null for missing or unparseable headers', () => {
    expect(parseRetryAfter(null)).toBeNull()
    expect(parseRetryAfter('soon')).toBeNull()
    expect(parseRetryAfter('')).toBeNull()
  })

  it('parses delta-seconds into milliseconds', () => {
    expect(parseRetryAfter('2')).toBe(2000)
    expect(parseRetryAfter('0')).toBe(0)
  })

  it('caps very large delays', () => {
    expect(parseRetryAfter('3600')).toBe(30_000)
  })

  it('parses HTTP dates relative to now', () => {
    const inFiveSeconds = new Date(Date.now() + 5000).toUTCString()
    const delay = parseRetryAfter(inFiveSeconds)
    expect(delay).not.toBeNull()
    expect(delay!).toBeGreaterThan(0)
    expect(delay!).toBeLessThanOrEqual(5000)
  })

  it('clamps past HTTP dates to zero', () => {
    const past = new Date(Date.now() - 60_000).toUTCString()
    expect(parseRetryAfter(past)).toBe(0)
  })
})

describe('usage accounting', () => {
  it('emptyUsage starts at zero', () => {
    expect(emptyUsage()).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    })
  })

  it('addUsage sums all fields', () => {
    const a: RunUsage = { inputTokens: 100, outputTokens: 20, cacheReadTokens: 80, cacheWriteTokens: 10 }
    const b: RunUsage = { inputTokens: 50, outputTokens: 5, cacheReadTokens: 40, cacheWriteTokens: 0 }
    expect(addUsage(a, b)).toEqual({
      inputTokens: 150,
      outputTokens: 25,
      cacheReadTokens: 120,
      cacheWriteTokens: 10,
    })
  })

  it('addUsage with undefined delta returns the total unchanged', () => {
    const a = emptyUsage()
    expect(addUsage(a, undefined)).toEqual(a)
  })
})
