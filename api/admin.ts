import {
  verifyUser,
  rateLimit,
  isAdminUser,
  isValidUserId,
  hasServiceRoleKey,
  adminSetUserSuspended,
  adminDeleteUser,
  triggerDeploy,
} from './_shared.js'

interface VercelReq {
  method?: string
  headers: Record<string, string | string[] | undefined>
  body?: unknown
}
interface VercelRes {
  status: (code: number) => VercelRes
  json: (body: unknown) => void
}

function header(req: VercelReq, name: string): string | undefined {
  const v = req.headers[name] ?? req.headers[name.toLowerCase()]
  return Array.isArray(v) ? v[0] : v
}

const ACTIONS = ['suspend-user', 'unsuspend-user', 'delete-user'] as const
type AdminAction = (typeof ACTIONS)[number]

function parseBody(body: unknown): { action?: string; userId?: string } {
  if (!body) return {}
  if (typeof body === 'string') {
    try { return JSON.parse(body) } catch { return {} }
  }
  return body as Record<string, never>
}

export default async function handler(req: VercelReq, res: VercelRes): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  if (!hasServiceRoleKey()) {
    res.status(503).json({ error: 'Admin operations not configured' })
    return
  }

  const user = await verifyUser(header(req, 'authorization'))
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  if (!(await rateLimit(`admin:${user.id}`, 30, 60_000))) {
    res.status(429).json({ error: 'Too many requests' })
    return
  }

  // Re-verify admin status server-side — never trust the client.
  if (!(await isAdminUser(user.id))) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }

  const body = parseBody(req.body)

  // trigger-deploy takes no target user; handle it before user-action validation.
  if (body.action === 'trigger-deploy') {
    try {
      await triggerDeploy()
      res.status(200).json({ ok: true })
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Deploy failed' })
    }
    return
  }

  const { action, userId } = body
  if (!ACTIONS.includes(action as AdminAction) || typeof userId !== 'string' || !isValidUserId(userId)) {
    res.status(400).json({ error: 'Invalid request' })
    return
  }
  if (userId === user.id) {
    res.status(400).json({ error: 'You cannot perform this action on your own account' })
    return
  }

  try {
    if (action === 'suspend-user') await adminSetUserSuspended(userId, true)
    else if (action === 'unsuspend-user') await adminSetUserSuspended(userId, false)
    else await adminDeleteUser(userId)
    res.status(200).json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Admin action failed' })
  }
}
