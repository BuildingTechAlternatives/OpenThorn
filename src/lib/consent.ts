/**
 * Cookie consent state for OpenThorn.
 *
 * Categories:
 * - `necessary` — always active (authentication, security, product features).
 * - `advertising` — opt-in only. Gates Adsterra and any future advertising /
 *   marketing technologies. Never enabled by default.
 *
 * The state is a single source of truth persisted in localStorage and exposed
 * synchronously (snapshot + subscribe) so React components can gate external
 * scripts with `useSyncExternalStore`. Safe to import during prerender/SSR —
 * storage access is guarded and the server snapshot is always "no consent".
 */

export interface ConsentPreferences {
  /** Third-party advertising / marketing (Adsterra). Opt-in. */
  advertising: boolean
}

export interface ConsentState extends ConsentPreferences {
  /** Schema version — a mismatch is treated as "no decision" and re-prompts. */
  version: number
  /** ISO timestamp of when the decision was made. */
  decidedAt: string
}

export const CONSENT_VERSION = 1
export const CONSENT_STORAGE_KEY = 'openthorn.consent.v1'

/** Fired on `window` after any consent change. */
export const CONSENT_CHANGE_EVENT = 'openthorn:consent-change'
/** Fired on `window` to request that the consent UI open its preferences view. */
export const CONSENT_OPEN_EVENT = 'openthorn:open-consent'

const listeners = new Set<() => void>()
let cached: ConsentState | null = readFromStorage()

function hasStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined'
  } catch {
    return false
  }
}

function readFromStorage(): ConsentState | null {
  if (!hasStorage()) return null
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    const state = parsed as Partial<ConsentState>
    if (
      state.version !== CONSENT_VERSION ||
      typeof state.advertising !== 'boolean' ||
      typeof state.decidedAt !== 'string'
    ) {
      return null
    }
    return { version: CONSENT_VERSION, advertising: state.advertising, decidedAt: state.decidedAt }
  } catch {
    return null
  }
}

/** The stored decision, or null when the visitor has not chosen yet. */
export function getConsent(): ConsentState | null {
  return cached
}

/** Whether third-party advertising/marketing may load. False before any choice. */
export function hasAdvertisingConsent(): boolean {
  return cached?.advertising === true
}

/**
 * Persists a decision, updates the snapshot, and notifies subscribers.
 * Rejecting ("non-essential only") is just `advertising: false`.
 */
export function saveConsent(preferences: ConsentPreferences): ConsentState {
  cached = {
    version: CONSENT_VERSION,
    advertising: preferences.advertising === true,
    decidedAt: new Date().toISOString(),
  }
  if (hasStorage()) {
    try {
      localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(cached))
    } catch {
      // Private mode / quota — consent still applies for this session.
    }
  }
  for (const listener of listeners) listener()
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<ConsentState>(CONSENT_CHANGE_EVENT, { detail: cached }))
  }
  return cached
}

/** Snapshot subscription for `useSyncExternalStore`. */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Opens the consent UI's preferences view (used by footer/Cookie Policy links). */
export function openConsentPreferences(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CONSENT_OPEN_EVENT))
  }
}
