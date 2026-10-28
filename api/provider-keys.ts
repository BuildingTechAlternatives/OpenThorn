import { verifyUser, rateLimit, encryptForUser, decryptForUser, hasEncryptionSecret } from './_shared.js'

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

function parseBody(body: unknown): { action?: string; value?: string } {
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

  if (!hasEncryptionSecret()) {
    // Signal the client to fall back to client-side encryption.
    res.status(503).json({ error: 'Key encryption not configured' })
    return
  }

  const user = await verifyUser(header(req, 'authorization'))
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  if (!(await rateLimit(`keys:${user.id}`, 60, 60_000))) {
    res.status(429).json({ error: 'Too many requests' })
    return
  }

  const { action, value } = parseBody(req.body)
  if ((action !== 'encrypt' && action !== 'decrypt') || typeof value !== 'string') {
    res.status(400).json({ error: 'Invalid request' })
    return
  }

  try {
    const result = action === 'encrypt'
      ? encryptForUser(value, user.id)
      : decryptForUser(value, user.id)
    res.status(200).json({ result })
  } catch {
    res.status(500).json({ error: `Failed to ${action} key` })
  }
}
