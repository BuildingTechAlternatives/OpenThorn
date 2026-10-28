/**
 * Cross-Project User Memory.
 *
 * ## Why this exists
 *
 * The existing lessons.md / CHANGELOG.md memory lives *inside each virtual
 * project* — nothing carries from one build to the next. This module gives the
 * agent a per-user store that survives across every project: durable design
 * preferences ("user likes dark, minimal UIs"), recurring runtime fixes
 * ("named React hook imports — never default import"), and a rolling log of
 * the kinds of apps the user builds.
 *
 * Storage is localStorage (browser) with an in-memory fallback so it is safe in
 * tests / SSR. Keyed by userId so multiple accounts on one machine stay
 * separate. Entries are scored and capped so the store cannot grow unbounded.
 */

export type MemoryKind = 'preference' | 'fix' | 'fact'

export interface UserMemoryEntry {
  /** Stable id (timestamp + counter). */
  id: string
  kind: MemoryKind
  /** The remembered fact, written in the imperative for the agent. */
  content: string
  /** How many times this has been reinforced — higher = more trusted. */
  weight: number
  /** ISO date last seen. */
  updated: string
}

const STORAGE_PREFIX = 'openthorn.memory.'
const MAX_ENTRIES = 40

// In-memory fallback when localStorage is unavailable (tests / SSR / private mode).
const memoryFallback = new Map<string, string>()

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId || 'anon'}`
}

function readRaw(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') return localStorage.getItem(key)
  } catch {
    /* access denied — fall through */
  }
  return memoryFallback.get(key) ?? null
}

function writeRaw(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value)
      return
    }
  } catch {
    /* access denied — fall through */
  }
  memoryFallback.set(key, value)
}

// ─── Load / save ────────────────────────────────────────────────────────────

export function loadUserMemory(userId: string): UserMemoryEntry[] {
  const raw = readRaw(storageKey(userId))
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (e): e is UserMemoryEntry =>
        e && typeof e.id === 'string' && typeof e.content === 'string',
    )
  } catch {
    return []
  }
}

export function saveUserMemory(userId: string, entries: UserMemoryEntry[]): void {
  // Keep the highest-weight, most-recent entries when over the cap.
  const trimmed = [...entries]
    .sort((a, b) => b.weight - a.weight || b.updated.localeCompare(a.updated))
    .slice(0, MAX_ENTRIES)
  writeRaw(storageKey(userId), JSON.stringify(trimmed))
}

// ─── Mutation ───────────────────────────────────────────────────────────────

let counter = 0
function nextId(): string {
  counter += 1
  return `${Date.now().toString(36)}-${counter}`
}

function normalize(content: string): string {
  return content.trim().replace(/\s+/g, ' ').toLowerCase()
}

/**
 * Record (or reinforce) a memory. If a near-identical entry exists, its weight
 * is incremented and timestamp refreshed instead of creating a duplicate.
 * Returns the updated list (also persisted).
 */
export function rememberForUser(
  userId: string,
  kind: MemoryKind,
  content: string,
): UserMemoryEntry[] {
  const clean = content.trim()
  if (!clean) return loadUserMemory(userId)

  const entries = loadUserMemory(userId)
  const norm = normalize(clean)
  const existing = entries.find((e) => normalize(e.content) === norm)

  if (existing) {
    existing.weight += 1
    existing.updated = new Date().toISOString().slice(0, 10)
  } else {
    entries.push({
      id: nextId(),
      kind,
      content: clean,
      weight: 1,
      updated: new Date().toISOString().slice(0, 10),
    })
  }

  saveUserMemory(userId, entries)
  return entries
}

export function forgetForUser(userId: string, id: string): UserMemoryEntry[] {
  const entries = loadUserMemory(userId).filter((e) => e.id !== id)
  saveUserMemory(userId, entries)
  return entries
}

// ─── Context injection ──────────────────────────────────────────────────────

/**
 * Render the user's durable memory as a `<system-reminder>` for the agent.
 * Only entries with weight ≥ 1 are included; preferences first.
 */
export function userMemoryToSystemReminder(entries: UserMemoryEntry[]): string {
  if (entries.length === 0) return ''

  const order: MemoryKind[] = ['preference', 'fix', 'fact']
  const sorted = [...entries].sort(
    (a, b) =>
      order.indexOf(a.kind) - order.indexOf(b.kind) || b.weight - a.weight,
  )

  const label: Record<MemoryKind, string> = {
    preference: 'Design preference',
    fix: 'Known fix',
    fact: 'Fact',
  }

  const lines = ['<system-reminder>', '## What I know about this user (across projects)']
  for (const e of sorted.slice(0, 15)) {
    const trust = e.weight >= 3 ? ' (strong)' : ''
    lines.push(`- ${label[e.kind]}${trust}: ${e.content}`)
  }
  lines.push('Apply preferences by default unless this request overrides them.')
  lines.push('</system-reminder>')
  return lines.join('\n')
}

// ─── Automatic preference inference ─────────────────────────────────────────

/**
 * Infer durable preferences from a user prompt — light heuristics for the most
 * common, high-signal cues (theme, density, vibe). Returns inferred facts the
 * caller can persist with rememberForUser.
 */
export function inferPreferencesFromPrompt(prompt: string): string[] {
  const p = prompt.toLowerCase()
  const found: string[] = []
  const cue = (re: RegExp, fact: string) => {
    if (re.test(p)) found.push(fact)
  }
  cue(/\bdark\s*mode|dark\s*theme|dark\b/, 'Tends to want dark themes.')
  cue(/\bminimal|clean|simple\b/, 'Prefers minimal, clean design.')
  cue(/\bplayful|fun|colou?rful|vibrant\b/, 'Likes playful, colorful visuals.')
  cue(/\bglass(morphism)?\b/, 'Likes glassmorphism / frosted surfaces.')
  cue(/\bbrutalis|retro|vintage\b/, 'Drawn to bold retro/brutalist styles.')
  cue(/\banimat|motion|interactive\b/, 'Values motion and micro-interactions.')
  return found
}
