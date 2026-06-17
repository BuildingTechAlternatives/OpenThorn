import { verifyUser, rateLimit } from './_shared.js'
import { applySchema } from './_supabase.js'
import type { SchemaSpec } from './_schema.js'

interface Req { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown }
interface Res { status: (c: number) => Res; json: (b: unknown) => void }

function header(req: Req, n: string): string | undefined {
  const v = req.headers[n] ?? req.headers[n.toLowerCase()]
  return Array.isArray(v) ? v[0] : v
}

export default async function handler(req: Req, res: Res): Promise<void> {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }
  const user = await verifyUser(header(req, 'authorization'))
  if (!user) { res.status(401).json({ error: 'Unauthorized' }); return }
  if (!(await rateLimit(`migrate:${user.id}`, 30, 60_000))) { res.status(429).json({ error: 'Too many requests' }); return }

  const body = (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}) as
    { projectId?: string; spec?: SchemaSpec }
  if (!body.projectId || !body.spec || !Array.isArray(body.spec.tables)) {
    res.status(400).json({ error: 'Missing projectId or spec' })
    return
  }

  try {
    const result = await applySchema(user.id, body.projectId, body.spec)
    res.status(200).json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Migration failed'
    res.status(msg === 'BACKEND_NOT_CONNECTED' ? 400 : 500).json({ error: msg })
  }
}
