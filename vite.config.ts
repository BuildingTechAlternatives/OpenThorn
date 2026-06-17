import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  verifyUser,
  rateLimit,
  runCloudflareDeploy,
  getProjectForDeploy,
  persistProjectSiteId,
  encryptForUser,
  decryptForUser,
  hasEncryptionSecret,
  isAdminUser,
  isValidUserId,
  hasServiceRoleKey,
  adminSetUserSuspended,
  adminDeleteUser,
  adminCreateNotification,
  triggerDeploy,
} from './api/_shared'
import {
  hasOAuthClient,
  mintOAuthState,
  verifyOAuthState,
  buildAuthorizeUrl,
  exchangeOAuthCode,
  storeConnection,
  getValidAccessToken,
  listOrgProjects,
  getProjectConnectionInfo,
  saveProjectBackend,
  deleteConnection,
  createSupabaseProject,
} from './api/_supabase'

async function readJsonBody<T>(req: IncomingMessage): Promise<T | Record<string, never>> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  if (chunks.length === 0) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as T
  } catch {
    return {}
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

export default defineConfig(({ mode, isSsrBuild }) => {
  // Mirror the Vercel function environment for the local dev shims so that
  // /api/* behaves the same in `vite dev` as it does in production.
  const env = loadEnv(mode, process.cwd(), '')
  process.env.SUPABASE_URL ||= env.SUPABASE_URL || env.VITE_SUPABASE_URL
  process.env.SUPABASE_ANON_KEY ||= env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY
  if (env.CLOUDFLARE_ACCOUNT_ID) process.env.CLOUDFLARE_ACCOUNT_ID ||= env.CLOUDFLARE_ACCOUNT_ID
  if (env.CLOUDFLARE_API_TOKEN) process.env.CLOUDFLARE_API_TOKEN ||= env.CLOUDFLARE_API_TOKEN
  if (env.KEY_ENCRYPTION_SECRET) process.env.KEY_ENCRYPTION_SECRET ||= env.KEY_ENCRYPTION_SECRET
  if (env.SUPABASE_SERVICE_ROLE_KEY) process.env.SUPABASE_SERVICE_ROLE_KEY ||= env.SUPABASE_SERVICE_ROLE_KEY
  if (env.SUPABASE_OAUTH_CLIENT_ID) process.env.SUPABASE_OAUTH_CLIENT_ID ||= env.SUPABASE_OAUTH_CLIENT_ID
  if (env.SUPABASE_OAUTH_CLIENT_SECRET) process.env.SUPABASE_OAUTH_CLIENT_SECRET ||= env.SUPABASE_OAUTH_CLIENT_SECRET

  return {
    plugins: [
      react(),
      {
        name: 'bloom-api-dev-endpoints',
        configureServer(server) {
          server.middlewares.use('/api/deploy', async (req, res) => {
            if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })
            try {
              const user = await verifyUser(req.headers.authorization)
              if (!user) return sendJson(res, 401, { error: 'Unauthorized' })
              if (!(await rateLimit(`deploy:${user.id}`, 10, 60_000))) {
                return sendJson(res, 429, { error: 'Too many deploys. Please wait a minute and try again.' })
              }
              const body = await readJsonBody<{ projectId?: string; html?: string }>(req)
              if (!body.projectId || !body.html) return sendJson(res, 400, { error: 'Missing projectId or html' })
              const access = await getProjectForDeploy(req.headers.authorization, body.projectId)
              if (!access.ok) return sendJson(res, 403, { error: 'You do not have access to this project.' })
              const result = await runCloudflareDeploy({ projectId: body.projectId, html: body.html, existingSiteId: access.siteId, title: access.title })
              if (result.siteId !== access.siteId) {
                await persistProjectSiteId(req.headers.authorization, body.projectId, result.siteId)
              }
              sendJson(res, 200, result)
            } catch (err) {
              sendJson(res, 500, { error: err instanceof Error ? err.message : 'Deploy failed' })
            }
          })

          server.middlewares.use('/api/provider-keys', async (req, res) => {
            if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })
            if (!hasEncryptionSecret()) return sendJson(res, 503, { error: 'Key encryption not configured' })
            try {
              const user = await verifyUser(req.headers.authorization)
              if (!user) return sendJson(res, 401, { error: 'Unauthorized' })
              if (!(await rateLimit(`keys:${user.id}`, 60, 60_000))) return sendJson(res, 429, { error: 'Too many requests' })
              const body = await readJsonBody<{ action?: string; value?: string }>(req)
              if ((body.action !== 'encrypt' && body.action !== 'decrypt') || typeof body.value !== 'string') {
                return sendJson(res, 400, { error: 'Invalid request' })
              }
              const result = body.action === 'encrypt'
                ? encryptForUser(body.value, user.id)
                : decryptForUser(body.value, user.id)
              sendJson(res, 200, { result })
            } catch {
              sendJson(res, 500, { error: 'Key operation failed' })
            }
          })

          server.middlewares.use('/api/admin', async (req, res) => {
            if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })
            if (!hasServiceRoleKey()) return sendJson(res, 503, { error: 'Admin operations not configured' })
            try {
              const user = await verifyUser(req.headers.authorization)
              if (!user) return sendJson(res, 401, { error: 'Unauthorized' })
              if (!(await rateLimit(`admin:${user.id}`, 30, 60_000))) return sendJson(res, 429, { error: 'Too many requests' })
              if (!(await isAdminUser(user.id))) return sendJson(res, 403, { error: 'Forbidden' })
              const body = await readJsonBody<{ action?: string; userId?: string; text?: string; timeLabel?: string }>(req)
              if (body.action === 'trigger-deploy') {
                await triggerDeploy()
                return sendJson(res, 200, { ok: true })
              }
              if (body.action === 'send-notification') {
                if (typeof body.text !== 'string') return sendJson(res, 400, { error: 'Message is required' })
                await adminCreateNotification(body.text, typeof body.timeLabel === 'string' ? body.timeLabel : 'New')
                return sendJson(res, 200, { ok: true })
              }
              const action = body.action
              const userId = body.userId
              const allowed = action === 'suspend-user' || action === 'unsuspend-user' || action === 'delete-user'
              if (!allowed || typeof userId !== 'string' || !isValidUserId(userId)) {
                return sendJson(res, 400, { error: 'Invalid request' })
              }
              if (userId === user.id) {
                return sendJson(res, 400, { error: 'You cannot perform this action on your own account' })
              }
              if (action === 'suspend-user') await adminSetUserSuspended(userId, true)
              else if (action === 'unsuspend-user') await adminSetUserSuspended(userId, false)
              else await adminDeleteUser(userId)
              sendJson(res, 200, { ok: true })
            } catch (err) {
              sendJson(res, 500, { error: err instanceof Error ? err.message : 'Admin action failed' })
            }
          })

          server.middlewares.use('/api/supabase-oauth', async (req, res) => {
            if (!hasOAuthClient()) return sendJson(res, 503, { error: 'Supabase OAuth not configured' })
            const u = new URL(req.url || '', 'http://localhost')
            const action = u.searchParams.get('action')
            const host = req.headers.host
            const appBase = `http://${host}`
            const redirect = `${appBase}/api/supabase-oauth?action=callback`
            const projectUrl = (projectId: string, params: Record<string, string>) =>
              `${appBase}/projects/${encodeURIComponent(projectId)}?${new URLSearchParams(params).toString()}`

            if (action === 'start' && req.method === 'GET') {
              const user = await verifyUser(req.headers.authorization || `Bearer ${u.searchParams.get('token') ?? ''}`)
              if (!user) return sendJson(res, 401, { error: 'Unauthorized' })
              const state = mintOAuthState(user.id, u.searchParams.get('projectId') || '')
              res.statusCode = 302
              res.setHeader('Location', buildAuthorizeUrl(redirect, state))
              return res.end()
            }
            if (action === 'callback' && req.method === 'GET') {
              const code = u.searchParams.get('code') || ''
              const parsed = verifyOAuthState(u.searchParams.get('state') || '')
              if (!code || !parsed) return sendJson(res, 400, { error: 'Invalid OAuth callback' })
              try {
                const tokens = await exchangeOAuthCode(code, redirect)
                const projects = await listOrgProjects(tokens.accessToken)
                await storeConnection(parsed.userId, { orgId: projects[0]?.orgId ?? 'unknown', tokens })
                res.statusCode = 302
                res.setHeader('Location', projectUrl(parsed.projectId, { backend: 'connected' }))
                return res.end()
              } catch (err) {
                res.statusCode = 302
                res.setHeader('Location', projectUrl(parsed.projectId, {
                  backend: 'error',
                  message: err instanceof Error ? err.message : 'failed',
                }))
                return res.end()
              }
            }
            if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })
            const user = await verifyUser(req.headers.authorization)
            if (!user) return sendJson(res, 401, { error: 'Unauthorized' })
            if (!(await rateLimit(`sboauth:${user.id}`, 30, 60_000))) return sendJson(res, 429, { error: 'Too many requests' })
            const body = await readJsonBody<{ action?: string; projectId?: string; ref?: string; name?: string }>(req)
            try {
              if (body.action === 'list-projects') {
                const at = await getValidAccessToken(user.id)
                if (!at) return sendJson(res, 400, { error: 'No Supabase connection' })
                return sendJson(res, 200, { projects: await listOrgProjects(at) })
              }
              if (body.action === 'create-project' && body.name) {
                const at = await getValidAccessToken(user.id)
                if (!at) return sendJson(res, 400, { error: 'No Supabase connection' })
                const existing = await listOrgProjects(at)
                const orgId = existing[0]?.orgId
                const region = existing[0]?.region || 'us-east-1'
                if (!orgId) return sendJson(res, 400, { error: 'No Supabase organization found to create the project in.' })
                const project = await createSupabaseProject(at, { name: body.name, orgId, region })
                return sendJson(res, 200, { project })
              }
              if (body.action === 'pick-project' && body.projectId && body.ref) {
                const at = await getValidAccessToken(user.id)
                if (!at) return sendJson(res, 400, { error: 'No Supabase connection' })
                const info = await getProjectConnectionInfo(at, body.ref)
                await saveProjectBackend(user.id, body.projectId, body.ref, info)
                return sendJson(res, 200, { ok: true, supabaseUrl: info.supabaseUrl })
              }
              if (body.action === 'revoke') {
                await deleteConnection(user.id)
                return sendJson(res, 200, { ok: true })
              }
              sendJson(res, 400, { error: 'Unknown action' })
            } catch (err) {
              sendJson(res, 500, { error: err instanceof Error ? err.message : 'OAuth action failed' })
            }
          })
        },
      },
    ],
    build: {
      rollupOptions: {
        output: {
          // Vendor chunks only apply to the client bundle: the SSR build
          // (vite build --ssr, used by scripts/prerender.mjs) externalizes
          // these packages, and Rollup rejects external ids in manualChunks.
          manualChunks: isSsrBuild
            ? undefined
            : {
                'vendor-react': ['react', 'react-dom', 'react-router-dom'],
                'vendor-motion': ['framer-motion'],
                'vendor-esbuild': ['esbuild-wasm'],
                'vendor-export': ['jszip', 'html2canvas'],
              },
        },
      },
      sourcemap: false,
      minify: 'esbuild',
      cssMinify: 'esbuild',
    },
  }
})
