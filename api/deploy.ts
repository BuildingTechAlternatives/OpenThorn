import { verifyUser, rateLimit, runCloudflareDeploy, getProjectForDeploy, persistProjectSiteId } from './_shared.js'

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

// The CF Pages project name is never trusted from the body — it is looked up from
// the database, scoped to the caller, so a user cannot deploy onto someone else's project.
function parseBody(body: unknown): { projectId?: string; html?: string } {
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

  const authorization = header(req, 'authorization')
  const user = await verifyUser(authorization)
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  if (!(await rateLimit(`deploy:${user.id}`, 10, 60_000))) {
    res.status(429).json({ error: 'Too many deploys. Please wait a minute and try again.' })
    return
  }

  const { projectId, html } = parseBody(req.body)
  if (!projectId || !html) {
    res.status(400).json({ error: 'Missing projectId or html' })
    return
  }

  const access = await getProjectForDeploy(authorization, projectId)
  if (!access.ok) {
    res.status(403).json({ error: 'You do not have access to this project.' })
    return
  }

  try {
    const result = await runCloudflareDeploy({ projectId, html, existingSiteId: access.siteId, title: access.title })
    if (result.siteId !== access.siteId) {
      await persistProjectSiteId(authorization, projectId, result.siteId)
    }
    res.status(200).json(result)
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Deploy failed' })
  }
}
