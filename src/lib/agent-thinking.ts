export type AgentThinkingLevel = 'low' | 'medium' | 'high' | 'extra-high'

/**
 * The agent's lifecycle phase, used to decide whether a turn gets extended
 * thinking. Mirrors how Claude Code spends reasoning tokens: lavishly on the
 * hard moments (planning a build, recovering from an error), not at all on the
 * mechanical majority (writing a file, recompiling, reading).
 */
export type ThinkingPhase = 'plan' | 'build' | 'debug'

export interface AgentThinkingProfile {
  label: string
  shortLabel: string
  description: string
  maxTurns: number
  /**
   * Per-phase extended-thinking budgets, in tokens. A value of 0 disables
   * thinking entirely for that phase — the fast path, with no serial reasoning
   * generated before the visible output. Most turns are `build` turns, so a
   * 0 there is what keeps runs snappy.
   *
   * Budgets loosely track Claude Code's keyword tiers (think ≈ 4K,
   * think-hard ≈ 10K, ultrathink ≈ 32K) scaled to this product's turn budgets.
   */
  thinking: Record<ThinkingPhase, number>
}

export const DEFAULT_THINKING_LEVEL: AgentThinkingLevel = 'medium'

export const AGENT_THINKING_PROFILES: Record<AgentThinkingLevel, AgentThinkingProfile> = {
  low: {
    label: 'Low',
    shortLabel: 'Low',
    description: 'Faster run with concise planning and essential checks.',
    maxTurns: 24,
    thinking: { plan: 1024, debug: 1024, build: 0 },
  },
  medium: {
    label: 'Medium',
    shortLabel: 'Med',
    description: 'Balanced planning, building, and verification.',
    maxTurns: 44,
    thinking: { plan: 2048, debug: 2048, build: 0 },
  },
  high: {
    label: 'High',
    shortLabel: 'High',
    description: 'More deliberate planning with extra attention to polish and edge cases.',
    maxTurns: 56,
    thinking: { plan: 4000, debug: 3000, build: 0 },
  },
  'extra-high': {
    label: 'Extra High',
    shortLabel: 'XHigh',
    description: 'Maximum planning and verification for complex builds.',
    maxTurns: 76,
    thinking: { plan: 8000, debug: 6000, build: 1500 },
  },
}

export function normalizeThinkingLevel(
  level: AgentThinkingLevel | null | undefined,
): AgentThinkingLevel {
  return level && level in AGENT_THINKING_PROFILES ? level : DEFAULT_THINKING_LEVEL
}

