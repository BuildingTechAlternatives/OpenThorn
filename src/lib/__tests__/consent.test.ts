import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Minimal localStorage stand-in — the consent store must work in SSR/node
 * environments where no storage exists, so tests exercise both paths.
 */
class MemoryStorage {
  private map = new Map<string, string>()
  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null
  }
  setItem(key: string, value: string): void {
    this.map.set(key, String(value))
  }
  removeItem(key: string): void {
    this.map.delete(key)
  }
  clear(): void {
    this.map.clear()
  }
  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null
  }
  get length(): number {
    return this.map.size
  }
}

let storage: MemoryStorage

beforeEach(() => {
  storage = new MemoryStorage()
  vi.stubGlobal('localStorage', storage as unknown as Storage)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

async function loadConsent() {
  return await import('../consent')
}

describe('consent store', () => {
  it('reports no consent before a decision', async () => {
    const consent = await loadConsent()
    expect(consent.getConsent()).toBeNull()
    expect(consent.hasAdvertisingConsent()).toBe(false)
  })

  it('accepting advertising consent persists an allow decision', async () => {
    const consent = await loadConsent()
    const saved = consent.saveConsent({ advertising: true })
    expect(saved.advertising).toBe(true)
    expect(consent.hasAdvertisingConsent()).toBe(true)
    expect(saved.decidedAt).toBeTruthy()

    const raw = JSON.parse(storage.getItem('openthorn.consent.v1') as string)
    expect(raw.advertising).toBe(true)
    expect(raw.version).toBe(consent.CONSENT_VERSION)
  })

  it('rejecting keeps advertising disabled', async () => {
    const consent = await loadConsent()
    consent.saveConsent({ advertising: false })
    expect(consent.getConsent()).not.toBeNull()
    expect(consent.hasAdvertisingConsent()).toBe(false)
  })

  it('restores a persisted decision on the next visit', async () => {
    const consent = await loadConsent()
    consent.saveConsent({ advertising: true })

    vi.resetModules()
    const reloaded = await loadConsent()
    expect(reloaded.hasAdvertisingConsent()).toBe(true)
  })

  it('treats corrupted storage as no decision', async () => {
    storage.setItem('openthorn.consent.v1', '{not json')
    const consent = await loadConsent()
    expect(consent.getConsent()).toBeNull()
    expect(consent.hasAdvertisingConsent()).toBe(false)
  })

  it('treats a mismatched schema version as no decision', async () => {
    storage.setItem(
      'openthorn.consent.v1',
      JSON.stringify({ version: 999, advertising: true, decidedAt: '2026-01-01T00:00:00.000Z' }),
    )
    const consent = await loadConsent()
    expect(consent.getConsent()).toBeNull()
  })

  it('treats malformed payloads as no decision', async () => {
    storage.setItem('openthorn.consent.v1', JSON.stringify({ version: 1, advertising: 'yes' }))
    const consent = await loadConsent()
    expect(consent.getConsent()).toBeNull()
  })

  it('notifies subscribers on save and supports unsubscribe', async () => {
    const consent = await loadConsent()
    const listener = vi.fn()
    const unsubscribe = consent.subscribe(listener)

    consent.saveConsent({ advertising: true })
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
    consent.saveConsent({ advertising: false })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('revoking advertising consent disables it after being enabled', async () => {
    const consent = await loadConsent()
    consent.saveConsent({ advertising: true })
    expect(consent.hasAdvertisingConsent()).toBe(true)

    consent.saveConsent({ advertising: false })
    expect(consent.hasAdvertisingConsent()).toBe(false)

    vi.resetModules()
    const reloaded = await loadConsent()
    expect(reloaded.hasAdvertisingConsent()).toBe(false)
  })
})
