import { verifyUser, rateLimit } from './_shared.js'

// Narrowly scoped: only providers confirmed to block browser CORS.
// Each host must be individually vetted and added here (SSRF prevention).
const CORS_PROXIED_HOSTS = new Set([
  'integrate.api.nvidia.com',
])

interface VercelReq {
  method?: string
  headers: Record<string, string | string[] | undefined>
  body?: unknown
}
// Extends the standard json/status helpers with raw streaming methods,
// which Vercel's underlying ServerResponse also exposes.
interface VercelRes {
  status: (code: number) => VercelRes
  json: (body: unknown) => void
  writeHead: (status: number, headers?: Record<string, string>) => void
  write: (chunk: Uint8Array | string) => boolean
  end: (chunk?: string) => void
}

function header(req: VercelReq, name: string): string | undefined {
  const v = req.headers[name] ?? req.headers[name.toLowerCase()]
  return Array.isArray(v) ? v[0] : v
}

export default async function handler(req: VercelReq, res: VercelRes): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  // Require a valid Supabase session to prevent open-proxy abuse.
  const user = await verifyUser(header(req, 'authorization'))
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  // 120 requests/min per user — generous for long streaming calls.
  if (!(await rateLimit(`proxy:${user.id}`, 120, 60_000))) {
    res.status(429).json({ error: 'Too many proxy requests. Please wait a minute.' })
    return
  }

  // Validate target URL against the allowlist (prevents SSRF).
  const targetUrl = header(req, 'x-proxy-url')
  if (!targetUrl) {
    res.status(400).json({ error: 'Missing x-proxy-url header' })
    return
  }

  let targetHost: string
  try {
    targetHost = new URL(targetUrl).hostname
  } catch {
    res.status(400).json({ error: 'Invalid x-proxy-url' })
    return
  }

  if (!CORS_PROXIED_HOSTS.has(targetHost)) {
    res.status(403).json({ error: `Host "${targetHost}" is not in the CORS proxy allowlist` })
    return
  }

  // Vercel auto-parses the JSON body; re-serialize it for forwarding.
  const body = JSON.stringify(req.body)

  // Build forwarded headers — provider key only, never the Supabase JWT.
  const providerKey = header(req, 'x-provider-key')
  const forwardHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
  if (providerKey) forwardHeaders['Authorization'] = `Bearer ${providerKey}`

  // Call the actual provider server-side (no CORS restriction applies here).
  let upstream: Response
  try {
    upstream = await fetch(targetUrl, { method: 'POST', headers: forwardHeaders, body })
  } catch (err) {
    res.status(502).json({ error: `Upstream error: ${err instanceof Error ? err.message : String(err)}` })
    return
  }

  // Forward status and content-type, then pipe the body chunk-by-chunk (supports SSE streaming).
  const outHeaders: Record<string, string> = {}
  const ct = upstream.headers.get('content-type')
  if (ct) outHeaders['Content-Type'] = ct
  res.writeHead(upstream.status, outHeaders)

  if (!upstream.body) {
    res.end()
    return
  }

  const reader = upstream.body.getReader()
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      res.write(value)
    }
  } finally {
    reader.releaseLock()
    res.end()
  }
}
