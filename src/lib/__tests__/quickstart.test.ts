import { describe, it, expect } from 'vitest'
import { QUICKSTART_SLIDES, shouldShowQuickstart } from '../quickstart'

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

describe('QUICKSTART_SLIDES', () => {
  it('starts with an advance action and ends with a finish action', () => {
    expect(QUICKSTART_SLIDES[0].action.type).toBe('advance')
    expect(QUICKSTART_SLIDES[QUICKSTART_SLIDES.length - 1].action.type).toBe('finish')
  })
  it('routes the Providers slide to /providers', () => {
    const slide = QUICKSTART_SLIDES.find((s) => s.id === 'providers')
    expect(slide?.action).toEqual({ type: 'navigate', label: 'Go to Providers', to: '/providers' })
  })
  it('deep-links the Restaurant slide to the restaurant-landing template', () => {
    const slide = QUICKSTART_SLIDES.find((s) => s.id === 'restaurant')
    expect(slide?.action).toMatchObject({
      type: 'navigate',
      to: '/templates',
      state: { openTemplateId: 'restaurant-landing' },
    })
  })
  it('has unique slide ids', () => {
    const ids = QUICKSTART_SLIDES.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
