import { describe, expect, it } from 'vitest'
import {
  isRetryableStatus,
  parseRetryAfter,
  emptyUsage,
  addUsage,
  isContinuationRequest,
  isLikelyBuildRequest,
  mergePromptRequirementsIntoPlan,
  shouldRunVisualReviewForRun,
  shouldRunLayoutGateForRun,
  shouldRejectWholeFileRewrite,
  supportsVisualReview,
  type RunUsage,
} from '../agent'
import { applyPlanUpdate, createPlan, unmetRequirements } from '../agent-plan'

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

describe('agent request planning helpers', () => {
  it('recognizes continuation prompts narrowly', () => {
    expect(isContinuationRequest('continue')).toBe(true)
    expect(isContinuationRequest('Keep going!')).toBe(true)
    expect(isContinuationRequest('continue the dark mode implementation')).toBe(false)
  })

  it('distinguishes build requests from questions about building', () => {
    expect(isLikelyBuildRequest('Can you add a double-jump power-up?')).toBe(true)
    expect(isLikelyBuildRequest('what can you build?')).toBe(false)
    expect(isLikelyBuildRequest('how does the build process work?')).toBe(false)
  })

  it('adds current refine requirements to an existing completed plan', () => {
    const oldPlan = applyPlanUpdate(createPlan('Build a game with score'), {
      check: [1, 2],
    })
    const next = mergePromptRequirementsIntoPlan(
      oldPlan,
      'Add a sound effect toggle for jumps and collisions',
      'refine',
    )

    expect(next.items.length).toBeGreaterThan(oldPlan.items.length)
    expect(unmetRequirements(next).map((item) => item.text).join(' ').toLowerCase()).toContain(
      'sound effect toggle',
    )
  })

  it('does not invent requirements for a plain continuation', () => {
    const plan = createPlan('Add crouching')
    const next = mergePromptRequirementsIntoPlan(plan, 'continue', 'refine')
    expect(next.items).toEqual(plan.items)
  })

  it('runs visual review only when the provider and task support it', () => {
    expect(supportsVisualReview('deepseek', 'deepseek-chat')).toBe(false)
    expect(supportsVisualReview('anthropic', 'claude-sonnet-4-5')).toBe(true)
    expect(supportsVisualReview('openai', 'gpt-4o')).toBe(true)

    expect(shouldRunVisualReviewForRun({
      goal: 'Add screen shake on collision',
      mode: 'refine',
      mutatedPaths: ['src/components/Game.tsx'],
      providerId: 'deepseek',
      modelId: 'deepseek-chat',
    })).toBe(false)
    expect(shouldRunVisualReviewForRun({
      goal: 'Improve the mobile layout',
      mode: 'refine',
      mutatedPaths: ['src/styles/theme.css'],
      providerId: 'anthropic',
      modelId: 'claude-sonnet-4-5',
    })).toBe(true)
  })

  it('runs the deterministic layout gate regardless of vision support', () => {
    // Every create run is visual — gate applies even for a no-vision provider.
    expect(shouldRunLayoutGateForRun({
      goal: 'Build a restaurant website',
      mode: 'create',
      mutatedPaths: [],
    })).toBe(true)
    // Refine that changed a component is visual.
    expect(shouldRunLayoutGateForRun({
      goal: 'Add a new dish card',
      mode: 'refine',
      mutatedPaths: ['src/components/MenuSection.tsx'],
    })).toBe(true)
    // Non-visual refine touching only data → skip.
    expect(shouldRunLayoutGateForRun({
      goal: 'Update the menu prices',
      mode: 'refine',
      mutatedPaths: ['src/data/menu.ts'],
    })).toBe(false)
  })

  it('guards long whole-file rewrites on small refine requests', () => {
    const existingCode = Array.from({ length: 220 }, (_, i) => `const a${i} = ${i}`).join('\n')
    const newCode = Array.from({ length: 230 }, (_, i) => `const b${i} = ${i}`).join('\n')

    expect(shouldRejectWholeFileRewrite({
      mode: 'refine',
      prompt: 'Add a double-jump power-up',
      existingCode,
      newCode,
      alreadyRejected: false,
    })).toBe(true)
    expect(shouldRejectWholeFileRewrite({
      mode: 'refine',
      prompt: 'Add a double-jump power-up',
      existingCode,
      newCode,
      alreadyRejected: true,
    })).toBe(false)
    expect(shouldRejectWholeFileRewrite({
      mode: 'create',
      prompt: 'Build a dino game',
      existingCode,
      newCode,
      alreadyRejected: false,
    })).toBe(false)
  })
})
