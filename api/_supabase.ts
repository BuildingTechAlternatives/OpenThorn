// Server-side helpers for BYO-Supabase backend connections.
// Files prefixed with "_" are not treated as routes by Vercel.
//
// This module owns the Supabase OAuth flow (signed CSRF state, code exchange,
// token refresh), the Management API client, and persistence of a user's
// connection. Secrets never reach the client: OAuth tokens are encrypted at rest
// with the per-user AES-256-GCM scheme in _shared.ts, and only the public
// anon key + project URL are stored in client-readable columns.
import { createHmac, timingSafeEqual, hkdfSync } from 'node:crypto'

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
