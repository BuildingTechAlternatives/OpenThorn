// Server-side helpers for BYO-Supabase backend connections.
// Files prefixed with "_" are not treated as routes by Vercel.
//
// This module owns the Supabase OAuth flow (signed CSRF state, code exchange,
// token refresh), the Management API client, and persistence of a user's
// connection. Secrets never reach the client: OAuth tokens are encrypted at rest
// with the per-user AES-256-GCM scheme in _shared.ts, and only the public
// anon key + project URL are stored in client-readable columns.
import { createHmac, timingSafeEqual, hkdfSync } from 'node:crypto'
import { encryptForUser, decryptForUser } from './_shared.js'

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
