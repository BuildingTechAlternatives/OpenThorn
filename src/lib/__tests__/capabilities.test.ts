import { describe, it, expect, vi, beforeEach } from 'vitest'

// Import the module under test, but we'll also test via mocking
import { detectCapability, hasSharedArrayBuffer } from '../capabilities'

describe('hasSharedArrayBuffer', () => {
  it('returns a boolean without throwing', () => {
    const result = hasSharedArrayBuffer()
    expect(typeof result).toBe('boolean')
  })

  it('returns false when SharedArrayBuffer constructor throws', () => {
    const origCtor = (globalThis as Record<string, unknown>).SharedArrayBuffer
    // Mock: SharedArrayBuffer exists but construction throws
    ;(globalThis as Record<string, unknown>).SharedArrayBuffer = class {
      constructor() { throw new Error('Not available') }
    }
    expect(hasSharedArrayBuffer()).toBe(false)
    // Restore
    ;(globalThis as Record<string, unknown>).SharedArrayBuffer = origCtor
  })

  it('returns false when SharedArrayBuffer is undefined', () => {
    // Save and remove
    const origCtor = (globalThis as Record<string, unknown>).SharedArrayBuffer
    delete (globalThis as Record<string, unknown>).SharedArrayBuffer
    expect(hasSharedArrayBuffer()).toBe(false)
    // Restore
    ;(globalThis as Record<string, unknown>).SharedArrayBuffer = origCtor
  })
})

describe('detectCapability', () => {
  it('returns a valid capability string', () => {
    // Reload module to clear cache or just test that it returns a valid string
    const cap = detectCapability()
    expect(['webcontainer', 'transpiler']).toContain(cap)
  })
})
