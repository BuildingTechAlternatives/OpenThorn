// Shared server-side helpers for Vercel Functions and the Vite dev shims.
// Files prefixed with "_" are not treated as routes by Vercel.
import { createHash, createCipheriv, createDecipheriv, randomBytes, hkdfSync } from 'node:crypto'
import { blake3 } from 'hash-wasm'

// ---------------------------------------------------------------------------
// Supabase JWT verification
// ---------------------------------------------------------------------------

export interface AuthedUser {
  id: string
  email?: string
}

function supabaseEnv(): { url: string; anonKey: string } | null {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anonKey) return null
  return { url, anonKey }
}

/** Extract the bearer token from an Authorization header value. */
function bearer(authorization: string | undefined): string {
  return (authorization || '').replace(/^Bearer\s+/i, '').trim()
}

/**
 * Verify a Supabase access token by calling the Auth API. Returns the user on
 * success, or null if the token is missing/invalid or the server is not
 * configured with Supabase credentials.
 */
export async function verifyUser(authorization: string | undefined): Promise<AuthedUser | null> {
  const token = bearer(authorization)
  if (!token) return null

  const env = supabaseEnv()
  if (!env) return null

  try {
    const res = await fetch(`${env.url}/auth/v1/user`, {
      headers: { apikey: env.anonKey, Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    const data = (await res.json()) as { id?: string; email?: string }
    if (!data?.id) return null
    return { id: data.id, email: data.email }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Project ownership lookup (for the deploy endpoint)
//
// The Netlify site id is authoritative in the database, not in the request
// body. Deriving it server-side (scoped to the caller's JWT via RLS) prevents a
// caller from pushing HTML to a site id they don't own. PostgREST applies the
// projects RLS policy, so a row is only returned when the user owns or
// collaborates on the project.
// ---------------------------------------------------------------------------

// Conservative id charset — uuids pass, and it rules out any character that
// could alter the PostgREST filter even before URL-encoding.
const PROJECT_ID_RE = /^[A-Za-z0-9_-]{1,100}$/

export interface ProjectAccess {
  /** True only when the caller may deploy this project. */
  ok: boolean
  /** The project's persisted Netlify site id, or null if it has none yet. */
  siteId: string | null
}

export async function getProjectForDeploy(
  authorization: string | undefined,
  projectId: string,
): Promise<ProjectAccess> {
  const env = supabaseEnv()
  const token = bearer(authorization)
  if (!env || !token || !PROJECT_ID_RE.test(projectId)) return { ok: false, siteId: null }

  try {
    const res = await fetch(
      `${env.url}/rest/v1/projects?id=eq.${encodeURIComponent(projectId)}&select=cf_pages_project_name&limit=1`,
      { headers: { apikey: env.anonKey, Authorization: `Bearer ${token}`, Accept: 'application/json' } },
    )
    if (!res.ok) return { ok: false, siteId: null }
    const rows = (await res.json()) as Array<{ cf_pages_project_name?: string | null }>
    if (!Array.isArray(rows) || rows.length === 0) return { ok: false, siteId: null }
    const siteId = rows[0]?.cf_pages_project_name
    return { ok: true, siteId: typeof siteId === 'string' && siteId ? siteId : null }
  } catch {
    return { ok: false, siteId: null }
  }
}

/** Best-effort: persist the Netlify site id so future deploys reuse the site. */
export async function persistProjectSiteId(
  authorization: string | undefined,
  projectId: string,
  siteId: string,
): Promise<void> {
  const env = supabaseEnv()
  const token = bearer(authorization)
  if (!env || !token || !PROJECT_ID_RE.test(projectId)) return

  try {
    await fetch(`${env.url}/rest/v1/projects?id=eq.${encodeURIComponent(projectId)}`, {
      method: 'PATCH',
      headers: {
        apikey: env.anonKey,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ cf_pages_project_name: siteId }),
    })
  } catch {
    /* non-fatal — the client also persists this after a successful deploy */
  }
}

// ---------------------------------------------------------------------------
// Rate limiting — shared (Upstash Redis) with in-memory fallback
//
// On Vercel, function instances are ephemeral and run concurrently, so an
// in-memory counter cannot enforce a global limit. When UPSTASH_REDIS_REST_URL
// and UPSTASH_REDIS_REST_TOKEN are configured we use a shared fixed-window
// counter in Redis; otherwise we fall back to a best-effort per-instance limit.
// ---------------------------------------------------------------------------

const buckets = new Map<string, number[]>()

function inMemoryRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const hits = (buckets.get(key) || []).filter((t) => now - t < windowMs)
  if (hits.length >= max) {
    buckets.set(key, hits)
    return false
  }
  hits.push(now)
  buckets.set(key, hits)
  return true
}

function upstashEnv(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return { url, token }
}

async function redisRateLimit(
  env: { url: string; token: string },
  key: string,
  max: number,
  windowMs: number,
): Promise<boolean> {
  // Fixed window: INCR the counter, and set its TTL only on the first hit (NX).
  const res = await fetch(`${env.url}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([
      ['INCR', `rl:${key}`],
      ['PEXPIRE', `rl:${key}`, String(windowMs), 'NX'],
    ]),
  })
  if (!res.ok) throw new Error(`Upstash error ${res.status}`)
  const data = (await res.json()) as Array<{ result?: number }>
  const count = Number(data?.[0]?.result ?? 0)
  if (!Number.isFinite(count) || count <= 0) throw new Error('Unexpected Upstash response')
  return count <= max
}

/** Returns true if the action is allowed, false if the caller is over the limit. */
export async function rateLimit(key: string, max: number, windowMs: number): Promise<boolean> {
  const env = upstashEnv()
  if (env) {
    try {
      return await redisRateLimit(env, key, max, windowMs)
    } catch {
      // Fail open to the per-instance limiter rather than blocking real users.
      return inMemoryRateLimit(key, max, windowMs)
    }
  }
  return inMemoryRateLimit(key, max, windowMs)
}

// ---------------------------------------------------------------------------
// Server-side provider-key encryption (AES-256-GCM)
//
// The encryption key is derived from a server-held secret (KEY_ENCRYPTION_SECRET)
// combined with the user id. A database dump alone therefore cannot be decrypted
// without also holding the server secret.
// ---------------------------------------------------------------------------

const SERVER_PREFIX = 'senc:'

export function hasEncryptionSecret(): boolean {
  return Boolean(process.env.KEY_ENCRYPTION_SECRET)
}

function deriveServerKey(userId: string): Buffer {
  const secret = process.env.KEY_ENCRYPTION_SECRET
  if (!secret) throw new Error('KEY_ENCRYPTION_SECRET is not configured')
  return Buffer.from(hkdfSync('sha256', secret, userId, 'provider-key-v1', 32))
}

export function encryptForUser(plaintext: string, userId: string): string {
  const key = deriveServerKey(userId)
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${SERVER_PREFIX}${iv.toString('hex')}:${tag.toString('hex')}:${ct.toString('base64')}`
}

export function decryptForUser(stored: string, userId: string): string {
  if (!stored.startsWith(SERVER_PREFIX)) return stored
  const body = stored.slice(SERVER_PREFIX.length)
  const [ivHex, tagHex, ctB64] = body.split(':')
  if (!ivHex || !tagHex || !ctB64) throw new Error('Malformed encrypted value')
  const key = deriveServerKey(userId)
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  const pt = Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()])
  return pt.toString('utf8')
}

// ---------------------------------------------------------------------------
// Cloudflare Pages deploy (for user-generated sites)
// ---------------------------------------------------------------------------

const CF_API = 'https://api.cloudflare.com/client/v4'

interface CFResult<T> {
  success: boolean
  result: T
  errors: Array<{ message: string }>
}

function cfEnv(): { accountId: string; token: string } {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
  const token = process.env.CLOUDFLARE_API_TOKEN
  if (!accountId || !token) throw new Error('Missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN')
  return { accountId, token }
}

async function cfFetch<T>(token: string, path: string, options: RequestInit): Promise<T> {
  const res = await fetch(`${CF_API}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...options.headers },
  })
  const text = await res.text()
  let data: CFResult<T>
  try { data = JSON.parse(text) as CFResult<T> } catch { throw new Error(`CF ${res.status} non-JSON: ${text.slice(0, 300)}`) }
  if (!data.success) {
    const msgs = Array.isArray(data.errors) ? data.errors.map((e) => e.message).join(', ') : text.slice(0, 300)
    throw new Error(`Cloudflare API error ${res.status}: ${msgs}`)
  }
  return data.result
}

async function createCFPagesProject(token: string, accountId: string, projectId: string): Promise<string> {
  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const name = `ot-${projectId.slice(0, 8)}-${suffix}`
  await cfFetch<{ name: string }>(token, `/accounts/${accountId}/pages/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, production_branch: 'main' }),
  })
  return name
}

// Cloudflare Pages identifies each asset by blake3(base64(content) + fileExtension)
// truncated to the first 32 hex chars — NOT a plain sha256. If the manifest/upload
// key doesn't match CF's own blake3 of the content, the upload is silently dropped,
// upsert-hashes still reports success, and the deployment serves no assets (404 on /).
async function cfPagesHash(content: string, path: string): Promise<string> {
  const base64 = Buffer.from(content).toString('base64')
  const ext = path.includes('.') ? path.split('.').pop()! : ''
  return (await blake3(base64 + ext)).slice(0, 32)
}

const CF_UPLOAD_BASE = 'https://api.cloudflare.com/client/v4'

async function deployToCFPages(
  token: string,
  accountId: string,
  projectName: string,
  html: string,
): Promise<void> {
  // Cloudflare Pages manifest keys MUST be absolute paths (leading slash), or
  // nothing maps to the root URL and "/" returns 404 even though the deploy succeeds.
  // _redirects gives SPA-style client routing a fallback to index.html.
  const files: Array<{ path: string; content: string; contentType: string }> = [
    { path: '/index.html', content: html, contentType: 'text/html; charset=utf-8' },
    { path: '/_redirects', content: '/* /index.html 200\n', contentType: 'text/plain; charset=utf-8' },
  ]

  // 1. Compute manifest (path → blake3 hash)
  const manifest: Record<string, string> = {}
  for (const f of files) {
    manifest[f.path] = await cfPagesHash(f.content, f.path)
  }
  const hashes = Object.values(manifest)

  // 2. Get short-lived upload JWT
  const { jwt } = await cfFetch<{ jwt: string }>(
    token,
    `/accounts/${accountId}/pages/projects/${projectName}/upload-token`,
    { method: 'GET' },
  )

  // 3. Upload all files unconditionally (skip check-missing to avoid stale-cache issues)
  const uploadRes = await fetch(`${CF_UPLOAD_BASE}/pages/assets/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(
      files.map((f) => ({
        key: manifest[f.path],
        value: Buffer.from(f.content).toString('base64'),
        metadata: { contentType: f.contentType },
        base64: true,
      })),
    ),
  })
  if (!uploadRes.ok) {
    throw new Error(`File upload failed: ${uploadRes.status} ${await uploadRes.text().catch(() => '')}`)
  }

  // 4. Finalize — link these hashes to the project
  const upsertRes = await fetch(`${CF_UPLOAD_BASE}/pages/assets/upsert-hashes`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ hashes }),
  })
  if (!upsertRes.ok) {
    throw new Error(`upsert-hashes failed: ${upsertRes.status} ${await upsertRes.text().catch(() => '')}`)
  }

  // 5. Create deployment with manifest. branch must match the project's
  // production_branch so this becomes the production deployment served at
  // <project>.pages.dev (otherwise it's a preview and the root URL 404s).
  const form = new FormData()
  form.append('manifest', JSON.stringify(manifest))
  form.append('branch', 'main')

  const deploy = await cfFetch<{ id: string }>(
    token,
    `/accounts/${accountId}/pages/projects/${projectName}/deployments`,
    { method: 'POST', body: form },
  )

  // 7. Poll until ready
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 1000))
    const status = await cfFetch<{ latest_stage: { name: string; status: string } }>(
      token,
      `/accounts/${accountId}/pages/projects/${projectName}/deployments/${deploy.id}`,
      { method: 'GET' },
    )
    if (status.latest_stage.name === 'deploy' && status.latest_stage.status === 'success') return
    if (status.latest_stage.status === 'failure') throw new Error('Cloudflare Pages deployment failed')
  }
  throw new Error('Cloudflare Pages deployment timed out after 60s')
}

export interface DeployInput {
  projectId: string
  html: string
  existingSiteId?: string | null
}

export async function runCloudflareDeploy(input: DeployInput): Promise<{ url: string; siteId: string }> {
  const { accountId, token } = cfEnv()
  const projectName = input.existingSiteId ?? (await createCFPagesProject(token, accountId, input.projectId))
  await deployToCFPages(token, accountId, projectName, input.html)
  return { url: `https://${projectName}.pages.dev`, siteId: projectName }
}

// ---------------------------------------------------------------------------
// Admin operations (service role)
//
// Used by api/admin.ts and the matching vite dev shim. The service role key
// must never reach the client; these helpers run only server-side. The
// caller's admin status is always re-checked here via the database — the
// client is never trusted.
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isValidUserId(id: string): boolean {
  return UUID_RE.test(id)
}

function serviceRoleKey(): string | null {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || null
}

export function hasServiceRoleKey(): boolean {
  return Boolean(serviceRoleKey())
}

function serviceHeaders(key: string): Record<string, string> {
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
}

/** True only when the given user's profile row has is_admin = true. */
export async function isAdminUser(userId: string): Promise<boolean> {
  const env = supabaseEnv()
  const key = serviceRoleKey()
  if (!env || !key || !isValidUserId(userId)) return false
  try {
    const res = await fetch(
      `${env.url}/rest/v1/profiles?id=eq.${userId}&select=is_admin&limit=1`,
      { headers: { ...serviceHeaders(key), Accept: 'application/json' } },
    )
    if (!res.ok) return false
    const rows = (await res.json()) as Array<{ is_admin?: boolean }>
    return Boolean(rows?.[0]?.is_admin)
  } catch {
    return false
  }
}

/** Ban or unban a user at the auth level and mirror the flag on profiles. */
export async function adminSetUserSuspended(userId: string, suspended: boolean): Promise<void> {
  const env = supabaseEnv()
  const key = serviceRoleKey()
  if (!env || !key) throw new Error('Service role not configured')
  if (!isValidUserId(userId)) throw new Error('Invalid user id')

  const res = await fetch(`${env.url}/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    headers: serviceHeaders(key),
    // "none" lifts the ban; 876000h ≈ 100 years.
    body: JSON.stringify({ ban_duration: suspended ? '876000h' : 'none' }),
  })
  if (!res.ok) throw new Error(`Auth admin error ${res.status}`)

  const mirror = await fetch(`${env.url}/rest/v1/profiles?id=eq.${userId}`, {
    method: 'PATCH',
    headers: { ...serviceHeaders(key), Prefer: 'return=minimal' },
    body: JSON.stringify({ suspended }),
  })
  if (!mirror.ok) throw new Error(`Profile update error ${mirror.status}`)
}

/** True when a Vercel deploy hook is configured. */
export function hasDeployHook(): boolean {
  return Boolean(process.env.VERCEL_DEPLOY_HOOK_URL)
}

/** Fire the Vercel deploy hook to regenerate the prerendered site. */
export async function triggerDeploy(): Promise<void> {
  const hook = process.env.VERCEL_DEPLOY_HOOK_URL
  if (!hook) throw new Error('Deploy hook not configured')
  const res = await fetch(hook, { method: 'POST' })
  if (!res.ok) throw new Error(`Deploy hook error ${res.status}`)
}

/** Insert a dashboard bell notification for all signed-in users. */
export async function adminCreateNotification(text: string, timeLabel = 'New'): Promise<void> {
  const env = supabaseEnv()
  const key = serviceRoleKey()
  const cleanText = text.trim()
  const cleanTimeLabel = timeLabel.trim() || 'New'
  if (!env || !key) throw new Error('Service role not configured')
  if (!cleanText) throw new Error('Message is required')

  const res = await fetch(`${env.url}/rest/v1/notifications`, {
    method: 'POST',
    headers: { ...serviceHeaders(key), Prefer: 'return=minimal' },
    body: JSON.stringify({ text: cleanText, time_label: cleanTimeLabel, is_active: true }),
  })
  if (!res.ok) throw new Error(`Notification insert error ${res.status}`)
}

/** Permanently delete a user. The profiles row cascades via its FK. */
export async function adminDeleteUser(userId: string): Promise<void> {
  const env = supabaseEnv()
  const key = serviceRoleKey()
  if (!env || !key) throw new Error('Service role not configured')
  if (!isValidUserId(userId)) throw new Error('Invalid user id')

  const res = await fetch(`${env.url}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: serviceHeaders(key),
  })
  if (!res.ok) throw new Error(`Auth admin error ${res.status}`)
}
