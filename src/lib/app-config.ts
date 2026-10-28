import { supabase } from './supabase'

export interface Announcement {
  text: string
  link?: string
  enabled: true
}

export type AppConfigMap = Record<string, unknown>

/** Config value parsers are pure so they can be unit-tested. */
export function parseAnnouncement(value: unknown): Announcement | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const v = value as Record<string, unknown>
  if (v.enabled !== true || typeof v.text !== 'string' || !v.text.trim()) return null
  return {
    text: v.text,
    link: typeof v.link === 'string' && v.link.trim() ? v.link : undefined,
    enabled: true,
  }
}

export function parseDisabledProviders(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((x): x is string => typeof x === 'string')
}

export function parseFeatureFlags(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(([, v]) => typeof v === 'boolean'),
  ) as Record<string, boolean>
}

// ---------------------------------------------------------------------------
// Cached fetch — one app_config round-trip per session.
// ---------------------------------------------------------------------------

let configPromise: Promise<AppConfigMap> | null = null

export function loadAppConfig(force = false): Promise<AppConfigMap> {
  if (!configPromise || force) {
    configPromise = (async () => {
      const { data } = await supabase.from('app_config').select('key, value')
      return Object.fromEntries((data ?? []).map((r) => [r.key as string, r.value]))
    })()
  }
  return configPromise
}

export async function getAnnouncement(): Promise<Announcement | null> {
  return parseAnnouncement((await loadAppConfig()).announcement)
}

export async function getDisabledProviders(): Promise<string[]> {
  return parseDisabledProviders((await loadAppConfig()).disabled_providers)
}

export async function getFeatureFlags(): Promise<Record<string, boolean>> {
  return parseFeatureFlags((await loadAppConfig()).feature_flags)
}

/** Admin-only write (enforced by RLS). Invalidates the session cache. */
export async function setAppConfig(key: string, value: unknown): Promise<void> {
  const { error } = await supabase
    .from('app_config')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) throw new Error(error.message)
  configPromise = null
}
