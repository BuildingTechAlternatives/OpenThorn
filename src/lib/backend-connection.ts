// Client helper for the BYO-Supabase backend connect flow. Talks to
// /api/supabase-oauth; the server holds all secrets (OAuth tokens), so the
// browser only ever sees public values (project list, anon key URL).

export interface RemoteProject {
  ref: string
  name: string
  orgId: string
  region: string
  /** Supabase lifecycle status, e.g. ACTIVE_HEALTHY, COMING_UP, INACTIVE. */
  status: string
}

async function post<T>(token: string, body: unknown): Promise<T> {
  const res = await fetch('/api/supabase-oauth', {
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

export function revokeBackend(token: string): Promise<{ ok: boolean }> {
  return post(token, { action: 'revoke' })
}

/** Create a brand-new Supabase project in the user's org. Provisions async. */
export function createProject(token: string, name: string): Promise<{ project: RemoteProject }> {
  return post(token, { action: 'create-project', name })
}
