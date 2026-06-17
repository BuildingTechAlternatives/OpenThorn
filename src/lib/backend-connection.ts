// Client helper for the BYO-Supabase backend connect flow. Talks to
// /api/supabase-oauth; the server holds all secrets (OAuth tokens), so the
// browser only ever sees public values (project list, anon key URL).

import type { SchemaSpec } from '../../api/_schema'
export type { SchemaSpec, TableSpec, ColumnSpec, AccessLevel, ColumnType } from '../../api/_schema'

export interface RemoteProject {
  ref: string
  name: string
  orgId: string
  region: string
  /** Supabase lifecycle status, e.g. ACTIVE_HEALTHY, COMING_UP, INACTIVE. */
  status: string
}

async function post<T>(token: string, body: unknown, path = '/api/supabase-oauth'): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error || `Request failed ${res.status}`)
  }
  return res.json() as Promise<T>
}

/** URL the "Authorize Supabase" button navigates to (full-page redirect). */
export function authorizeUrl(token: string, projectId: string): string {
  const q = new URLSearchParams({ action: 'start', token, projectId })
  return `/api/supabase-oauth?${q.toString()}`
}

export function listProjects(token: string): Promise<{ projects: RemoteProject[] }> {
  return post(token, { action: 'list-projects' })
}

export function pickProject(
  token: string,
  projectId: string,
  ref: string,
): Promise<{ ok: boolean; supabaseUrl: string }> {
  return post(token, { action: 'pick-project', projectId, ref })
}

/** Remove this project's backend link (keeps the user's Supabase authorization). */
export function disconnectProject(token: string, projectId: string): Promise<{ ok: boolean }> {
  return post(token, { action: 'disconnect-project', projectId })
}

/** Fully deauthorize the user's Supabase connection (all projects). */
export function revokeBackend(token: string): Promise<{ ok: boolean }> {
  return post(token, { action: 'revoke' })
}

/** Create a brand-new Supabase project in the user's org. Provisions async. */
export function createProject(token: string, name: string): Promise<{ project: RemoteProject }> {
  return post(token, { action: 'create-project', name })
}

export interface ApplySchemaResult {
  applied: boolean
  alreadyApplied: boolean
  statements: number
  checksum: string
  types: string
}

/** Compile + apply a declarative schema to the project's connected Supabase DB. */
export function applySchema(token: string, projectId: string, spec: SchemaSpec): Promise<ApplySchemaResult> {
  return post(token, { projectId, spec }, '/api/migrate')
}
