/**
 * Agent Plan & Requirements Tracking.
 *
 * ## Why this exists
 *
 * The agent's plan previously lived only in `think` tool outputs, which get
 * truncated away by context compaction. By turn 25 the model has forgotten the
 * original requirements and is flying blind. This module gives the plan a
 * durable home — a `PLAN.md` virtual file the agent reads each turn and updates
 * via the `update_plan` tool — and turns the user's request into an explicit
 * requirements checklist that the `done` gate can verify against.
 *
 * The checklist is the contract: `done` should not be accepted while the model
 * has left requirements visibly unchecked.
 */

export const PLAN_PATH = 'src/lib/PLAN.md'

export interface PlanItem {
  /** Stable 1-based index, used for checking items off. */
  id: number
  /** The requirement text. */
  text: string
  /** Whether the agent has marked this requirement complete. */
  done: boolean
}

export interface AgentPlan {
  /** The original user request this plan serves. */
  goal: string
  /** The requirements checklist. */
  items: PlanItem[]
  /** Free-form notes / design decisions the agent wants to remember. */
  notes: string
}

const PLAN_HEADER = `# OpenThorn Agent — Project Plan

> Auto-managed working memory. The agent maintains this with the update_plan tool.
> Requirements are the contract: every box must be checked before the project is done.

`

// ─── Requirement extraction ─────────────────────────────────────────────────

/**
 * Heuristically split a user prompt into discrete requirements. This is a
 * starting checklist the agent refines with update_plan — not the final word.
 *
 * Strategy: split on conjunctions, sentence boundaries, list markers, and
 * "with/that/including" clauses, then keep the fragments that read like
 * actionable features.
 */
export function extractRequirements(prompt: string): string[] {
  const cleaned = prompt.replace(/\s+/g, ' ').trim()
  if (!cleaned) return []

  // Split on strong separators first: newlines, list markers, semicolons,
  // periods, and the words "and"/"plus"/"with"/"including"/"also".
  const rawParts = cleaned
    .split(/(?:\r?\n|•|•|;|\.|,?\s+(?:and|plus|also|with|including|that has|that have|which has)\s+)/i)
    .map((p) => p.trim())
    .filter(Boolean)

  const seen = new Set<string>()
  const requirements: string[] = []
  for (let part of rawParts) {
    // Drop a leading imperative that applies to the whole build, keep the noun.
    part = part.replace(/^(please\s+)?(build|create|make|design|develop|generate|add|implement)\s+(me\s+)?(a|an|the|some)?\s*/i, '')
    part = part.replace(/^(a|an|the)\s+/i, '').trim()
    if (part.length < 3) continue
    const key = part.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    // Capitalize first letter for readability.
    requirements.push(part.charAt(0).toUpperCase() + part.slice(1))
    if (requirements.length >= 12) break
  }

  // If the heuristic collapsed everything into one fragment, fall back to the
  // whole prompt as a single requirement — better than an empty checklist.
  if (requirements.length === 0) {
    requirements.push(cleaned.charAt(0).toUpperCase() + cleaned.slice(1))
  }
  return requirements
}

/** Build an initial plan from a user prompt. */
export function createPlan(goal: string): AgentPlan {
  const items = extractRequirements(goal).map((text, i) => ({
    id: i + 1,
    text,
    done: false,
  }))
  return { goal, items, notes: '' }
}

// ─── Serialization ──────────────────────────────────────────────────────────

export function formatPlan(plan: AgentPlan): string {
  let out = PLAN_HEADER
  out += `## Goal\n${plan.goal.trim() || '(not set)'}\n\n`
  out += `## Requirements\n`
  if (plan.items.length === 0) {
    out += '_(none yet)_\n'
  } else {
    for (const item of plan.items) {
      out += `- [${item.done ? 'x' : ' '}] ${item.id}. ${item.text}\n`
    }
  }
  out += `\n## Notes\n${plan.notes.trim() || '_(none)_'}\n`
  return out
}

export function parsePlan(raw: string): AgentPlan {
  const plan: AgentPlan = { goal: '', items: [], notes: '' }
  if (!raw) return plan

  const goalMatch = raw.match(/##\s*Goal\s*\n([\s\S]*?)(?:\n##|$)/i)
  if (goalMatch) plan.goal = goalMatch[1].trim()

  const reqMatch = raw.match(/##\s*Requirements\s*\n([\s\S]*?)(?:\n##|$)/i)
  if (reqMatch) {
    const lines = reqMatch[1].split('\n')
    for (const line of lines) {
      const m = line.match(/^- \[([ xX])\]\s*(?:(\d+)\.\s*)?(.+)$/)
      if (m) {
        plan.items.push({
          id: m[2] ? Number(m[2]) : plan.items.length + 1,
          text: m[3].trim(),
          done: m[1].toLowerCase() === 'x',
        })
      }
    }
  }

  const notesMatch = raw.match(/##\s*Notes\s*\n([\s\S]*?)$/i)
  if (notesMatch) {
    const notes = notesMatch[1].trim()
    plan.notes = notes === '_(none)_' ? '' : notes
  }

  return plan
}

// ─── Mutations (driven by the update_plan tool) ─────────────────────────────

export interface PlanUpdate {
  /** Replace the goal. */
  goal?: string
  /** Replace the entire requirements list with these texts. */
  setRequirements?: string[]
  /** Append these requirement texts. */
  addRequirements?: string[]
  /** Mark these requirement ids complete. */
  check?: number[]
  /** Mark these requirement ids incomplete. */
  uncheck?: number[]
  /** Replace the notes. */
  notes?: string
}

export function applyPlanUpdate(plan: AgentPlan, update: PlanUpdate): AgentPlan {
  const next: AgentPlan = {
    goal: update.goal ?? plan.goal,
    items: plan.items.map((i) => ({ ...i })),
    notes: update.notes ?? plan.notes,
  }

  if (update.setRequirements) {
    // An empty or all-blank set_requirements would silently wipe the checklist
    // (weak models send `set_requirements: []` alongside other fields), which
    // also neuters the done gate's plan check. Only replace with real items.
    const cleaned = update.setRequirements.map((t) => t.trim()).filter(Boolean)
    if (cleaned.length > 0) {
      next.items = cleaned.map((text, i) => ({
        id: i + 1,
        text,
        done: false,
      }))
    }
  }

  if (update.addRequirements) {
    let nextId = next.items.reduce((max, i) => Math.max(max, i.id), 0) + 1
    for (const text of update.addRequirements) {
      if (!text.trim()) continue
      next.items.push({ id: nextId++, text: text.trim(), done: false })
    }
  }

  if (update.check) {
    const checkSet = new Set(update.check)
    for (const item of next.items) if (checkSet.has(item.id)) item.done = true
  }

  if (update.uncheck) {
    const uncheckSet = new Set(update.uncheck)
    for (const item of next.items) if (uncheckSet.has(item.id)) item.done = false
  }

  return next
}

// ─── Done-gate support ──────────────────────────────────────────────────────

/** Requirements the agent has not yet checked off. */
export function unmetRequirements(plan: AgentPlan): PlanItem[] {
  return plan.items.filter((i) => !i.done)
}

/** A compact, agent-readable status block for injection each turn. */
export function planToSystemReminder(plan: AgentPlan): string {
  if (plan.items.length === 0 && !plan.goal) return ''
  const lines: string[] = ['<system-reminder>', '## Current Plan (PLAN.md)']
  if (plan.goal) lines.push(`Goal: ${plan.goal}`)
  if (plan.items.length > 0) {
    lines.push('Requirements:')
    for (const item of plan.items) {
      lines.push(`  [${item.done ? 'x' : ' '}] ${item.id}. ${item.text}`)
    }
    const remaining = unmetRequirements(plan).length
    if (remaining > 0) {
      lines.push(
        `${remaining} requirement(s) still unchecked. Use update_plan to check items off as you finish them. Do not call done until all are checked and the app compiles.`,
      )
    }
  }
  lines.push('</system-reminder>')
  return lines.join('\n')
}
