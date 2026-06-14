import { describe, it, expect } from 'vitest'
import { DASHBOARD_TOUR_STEPS, shouldShowQuickstart } from '../quickstart'

describe('shouldShowQuickstart', () => {
  it('shows only when the flag is explicitly false', () => {
    expect(shouldShowQuickstart(false)).toBe(true)
  })
  it('does not show when already seen', () => {
    expect(shouldShowQuickstart(true)).toBe(false)
  })
  it('does not show while unknown/loading (null or undefined)', () => {
    expect(shouldShowQuickstart(null)).toBe(false)
    expect(shouldShowQuickstart(undefined)).toBe(false)
  })
})

describe('DASHBOARD_TOUR_STEPS', () => {
  it('targets the providers, templates, and prompt anchors', () => {
    expect(DASHBOARD_TOUR_STEPS.map((s) => s.element)).toEqual([
      '[data-tour="providers"]',
      '[data-tour="templates"]',
      '[data-tour="prompt"]',
    ])
  })
  it('gives every step a title and description', () => {
    for (const step of DASHBOARD_TOUR_STEPS) {
      expect(step.title.length).toBeGreaterThan(0)
      expect(step.description.length).toBeGreaterThan(0)
    }
  })
})
