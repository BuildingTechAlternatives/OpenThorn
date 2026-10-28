import { describe, expect, it } from 'vitest'
import {
  parseAnnouncement,
  parseDisabledProviders,
  parseFeatureFlags,
} from '../app-config'

describe('parseAnnouncement', () => {
  it('returns the announcement when enabled with text', () => {
    expect(parseAnnouncement({ text: 'Maintenance tonight', link: 'https://x.dev', enabled: true }))
      .toEqual({ text: 'Maintenance tonight', link: 'https://x.dev', enabled: true })
  })

  it('omits empty links', () => {
    expect(parseAnnouncement({ text: 'Hello', link: '', enabled: true }))
      .toEqual({ text: 'Hello', link: undefined, enabled: true })
  })

  it('returns null when disabled, empty, or malformed', () => {
    expect(parseAnnouncement({ text: 'Hi', enabled: false })).toBeNull()
    expect(parseAnnouncement({ text: '   ', enabled: true })).toBeNull()
    expect(parseAnnouncement(null)).toBeNull()
    expect(parseAnnouncement('nope')).toBeNull()
    expect(parseAnnouncement({ enabled: true })).toBeNull()
  })
})

describe('parseDisabledProviders', () => {
  it('keeps only strings', () => {
    expect(parseDisabledProviders(['groq', 42, 'xai', null])).toEqual(['groq', 'xai'])
  })

  it('returns [] for non-arrays', () => {
    expect(parseDisabledProviders(undefined)).toEqual([])
    expect(parseDisabledProviders({ groq: true })).toEqual([])
  })
})

describe('parseFeatureFlags', () => {
  it('keeps only boolean values', () => {
    expect(parseFeatureFlags({ a: true, b: false, c: 'yes', d: 1 })).toEqual({ a: true, b: false })
  })

  it('returns {} for non-objects and arrays', () => {
    expect(parseFeatureFlags(null)).toEqual({})
    expect(parseFeatureFlags([true])).toEqual({})
  })
})
