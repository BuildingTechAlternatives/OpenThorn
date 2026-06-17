import {
  hasOAuthClient, mintOAuthState, verifyOAuthState, buildAuthorizeUrl,
  exchangeOAuthCode, storeConnection, getValidAccessToken,
  listOrgProjects, getProjectConnectionInfo, saveProjectBackend, deleteConnection,
} from './_supabase.js'
import { verifyUser, rateLimit } from './_shared.js'

interface Req {
  method?: string
  url?: string
  headers: Record<string, string | string[] | undefined>
  body?: unknown
}
interface Res {
  status: (c: number) => Res
  json: (b: unknown) => void
  setHeader: (k: string, v: string) => void
  end: (s?: string) => void
}

function header(req: Req, n: string): string | undefined {
  const v = req.headers[n] ?? req.headers[n.toLowerCase()]
  return Array.isArray(v) ? v[0] : v
}
function appBase(req: Req): string {
  const proto = (header(req, 'x-forwarded-proto') || 'https').split(',')[0]
  return `${proto}://${header(req, 'host')}`
}
function redirectUri(req: Req): string {
  return `${appBase(req)}/api/supabase-oauth?action=callback`
}
function projectUrl(req: Req, projectId: string, params: Record<string, string>): string {
  const q = new URLSearchParams(params).toString()
  return `${appBase(req)}/projects/${encodeURIComponent(projectId)}?${q}`
}

export default async function handler(req: Req, res: Res): Promise<void> {
  if (!hasOAuthClient()) { res.status(503).json({ error: 'Supabase OAuth not configured' }); return }
  const url = new URL(req.url || '', 'http://localhost')
  const action = url.searchParams.get('action')

  // --- start: redirect the browser to Supabase's consent screen ---
  if (action === 'start' && req.method === 'GET') {
    const user = await verifyUser(header(req, 'authorization') || `Bearer ${url.searchParams.get('token') ?? ''}`)
    if (!user) { res.status(401).json({ error: 'Unauthorized' }); return }
    const projectId = url.searchParams.get('projectId') || ''
    const state = mintOAuthState(user.id, projectId)
    res.setHeader('Location', buildAuthorizeUrl(redirectUri(req), state))
    res.status(302).end()
    return
  }

  // --- callback: exchange code, store tokens, bounce back to the builder ---
  if (action === 'callback' && req.method === 'GET') {
    const code = url.searchParams.get('code') || ''
    const parsed = verifyOAuthState(url.searchParams.get('state') || '')
    if (!code || !parsed) { res.status(400).json({ error: 'Invalid OAuth callback' }); return }
    try {
      const tokens = await exchangeOAuthCode(code, redirectUri(req))
      const projects = await listOrgProjects(tokens.accessToken)
      await storeConnection(parsed.userId, { orgId: projects[0]?.orgId ?? 'unknown', tokens })
      res.setHeader('Location', projectUrl(req, parsed.projectId, { backend: 'connected' }))
      res.status(302).end()
    } catch (err) {
      res.setHeader('Location', projectUrl(req, parsed.projectId, {
        backend: 'error',
        message: err instanceof Error ? err.message : 'failed',
      }))
      res.status(302).end()
    }
    return
  }

  // --- POST actions (authenticated fetch from the UI) ---
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }
  const user = await verifyUser(header(req, 'authorization'))
  if (!user) { res.status(401).json({ error: 'Unauthorized' }); return }
  if (!(await rateLimit(`sboauth:${user.id}`, 30, 60_000))) { res.status(429).json({ error: 'Too many requests' }); return }
  const body = (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}) as
    { action?: string; projectId?: string; ref?: string }

  try {
    if (body.action === 'list-projects') {
      const at = await getValidAccessToken(user.id)
      if (!at) { res.status(400).json({ error: 'No Supabase connection' }); return }
      res.status(200).json({ projects: await listOrgProjects(at) }); return
    }
    if (body.action === 'pick-project' && body.projectId && body.ref) {
      const at = await getValidAccessToken(user.id)
      if (!at) { res.status(400).json({ error: 'No Supabase connection' }); return }
      const info = await getProjectConnectionInfo(at, body.ref)
      await saveProjectBackend(user.id, body.projectId, body.ref, info)
      res.status(200).json({ ok: true, supabaseUrl: info.supabaseUrl }); return
    }
    if (body.action === 'revoke') {
      await deleteConnection(user.id)
      res.status(200).json({ ok: true }); return
    }
    res.status(400).json({ error: 'Unknown action' })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'OAuth action failed' })
  }
}
