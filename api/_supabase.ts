// Server-side helpers for BYO-Supabase backend connections.
// Files prefixed with "_" are not treated as routes by Vercel.
//
// This module owns the Supabase OAuth flow (signed CSRF state, code exchange,
// token refresh), the Management API client, and persistence of a user's
// connection. Secrets never reach the client: OAuth tokens are encrypted at rest
// with the per-user AES-256-GCM scheme in _shared.ts, and only the public
// anon key + project URL are stored in client-readable columns.
import { createHmac, timingSafeEqual, hkdfSync, randomBytes } from 'node:crypto'
import { encryptForUser, decryptForUser } from './_shared.js'
import { compileSchema, schemaToTypes, type SchemaSpec } from './_schema.js'

const SB_API = 'https://api.supabase.com'
const OAUTH_AUTHORIZE = `${SB_API}/v1/oauth/authorize`
const OAUTH_TOKEN = `${SB_API}/v1/oauth/token`
const STATE_TTL_MS = 10 * 60_000
const REFRESH_SKEW_MS = 60_000

// ---------------------------------------------------------------------------
// OAuth CSRF state — signed with HMAC, no DB round-trip needed
// ---------------------------------------------------------------------------

function stateKey(): Buffer {
  const secret = process.env.KEY_ENCRYPTION_SECRET
  if (!secret) throw new Error('KEY_ENCRYPTION_SECRET is not configured')
  return Buffer.from(hkdfSync('sha256', secret, 'supabase-oauth', 'state-v1', 32))
}

export interface OAuthState {
  userId: string
  projectId: string
  ts: number
}

/** Sign a CSRF state token: base64url(payload).hmac — no DB needed. */
export function mintOAuthState(userId: string, projectId: string): string {
  const payload = JSON.stringify({ userId, projectId, ts: Date.now() } satisfies OAuthState)
  const b64 = Buffer.from(payload).toString('base64url')
  const sig = createHmac('sha256', stateKey()).update(b64).digest('base64url')
  return `${b64}.${sig}`
}

export function verifyOAuthState(state: string): OAuthState | null {
  const [b64, sig] = (state || '').split('.')
  if (!b64 || !sig) return null
  const expected = createHmac('sha256', stateKey()).update(b64).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const parsed = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8')) as OAuthState
    if (Date.now() - parsed.ts > STATE_TTL_MS) return null
    return parsed
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// OAuth code exchange + token refresh
// ---------------------------------------------------------------------------

export interface OAuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

function oauthClient(): { id: string; secret: string } {
  const id = process.env.SUPABASE_OAUTH_CLIENT_ID
  const secret = process.env.SUPABASE_OAUTH_CLIENT_SECRET
  if (!id || !secret) throw new Error('Supabase OAuth client is not configured')
  return { id, secret }
}

export function hasOAuthClient(): boolean {
  return Boolean(process.env.SUPABASE_OAUTH_CLIENT_ID && process.env.SUPABASE_OAUTH_CLIENT_SECRET)
}

async function postToken(params: Record<string, string>): Promise<OAuthTokens> {
  const { id, secret } = oauthClient()
  const res = await fetch(OAUTH_TOKEN, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'),
    },
    body: new URLSearchParams(params).toString(),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Supabase OAuth token error ${res.status}: ${text.slice(0, 200)}`)
  const data = JSON.parse(text) as { access_token: string; refresh_token: string; expires_in: number }
  return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresIn: data.expires_in }
}

export function exchangeOAuthCode(code: string, redirectUri: string): Promise<OAuthTokens> {
  return postToken({ grant_type: 'authorization_code', code, redirect_uri: redirectUri })
}

export function refreshOAuthToken(refreshToken: string): Promise<OAuthTokens> {
  return postToken({ grant_type: 'refresh_token', refresh_token: refreshToken })
}

/** Build the authorize redirect URL the browser is sent to. */
export function buildAuthorizeUrl(redirectUri: string, state: string): string {
  const { id } = oauthClient()
  const q = new URLSearchParams({
    client_id: id,
    redirect_uri: redirectUri,
    response_type: 'code',
    state,
  })
  return `${OAUTH_AUTHORIZE}?${q.toString()}`
}

// ---------------------------------------------------------------------------
// Connection persistence (OpenThorn's own Supabase, service role)
// ---------------------------------------------------------------------------

function ownEnv(): { url: string; serviceKey: string } {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('OpenThorn Supabase service role not configured')
  return { url, serviceKey }
}

function svcHeaders(key: string): Record<string, string> {
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
}

export interface StoredConnection {
  orgId: string
  tokens: OAuthTokens
  scopes?: string
}

export async function storeConnection(userId: string, conn: StoredConnection): Promise<void> {
  const { url, serviceKey } = ownEnv()
  const row = {
    user_id: userId,
    org_id: conn.orgId,
    access_token_enc: encryptForUser(conn.tokens.accessToken, userId),
    refresh_token_enc: encryptForUser(conn.tokens.refreshToken, userId),
    expires_at: new Date(Date.now() + conn.tokens.expiresIn * 1000).toISOString(),
    scopes: conn.scopes ?? null,
    updated_at: new Date().toISOString(),
  }
  const res = await fetch(`${url}/rest/v1/supabase_connections`, {
    method: 'POST',
    headers: { ...svcHeaders(serviceKey), Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(row),
  })
  if (!res.ok) throw new Error(`storeConnection failed ${res.status}`)
}

/** Returns a non-expired access token, refreshing + re-persisting if needed, or null if no connection. */
export async function getValidAccessToken(userId: string): Promise<string | null> {
  const { url, serviceKey } = ownEnv()
  const res = await fetch(
    `${url}/rest/v1/supabase_connections?user_id=eq.${userId}&select=org_id,access_token_enc,refresh_token_enc,expires_at&limit=1`,
    { headers: { ...svcHeaders(serviceKey), Accept: 'application/json' } },
  )
  if (!res.ok) return null
  const rows = (await res.json()) as Array<{
    org_id: string
    access_token_enc: string
    refresh_token_enc: string
    expires_at: string
  }>
  const row = rows?.[0]
  if (!row) return null

  const notExpired = new Date(row.expires_at).getTime() - REFRESH_SKEW_MS > Date.now()
  if (notExpired) return decryptForUser(row.access_token_enc, userId)

  const refreshed = await refreshOAuthToken(decryptForUser(row.refresh_token_enc, userId))
  await storeConnection(userId, { orgId: row.org_id, tokens: refreshed })
  return refreshed.accessToken
}

export async function deleteConnection(userId: string): Promise<void> {
  const { url, serviceKey } = ownEnv()
  await fetch(`${url}/rest/v1/supabase_connections?user_id=eq.${userId}`, {
    method: 'DELETE',
    headers: { ...svcHeaders(serviceKey), Prefer: 'return=minimal' },
  })
}

// ---------------------------------------------------------------------------
// Supabase Management API — projects + keys
// ---------------------------------------------------------------------------

export interface SupabaseProject {
  ref: string
  name: string
  orgId: string
  region: string
  /** Supabase lifecycle status, e.g. ACTIVE_HEALTHY, COMING_UP, INACTIVE. */
  status: string
}

async function mgmt<T>(accessToken: string, path: string): Promise<T> {
  const res = await fetch(`${SB_API}/v1${path}`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Supabase Management API ${res.status}: ${text.slice(0, 200)}`)
  return JSON.parse(text) as T
}

export async function listOrgProjects(accessToken: string): Promise<SupabaseProject[]> {
  const raw = await mgmt<Array<{ id: string; name: string; organization_id: string; region: string; status?: string }>>(
    accessToken,
    '/projects',
  )
  return raw.map((p) => ({
    ref: p.id,
    name: p.name,
    orgId: p.organization_id,
    region: p.region,
    status: p.status ?? 'UNKNOWN',
  }))
}

export async function getProjectConnectionInfo(
  accessToken: string,
  ref: string,
): Promise<{ supabaseUrl: string; anonKey: string }> {
  // reveal=true so the key value is returned (not masked). Supabase has two key
  // systems: the legacy JWT `anon` key and the newer `publishable` key
  // (sb_publishable_…). supabase-js uses either in the client "anon key" slot, so
  // accept whichever the project exposes — newer projects have no `anon` key.
  const keys = await mgmt<Array<{ name?: string; type?: string; api_key?: string }>>(
    accessToken,
    `/projects/${ref}/api-keys?reveal=true`,
  )
  const clientKey =
    keys.find((k) => k.type === 'publishable') ??
    keys.find((k) => k.name === 'anon') ??
    keys.find((k) => k.name === 'publishable')
  if (!clientKey?.api_key) {
    throw new Error(
      'Could not find a publishable/anon API key for this project. If the project is paused, resume it and try again.',
    )
  }
  return { supabaseUrl: `https://${ref}.supabase.co`, anonKey: clientKey.api_key }
}

/**
 * Create a new Supabase project in the user's organization via the Management
 * API. Provisioning is async — the returned project will not be healthy (and its
 * API keys won't exist) for ~1-2 minutes. A strong DB password is generated
 * server-side; the user can reset it from the Supabase dashboard if needed.
 */
export async function createSupabaseProject(
  accessToken: string,
  opts: { name: string; orgId: string; region: string },
): Promise<SupabaseProject> {
  const dbPass = randomBytes(24).toString('base64url')
  const res = await fetch(`${SB_API}/v1/projects`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: opts.name,
      organization_id: opts.orgId,
      db_pass: dbPass,
      region: opts.region,
    }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Could not create project (${res.status}): ${text.slice(0, 200)}`)
  const p = JSON.parse(text) as { id: string; name: string; organization_id: string; region: string; status?: string }
  return { ref: p.id, name: p.name, orgId: p.organization_id, region: p.region, status: p.status ?? 'COMING_UP' }
}

/** Remove a single project's backend link (keeps the user's OAuth connection). */
export async function deleteProjectBackend(userId: string, projectId: string): Promise<void> {
  const { url, serviceKey } = ownEnv()
  await fetch(
    `${url}/rest/v1/project_backends?project_id=eq.${encodeURIComponent(projectId)}&user_id=eq.${encodeURIComponent(userId)}`,
    { method: 'DELETE', headers: { ...svcHeaders(serviceKey), Prefer: 'return=minimal' } },
  )
}

// ---------------------------------------------------------------------------
// Schema migrations — compile a declarative spec and apply it to the user's DB
// ---------------------------------------------------------------------------

/** Look up a project's Supabase ref (client-safe column, read with service role). */
async function projectRef(userId: string, projectId: string): Promise<string | null> {
  const { url, serviceKey } = ownEnv()
  const res = await fetch(
    `${url}/rest/v1/project_backends?project_id=eq.${encodeURIComponent(projectId)}&user_id=eq.${encodeURIComponent(userId)}&select=project_ref&limit=1`,
    { headers: { ...svcHeaders(serviceKey), Accept: 'application/json' } },
  )
  if (!res.ok) return null
  const rows = (await res.json()) as Array<{ project_ref?: string }>
  return rows?.[0]?.project_ref ?? null
}

/** Run arbitrary SQL on the user's database via the Management API. */
export async function runUserSql<T = unknown>(accessToken: string, ref: string, query: string): Promise<T> {
  const res = await fetch(`${SB_API}/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Database query failed (${res.status}): ${text.slice(0, 300)}`)
  try { return JSON.parse(text) as T } catch { return [] as unknown as T }
}

const MIGRATIONS_DDL =
  `create table if not exists public._openthorn_migrations (` +
  `version bigserial primary key, name text not null, checksum text not null unique, ` +
  `applied_at timestamptz not null default now());`

export interface ApplySchemaResult {
  applied: boolean
  alreadyApplied: boolean
  statements: number
  checksum: string
  types: string
}

export async function applySchema(userId: string, projectId: string, spec: SchemaSpec): Promise<ApplySchemaResult> {
  const accessToken = await getValidAccessToken(userId)
  if (!accessToken) throw new Error('BACKEND_NOT_CONNECTED')
  const ref = await projectRef(userId, projectId)
  if (!ref) throw new Error('BACKEND_NOT_CONNECTED')

  const { statements, checksum } = compileSchema(spec)
  const types = schemaToTypes(spec)

  // Ensure the ledger exists, then skip if this exact schema already applied.
  await runUserSql(accessToken, ref, MIGRATIONS_DDL)
  const existing = await runUserSql<Array<{ checksum: string }>>(
    accessToken, ref,
    `select checksum from public._openthorn_migrations where checksum = '${checksum}' limit 1;`,
  )
  if (Array.isArray(existing) && existing.length > 0) {
    return { applied: false, alreadyApplied: true, statements: statements.length, checksum, types }
  }

  // Apply the DDL as one batch, then record it in both ledgers.
  await runUserSql(accessToken, ref, statements.join('\n'))
  const name = `schema_${new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)}`
  await runUserSql(
    accessToken, ref,
    `insert into public._openthorn_migrations (name, checksum) values ('${name}', '${checksum}');`,
  )

  // Mirror into OpenThorn's own ledger (best-effort; never blocks the apply).
  try {
    const { url, serviceKey } = ownEnv()
    await fetch(`${url}/rest/v1/project_migrations`, {
      method: 'POST',
      headers: { ...svcHeaders(serviceKey), Prefer: 'return=minimal' },
      body: JSON.stringify({
        project_id: projectId, version: Date.now(), name, sql: statements.join('\n'), checksum,
      }),
    })
  } catch { /* non-fatal */ }

  return { applied: true, alreadyApplied: false, statements: statements.length, checksum, types }
}

export async function saveProjectBackend(
  userId: string,
  projectId: string,
  ref: string,
  info: { supabaseUrl: string; anonKey: string },
): Promise<void> {
  const { url, serviceKey } = ownEnv()
  const res = await fetch(`${url}/rest/v1/project_backends`, {
    method: 'POST',
    headers: { ...svcHeaders(serviceKey), Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      project_id: projectId,
      user_id: userId,
      project_ref: ref,
      supabase_url: info.supabaseUrl,
      supabase_anon_key: info.anonKey,
      updated_at: new Date().toISOString(),
    }),
  })
  if (!res.ok) throw new Error(`saveProjectBackend failed ${res.status}`)
}
