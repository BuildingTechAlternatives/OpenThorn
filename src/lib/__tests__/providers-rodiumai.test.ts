import { describe, expect, it } from 'vitest'

import {
  DEFAULT_PROVIDER_MODELS,
  PROVIDER_DEFS,
  PROVIDERS,
} from '../providers'

describe('RodiumAi provider registry', () => {
  it('is registered with OpenAI-compatible format', () => {
    const def = PROVIDER_DEFS.rodiumai
    expect(def).toBeDefined()
    expect(def.apiFormat).toBe('openai')
    expect(def.baseUrl).toBe('https://api.rodiumai.io/v1')
    expect(def.testable).toBe(true)
    expect(def.getKeyUrl).toContain('rodiumai.io')
  })

  it('appears in the PROVIDERS list', () => {
    expect(PROVIDERS.some((p) => p.id === 'rodiumai')).toBe(true)
  })

  it('ships default models for offline picker fallback', () => {
    const models = DEFAULT_PROVIDER_MODELS.rodiumai
    expect(models.length).toBeGreaterThanOrEqual(10)
    expect(models.some((m) => m.id === 'anthropic/claude-sonnet-4-6')).toBe(true)
    expect(models.some((m) => m.id === 'anthropic/claude-opus-4-8')).toBe(true)
    expect(models.some((m) => m.id === 'anthropic/claude-fable-5')).toBe(false)
  })
})
