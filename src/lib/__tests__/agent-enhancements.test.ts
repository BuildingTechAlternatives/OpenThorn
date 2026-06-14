import { describe, it, expect } from 'vitest'
import {
  createPlan,
  parsePlan,
  formatPlan,
  applyPlanUpdate,
  extractRequirements,
  unmetRequirements,
  planToSystemReminder,
} from '../agent-plan'
import {
  rememberForUser,
  loadUserMemory,
  inferPreferencesFromPrompt,
  userMemoryToSystemReminder,
  forgetForUser,
} from '../user-memory'
import {
  parseVisualReview,
  formatVisualFeedback,
  buildVisualReviewPrompt,
} from '../agent-vision'
import { formatTypeErrors } from '../typecheck'
import {
  getReasoningParams,
  loopBreakPrompt,
  getThinkingBudget,
  inferThinkingPhase,
} from '../agent-prompt'
import { RESOLVABLE_PACKAGES, ALLOWED_PACKAGE_NAMES } from '../allowed-packages'

// ─── Plan & requirements (#5) ───────────────────────────────────────────────

describe('agent-plan', () => {
  it('extracts discrete requirements from a prompt', () => {
    const reqs = extractRequirements(
      'Build a todo app with a dark mode toggle and a calendar view',
    )
    expect(reqs.length).toBeGreaterThanOrEqual(2)
    expect(reqs.join(' ').toLowerCase()).toContain('dark mode')
  })

  it('falls back to the whole prompt when it cannot split', () => {
    expect(extractRequirements('Portfolio').length).toBe(1)
  })

  it('round-trips through format/parse', () => {
    const plan = createPlan('Build a landing page with pricing and FAQ')
    const restored = parsePlan(formatPlan(plan))
    expect(restored.items.length).toBe(plan.items.length)
    expect(restored.items[0].text).toBe(plan.items[0].text)
    expect(restored.items.every((i) => !i.done)).toBe(true)
  })

  it('checks items off and tracks unmet requirements', () => {
    let plan = createPlan('Add login and signup and logout')
    expect(unmetRequirements(plan).length).toBe(plan.items.length)
    plan = applyPlanUpdate(plan, { check: [1] })
    expect(plan.items.find((i) => i.id === 1)?.done).toBe(true)
    expect(unmetRequirements(plan).length).toBe(plan.items.length - 1)
  })

  it('replaces and appends requirements', () => {
    let plan = createPlan('x')
    plan = applyPlanUpdate(plan, { setRequirements: ['A', 'B'] })
    expect(plan.items.map((i) => i.text)).toEqual(['A', 'B'])
    plan = applyPlanUpdate(plan, { addRequirements: ['C'] })
    expect(plan.items.map((i) => i.text)).toEqual(['A', 'B', 'C'])
    expect(plan.items[2].id).toBe(3)
  })

  it('produces an injectable reminder that flags unchecked items', () => {
    const plan = createPlan('Build a blog with comments')
    const reminder = planToSystemReminder(plan)
    expect(reminder).toContain('<system-reminder>')
    expect(reminder).toContain('unchecked')
  })
})

// ─── Cross-project memory (#8) ──────────────────────────────────────────────

describe('user-memory', () => {
  it('stores and reloads entries', () => {
    const uid = `u-${Math.random()}`
    rememberForUser(uid, 'preference', 'Likes dark themes')
    const entries = loadUserMemory(uid)
    expect(entries.length).toBe(1)
    expect(entries[0].content).toBe('Likes dark themes')
    expect(entries[0].weight).toBe(1)
  })

  it('reinforces duplicates by weight instead of duplicating', () => {
    const uid = `u-${Math.random()}`
    rememberForUser(uid, 'fix', 'Use named hook imports')
    rememberForUser(uid, 'fix', 'use   named hook imports') // normalized dup
    const entries = loadUserMemory(uid)
    expect(entries.length).toBe(1)
    expect(entries[0].weight).toBe(2)
  })

  it('forgets entries by id', () => {
    const uid = `u-${Math.random()}`
    rememberForUser(uid, 'fact', 'one')
    const [entry] = loadUserMemory(uid)
    const after = forgetForUser(uid, entry.id)
    expect(after.length).toBe(0)
  })

  it('infers preferences from prompts', () => {
    const facts = inferPreferencesFromPrompt('A minimal dark dashboard with animations')
    const joined = facts.join(' ').toLowerCase()
    expect(joined).toContain('dark')
    expect(joined).toContain('minimal')
    expect(joined).toContain('motion')
  })

  it('renders a system reminder ordered by kind', () => {
    const uid = `u-${Math.random()}`
    rememberForUser(uid, 'fact', 'built a store')
    rememberForUser(uid, 'preference', 'prefers minimal')
    const reminder = userMemoryToSystemReminder(loadUserMemory(uid))
    expect(reminder.indexOf('Design preference')).toBeLessThan(reminder.indexOf('Fact'))
  })
})

// ─── Visual review parsing (#1) ─────────────────────────────────────────────

describe('agent-vision', () => {
  it('parses a pass verdict', () => {
    const v = parseVisualReview('VERDICT: pass\nSCORE: 9\nISSUES:\n- none')
    expect(v.verdict).toBe('pass')
    expect(v.score).toBe(9)
    expect(v.issues).toEqual([])
  })

  it('parses a revise verdict with issues', () => {
    const v = parseVisualReview(
      'VERDICT: revise\nSCORE: 4\nISSUES:\n- White text on white background\n- Mobile layout overflows',
    )
    expect(v.verdict).toBe('revise')
    expect(v.issues.length).toBe(2)
  })

  it('treats low score with issues as revise even if it said pass', () => {
    const v = parseVisualReview('VERDICT: pass\nSCORE: 3\nISSUES:\n- Cramped spacing')
    expect(v.verdict).toBe('revise')
  })

  it('formats actionable feedback', () => {
    const fb = formatVisualFeedback({
      verdict: 'revise',
      score: 4,
      issues: ['Low contrast hero'],
      raw: '',
    })
    expect(fb).toContain('Low contrast hero')
    expect(fb).toContain('Visual review')
  })

  it('builds a review prompt naming the viewports', () => {
    const prompt = buildVisualReviewPrompt('Build X', [
      { label: 'desktop', width: 1280, base64: '', mediaType: 'image/png' },
    ])
    expect(prompt).toContain('desktop')
    expect(prompt).toContain('Build X')
  })
})

// ─── Type-check formatting (#3) ─────────────────────────────────────────────

describe('typecheck formatting', () => {
  it('returns null for clean / inconclusive results', () => {
    expect(formatTypeErrors({ ran: false, ok: true, errors: [] })).toBeNull()
    expect(formatTypeErrors({ ran: true, ok: true, errors: [] })).toBeNull()
  })

  it('formats type errors with location', () => {
    const out = formatTypeErrors({
      ran: true,
      ok: false,
      errors: [{ file: 'src/App.tsx', line: 5, column: 3, message: "Cannot find name 'foo'" }],
    })
    expect(out).toContain('src/App.tsx:5:3')
    expect(out).toContain("Cannot find name 'foo'")
  })
})

// ─── Reasoning routing (#10) ────────────────────────────────────────────────

describe('getReasoningParams', () => {
  it('maps OpenAI reasoning models to reasoning_effort', () => {
    expect(getReasoningParams('openai', 'o3-mini', 7000)).toEqual({ reasoning_effort: 'high' })
    expect(getReasoningParams('openai', 'gpt-5', 4000)).toEqual({ reasoning_effort: 'medium' })
    expect(getReasoningParams('openai', 'o1', 1000)).toEqual({ reasoning_effort: 'low' })
  })

  it('maps Gemini 2.5 to a thinkingBudget integer', () => {
    const out = getReasoningParams('google', 'gemini-2.5-flash', 5000) as {
      thinkingConfig: { thinkingBudget: number }
    }
    expect(out.thinkingConfig.thinkingBudget).toBe(5000)
  })

  it('maps Gemini 3.5+ to a thinkingLevel string', () => {
    expect(getReasoningParams('google', 'gemini-3.5-flash', 7000)).toEqual({ thinkingConfig: { thinkingLevel: 'high' } })
    expect(getReasoningParams('google', 'gemini-3.5-flash', 4000)).toEqual({ thinkingConfig: { thinkingLevel: 'medium' } })
    expect(getReasoningParams('google', 'gemini-3.5-flash', 1500)).toEqual({ thinkingConfig: { thinkingLevel: 'low' } })
    expect(getReasoningParams('google', 'gemini-3.5-flash', 500)).toEqual({ thinkingConfig: { thinkingLevel: 'minimal' } })
  })

  it('maps gpt-oss (Groq/Cerebras) to reasoning_effort', () => {
    expect(getReasoningParams('groq', 'openai/gpt-oss-120b', 7000)).toEqual({ reasoning_effort: 'high' })
    expect(getReasoningParams('cerebras', 'gpt-oss-120b', 4000)).toEqual({ reasoning_effort: 'medium' })
  })

  it('maps grok reasoning models to reasoning_effort', () => {
    expect(getReasoningParams('xai', 'grok-4.20-reasoning', 7000)).toEqual({ reasoning_effort: 'high' })
  })

  it('returns nothing for non-reasoning models', () => {
    expect(getReasoningParams('openai', 'gpt-4o', 4000)).toEqual({})
    expect(getReasoningParams('google', 'gemini-1.5-pro', 4000)).toEqual({})
    expect(getReasoningParams('perplexity', 'sonar-reasoning-pro', 4000)).toEqual({})
  })
})

// ─── Phase-gated thinking budget ────────────────────────────────────────────

describe('thinking budget (phase-gated)', () => {
  it('classifies phases by mode/turn/error state', () => {
    // An outstanding error wins over everything else.
    expect(
      inferThinkingPhase({ mode: 'create', turnCount: 1, hasPendingErrors: true }),
    ).toBe('debug')
    expect(
      inferThinkingPhase({ mode: 'refine', turnCount: 9, hasPendingErrors: true }),
    ).toBe('debug')
    // Opening turns of a fresh build are the planning phase.
    expect(inferThinkingPhase({ mode: 'create', turnCount: 1 })).toBe('plan')
    expect(inferThinkingPhase({ mode: 'create', turnCount: 2 })).toBe('plan')
    // Later create turns, and all refine turns, are mechanical build turns.
    expect(inferThinkingPhase({ mode: 'create', turnCount: 3 })).toBe('build')
    expect(inferThinkingPhase({ mode: 'refine', turnCount: 1 })).toBe('build')
  })

  it('spends 0 thinking on mechanical build turns at the default level', () => {
    // The whole point: the common case (writing/compiling) is the fast path.
    expect(getThinkingBudget({ mode: 'create', turnCount: 5, thinkingLevel: 'medium' })).toBe(0)
    expect(getThinkingBudget({ mode: 'refine', turnCount: 2, thinkingLevel: 'medium' })).toBe(0)
  })

  it('enables thinking for planning and error recovery', () => {
    expect(getThinkingBudget({ mode: 'create', turnCount: 1, thinkingLevel: 'medium' })).toBe(4000)
    expect(
      getThinkingBudget({ mode: 'refine', turnCount: 7, thinkingLevel: 'medium', hasPendingErrors: true }),
    ).toBe(4000)
  })

  it('higher levels keep some build-turn thinking; lower levels do not', () => {
    expect(getThinkingBudget({ mode: 'create', turnCount: 6, thinkingLevel: 'low' })).toBe(0)
    expect(getThinkingBudget({ mode: 'create', turnCount: 6, thinkingLevel: 'high' })).toBe(1500)
    expect(getThinkingBudget({ mode: 'create', turnCount: 6, thinkingLevel: 'extra-high' })).toBe(3000)
  })

  it('clamps an enabled budget into the supported range', () => {
    // extra-high plan is 12000 — at the ceiling, never above it.
    expect(getThinkingBudget({ mode: 'create', turnCount: 1, thinkingLevel: 'extra-high' })).toBe(12000)
  })
})

// ─── Loop break + allowlist ─────────────────────────────────────────────────

describe('misc enhancements', () => {
  it('loopBreakPrompt embeds the detail', () => {
    const p = loopBreakPrompt('repeated edit_file 3 times')
    expect(p).toContain('repeated edit_file 3 times')
    expect(p).toContain('stuck')
  })

  it('allowlist is resolvable and includes react core', () => {
    expect(RESOLVABLE_PACKAGES.has('react')).toBe(true)
    expect(RESOLVABLE_PACKAGES.has('framer-motion')).toBe(true)
    for (const name of ALLOWED_PACKAGE_NAMES) {
      expect(RESOLVABLE_PACKAGES.has(name)).toBe(true)
    }
  })
})
