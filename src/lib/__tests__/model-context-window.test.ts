import { describe, it, expect } from 'vitest'
import {
  parseProviderModels,
  serializeProviderModels,
  providerDefaultContextWindow,
  DEFAULT_PROVIDER_MODELS,
} from '../providers'
import { compactionBudgetTokens } from '../agent'

describe('provider model context window', () => {
  it('parses the contextWindow field from the serialized format', () => {
    const models = parseProviderModels(
      'GPT-5.5|gpt-5.5||1000000, Gemini 3 Flash|gemini-3-flash|recommended|1000000, Old Model|old-id',
    )
    expect(models[0]).toMatchObject({ id: 'gpt-5.5', contextWindow: 1_000_000 })
    // flag + contextWindow both present
    expect(models[1]).toMatchObject({ id: 'gemini-3-flash', recommended: true, contextWindow: 1_000_000 })
    // legacy entry without a contextWindow still parses
    expect(models[2]).toMatchObject({ id: 'old-id' })
    expect(models[2].contextWindow).toBeUndefined()
  })

  it('round-trips through serialize/parse without losing the window or flag', () => {
    const input = [
      { name: 'Claude Sonnet 4.6', id: 'claude-sonnet-4-6', contextWindow: 1_000_000 },
      { name: 'Claude Opus 4.8', id: 'claude-opus-4-8', recommended: true, contextWindow: 200_000 },
      { name: 'No Window', id: 'no-window' },
    ]
    const round = parseProviderModels(serializeProviderModels(input))
    expect(round[0]).toMatchObject({ id: 'claude-sonnet-4-6', contextWindow: 1_000_000 })
    expect(round[1]).toMatchObject({ id: 'claude-opus-4-8', recommended: true, contextWindow: 200_000 })
    expect(round[2].contextWindow).toBeUndefined()
  })

  it('every catalog model declares a context window', () => {
    for (const [providerId, models] of Object.entries(DEFAULT_PROVIDER_MODELS)) {
      for (const model of models) {
        expect(model.contextWindow, `${providerId}/${model.id}`).toBeGreaterThan(0)
      }
    }
  })

  it('sizes the compaction budget from the model window, not a flat cap', () => {
    // 1M model keeps far more than the old flat ~96k.
    expect(compactionBudgetTokens('google', 1_000_000)).toBe(952_000)
    // 200k Claude.
    expect(compactionBudgetTokens('anthropic', 200_000)).toBe(152_000)
    // 128k default-class model.
    expect(compactionBudgetTokens('deepseek', 128_000)).toBe(96_000)
  })

  it('falls back to the provider default when a model has no window', () => {
    // Unknown custom model on a 1M provider.
    expect(compactionBudgetTokens('openai', undefined)).toBe(
      compactionBudgetTokens('openai', providerDefaultContextWindow('openai')),
    )
    // Local Ollama stays small.
    expect(providerDefaultContextWindow('ollama')).toBe(32_000)
    expect(compactionBudgetTokens('ollama', undefined)).toBe(24_000)
  })
})
