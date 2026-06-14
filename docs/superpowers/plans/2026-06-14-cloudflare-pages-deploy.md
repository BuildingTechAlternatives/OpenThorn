# Cloudflare Pages Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Netlify with Cloudflare Pages for hosting user-generated sites, so the app can scale to unlimited sites at no added cost.

**Architecture:** A clean swap — the Netlify deploy logic in `api/_shared.ts` is replaced with Cloudflare Pages logic, the endpoint is renamed from `deploy-netlify` to `deploy`, and the DB column `netlify_site_id` is renamed to `cf_pages_project_name`. The security model (server looks up the CF project name from the DB scoped to the user's JWT, never trusts the client body) is preserved exactly.

**Tech Stack:** Cloudflare Pages REST API, Node.js `crypto` (sha256), `FormData` (Node 18+ global), Supabase (DB migration), Vitest (tests)

---

## File Map

| File | Action |
|------|--------|
| `supabase/migrations/20260614000000_rename_netlify_site_id.sql` | Create — rename DB column |
| `api/_shared.ts` | Modify — replace Netlify block with CF Pages block; update `getProjectForDeploy` + `persistProjectSiteId` |
| `api/deploy.ts` | Create — new endpoint (same structure as `deploy-netlify.ts`) |
| `api/deploy-netlify.ts` | Delete |
| `vite.config.ts` | Modify — update route + import |
| `src/lib/deploy.ts` | Modify — rename function, update URL |
| `src/pages/ProjectBuilderPage.tsx` | Modify — rename `netlify_site_id` → `cf_pages_project_name` throughout |
| `src/pages/DashboardPage.tsx` | Modify — same rename |
| `src/lib/__tests__/deploy.test.ts` | Modify — update describe label, URL, and imported function name |
| `.env.example` | Modify — swap `NETLIFY_TOKEN` for CF vars |

---

## Task 1: DB Migration

**Files:**
- Create: `supabase/migrations/20260614000000_rename_netlify_site_id.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- Rename the Netlify site id column to the provider-neutral CF Pages project name.
alter table public.projects
  rename column netlify_site_id to cf_pages_project_name;
```

- [ ] **Step 2: Apply the migration**

```bash
npx supabase db push
```

Expected: migration applies without error. Existing rows keep their value (the old Netlify site ID) — it becomes irrelevant until the project is redeployed.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260614000000_rename_netlify_site_id.sql
git commit -m "db: rename netlify_site_id to cf_pages_project_name"
```

---

## Task 2: Replace Netlify Logic in `_shared.ts`

**Files:**
- Modify: `api/_shared.ts`

This is the core logic change. Remove the entire Netlify block (lines 232–337) and replace with a Cloudflare Pages block. Also update two helper functions that reference `netlify_site_id`.

- [ ] **Step 1: Remove the Netlify block**

Delete everything from the comment `// Netlify deploy (for user-generated sites)` through the end of `runNetlifyDeploy`. That is: the `NETLIFY_API` constant, all interfaces and helpers (`netlifyFetch`, `createNetlifySite`, `sha1`, `deployUrl`, `uploadDeployFile`, `waitForDeployReady`, `deployToNetlifySite`), and `runNetlifyDeploy` itself.

Also remove the `sha1` import — replace it with `sha256` (same `createHash` call, different algorithm).

- [ ] **Step 2: Add the Cloudflare Pages block in its place**

Add the following after the rate-limiting block and before the Admin operations block:

```typescript
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
  const data = (await res.json()) as CFResult<T>
  if (!data.success) {
    throw new Error(`Cloudflare API error: ${data.errors.map((e) => e.message).join(', ')}`)
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

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

async function deployToCFPages(
  token: string,
  accountId: string,
  projectName: string,
  html: string,
): Promise<void> {
  const files = new Map<string, { content: string; contentType: string }>([
    ['/index.html', { content: html, contentType: 'text/html; charset=utf-8' }],
    ['/_headers', {
      content: '/index.html\n  Content-Type: text/html; charset=utf-8\n/*\n  X-Content-Type-Options: nosniff\n',
      contentType: 'text/plain',
    }],
    ['/_redirects', { content: '/* /index.html 200\n', contentType: 'text/plain' }],
  ])

  const manifest: Record<string, string> = {}
  for (const [path, { content }] of files) {
    manifest[path] = sha256(content)
  }

  const form = new FormData()
  form.append('manifest', JSON.stringify(manifest))
  for (const [path, { content, contentType }] of files) {
    form.append(path, new Blob([content], { type: contentType }), path.slice(1))
  }

  const deploy = await cfFetch<{ id: string }>(
    token,
    `/accounts/${accountId}/pages/projects/${projectName}/deployments`,
    { method: 'POST', body: form },
  )

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

export async function runCloudflareDeploy(input: DeployInput): Promise<{ url: string; siteId: string }> {
  const { accountId, token } = cfEnv()
  const projectName = input.existingSiteId ?? (await createCFPagesProject(token, accountId, input.projectId))
  await deployToCFPages(token, accountId, projectName, input.html)
  return { url: `https://${projectName}.pages.dev`, siteId: projectName }
}
```

Note: `DeployInput` interface (with `projectId`, `html`, `existingSiteId?`) is unchanged — keep it as-is.

- [ ] **Step 3: Update `getProjectForDeploy`**

Change the PostgREST select and the returned field from `netlify_site_id` to `cf_pages_project_name`.

Find this block in `getProjectForDeploy`:
```typescript
    const res = await fetch(
      `${env.url}/rest/v1/projects?id=eq.${encodeURIComponent(projectId)}&select=netlify_site_id&limit=1`,
      { headers: { apikey: env.anonKey, Authorization: `Bearer ${token}`, Accept: 'application/json' } },
    )
    if (!res.ok) return { ok: false, siteId: null }
    const rows = (await res.json()) as Array<{ netlify_site_id?: string | null }>
    if (!Array.isArray(rows) || rows.length === 0) return { ok: false, siteId: null }
    const siteId = rows[0]?.netlify_site_id
```

Replace with:
```typescript
    const res = await fetch(
      `${env.url}/rest/v1/projects?id=eq.${encodeURIComponent(projectId)}&select=cf_pages_project_name&limit=1`,
      { headers: { apikey: env.anonKey, Authorization: `Bearer ${token}`, Accept: 'application/json' } },
    )
    if (!res.ok) return { ok: false, siteId: null }
    const rows = (await res.json()) as Array<{ cf_pages_project_name?: string | null }>
    if (!Array.isArray(rows) || rows.length === 0) return { ok: false, siteId: null }
    const siteId = rows[0]?.cf_pages_project_name
```

- [ ] **Step 4: Update `persistProjectSiteId`**

Find:
```typescript
      body: JSON.stringify({ netlify_site_id: siteId }),
```
Replace with:
```typescript
      body: JSON.stringify({ cf_pages_project_name: siteId }),
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add api/_shared.ts
git commit -m "feat: replace Netlify deploy logic with Cloudflare Pages"
```

---

## Task 3: Create New Endpoint, Delete Old One

**Files:**
- Create: `api/deploy.ts`
- Delete: `api/deploy-netlify.ts`

- [ ] **Step 1: Create `api/deploy.ts`**

```typescript
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
    const result = await runCloudflareDeploy({ projectId, html, existingSiteId: access.siteId })
    if (result.siteId !== access.siteId) {
      await persistProjectSiteId(authorization, projectId, result.siteId)
    }
    res.status(200).json(result)
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Deploy failed' })
  }
}
```

- [ ] **Step 2: Delete `api/deploy-netlify.ts`**

```bash
git rm api/deploy-netlify.ts
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add api/deploy.ts
git commit -m "feat: add /api/deploy endpoint for Cloudflare Pages, remove deploy-netlify"
```

---

## Task 4: Update Vite Dev Shim

**Files:**
- Modify: `vite.config.ts`

- [ ] **Step 1: Update the import at the top of vite.config.ts**

Find:
```typescript
import { verifyUser, rateLimit, runNetlifyDeploy, getProjectForDeploy, persistProjectSiteId, ...
```

Replace `runNetlifyDeploy` with `runCloudflareDeploy` in the import. (The exact destructured list may vary — update only the changed name.)

- [ ] **Step 2: Update the middleware route and call**

Find:
```typescript
          server.middlewares.use('/api/deploy-netlify', async (req, res) => {
```
Replace with:
```typescript
          server.middlewares.use('/api/deploy', async (req, res) => {
```

Find inside that middleware:
```typescript
              const result = await runNetlifyDeploy({ projectId: body.projectId, html: body.html, existingSiteId: access.siteId })
```
Replace with:
```typescript
              const result = await runCloudflareDeploy({ projectId: body.projectId, html: body.html, existingSiteId: access.siteId })
```

- [ ] **Step 3: Verify dev server starts without errors**

```bash
npm run dev
```

Expected: Vite starts at http://localhost:5173 with no import or type errors.

- [ ] **Step 4: Commit**

```bash
git add vite.config.ts
git commit -m "feat: update vite dev shim to /api/deploy + runCloudflareDeploy"
```

---

## Task 5: Update `src/lib/deploy.ts`

**Files:**
- Modify: `src/lib/deploy.ts`

- [ ] **Step 1: Rename the function and update the URL**

Replace the entire file content with:

```typescript
import { supabase } from './supabase'

export interface DeployResult {
  url: string
  siteId: string
}

export async function deploySite(
  projectId: string,
  html: string,
  existingSiteId?: string | null,
): Promise<DeployResult> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) {
    throw new Error('You must be signed in to publish a site.')
  }

  const res = await fetch('/api/deploy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ projectId, html, existingSiteId }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText)
    throw new Error(`Deploy failed: ${body || res.statusText}`)
  }

  const data2 = await res.json()
  if (!data2?.url || !data2?.siteId) {
    throw new Error('Deploy failed: invalid response from deploy endpoint')
  }

  return {
    url: String(data2.url),
    siteId: String(data2.siteId),
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: error on `deployToNetlify` references in `ProjectBuilderPage.tsx` (that's the next task). Any error about `deploy.ts` itself means the file is wrong.

- [ ] **Step 3: Commit**

```bash
git add src/lib/deploy.ts
git commit -m "feat: rename deployToNetlify -> deploySite, point to /api/deploy"
```

---

## Task 6: Update `ProjectBuilderPage.tsx`

**Files:**
- Modify: `src/pages/ProjectBuilderPage.tsx`

- [ ] **Step 1: Update the import**

Find:
```typescript
import { deployToNetlify } from '../lib/deploy'
```
Replace with:
```typescript
import { deploySite } from '../lib/deploy'
```

(If `DeployResult` is also imported from `deploy`, keep that import — it's unchanged.)

- [ ] **Step 2: Rename the state variable**

Find (line ~816):
```typescript
  const [netlifySiteId, setNetlifySiteId] = useState<string | null>(null)
```
Replace with:
```typescript
  const [cfPagesProjectName, setCfPagesProjectName] = useState<string | null>(null)
```

- [ ] **Step 3: Update the project data fetch select string**

Find:
```typescript
        .select('user_id, title, files, chat_history, netlify_site_id, generating, generating_by, selected_model')
```
Replace with:
```typescript
        .select('user_id, title, files, chat_history, cf_pages_project_name, generating, generating_by, selected_model')
```

- [ ] **Step 4: Update the state setter after loading project**

Find (line ~1021):
```typescript
      setNetlifySiteId(typeof existing?.netlify_site_id === 'string' ? existing.netlify_site_id : null)
```
Replace with:
```typescript
      setCfPagesProjectName(typeof existing?.cf_pages_project_name === 'string' ? existing.cf_pages_project_name : null)
```

- [ ] **Step 5: Update the `handleDeploy` callback**

Find (line ~1359):
```typescript
      const deploy = await deployToNetlify(projectId!, result.html, netlifySiteId)
```
Replace with:
```typescript
      const deploy = await deploySite(projectId!, result.html, cfPagesProjectName)
```

Find (line ~1362):
```typescript
      if (deploy.siteId !== netlifySiteId && user && projectId) {
        const { error } = await supabase
          .from('projects')
          .update({ netlify_site_id: deploy.siteId })
          .eq('id', projectId)
          .eq('user_id', user.id)

        if (error) {
          throw new Error(`Deploy succeeded, but saving the Netlify site failed: ${error.message}`)
        }

        setNetlifySiteId(deploy.siteId)
      }
```
Replace with:
```typescript
      if (deploy.siteId !== cfPagesProjectName && user && projectId) {
        const { error } = await supabase
          .from('projects')
          .update({ cf_pages_project_name: deploy.siteId })
          .eq('id', projectId)
          .eq('user_id', user.id)

        if (error) {
          throw new Error(`Deploy succeeded, but saving the site failed: ${error.message}`)
        }

        setCfPagesProjectName(deploy.siteId)
      }
```

- [ ] **Step 6: Verify TypeScript compiles with no errors**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/pages/ProjectBuilderPage.tsx
git commit -m "feat: update ProjectBuilderPage to use deploySite + cf_pages_project_name"
```

---

## Task 7: Update `DashboardPage.tsx`

**Files:**
- Modify: `src/pages/DashboardPage.tsx`

- [ ] **Step 1: Update the `Project` interface**

Find (line ~19):
```typescript
  netlify_site_id: string | null
```
Replace with:
```typescript
  cf_pages_project_name: string | null
```

- [ ] **Step 2: Update both `.select()` calls**

There are two queries that include `netlify_site_id` (owned projects and shared projects). Find both:
```typescript
        .select('id, user_id, title, preview_url, netlify_site_id, created_at, updated_at, starred')
```
Replace both occurrences with:
```typescript
        .select('id, user_id, title, preview_url, cf_pages_project_name, created_at, updated_at, starred')
```

- [ ] **Step 3: Update the `deployedProject` finder**

Find (line ~532):
```typescript
  const deployedProject = projects.find((p) => p.netlify_site_id)
```
Replace with:
```typescript
  const deployedProject = projects.find((p) => p.cf_pages_project_name)
```

- [ ] **Step 4: Verify TypeScript compiles with no errors**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/pages/DashboardPage.tsx
git commit -m "feat: update DashboardPage to use cf_pages_project_name"
```

---

## Task 8: Update Tests

**Files:**
- Modify: `src/lib/__tests__/deploy.test.ts`

- [ ] **Step 1: Update the test file**

Replace the entire file with:

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.fn()

vi.stubGlobal('fetch', fetchMock)

vi.mock('../supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'test-token' } } }),
    },
  },
}))

describe('deploySite', () => {
  beforeEach(() => {
    vi.resetModules()
    fetchMock.mockReset()
  })

  it('posts deploy requests to the same-origin deploy endpoint', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        siteId: 'ot-abc12345-xyz123',
        url: 'https://ot-abc12345-xyz123.pages.dev',
      }),
    })

    const { deploySite } = await import('../deploy')
    const result = await deploySite('project-12345678', '<!doctype html><html>OpenThorn</html>')

    expect(result).toEqual({
      siteId: 'ot-abc12345-xyz123',
      url: 'https://ot-abc12345-xyz123.pages.dev',
    })
    expect(fetchMock).toHaveBeenCalledWith('/api/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
      body: JSON.stringify({
        projectId: 'project-12345678',
        html: '<!doctype html><html>OpenThorn</html>',
      }),
    })
  })

  it('reuses an existing CF Pages project when one is saved', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        siteId: 'ot-existing-abc',
        url: 'https://ot-existing-abc.pages.dev',
      }),
    })

    const { deploySite } = await import('../deploy')
    const result = await deploySite('project-1', '<html></html>', 'ot-existing-abc')

    expect(result).toEqual({
      siteId: 'ot-existing-abc',
      url: 'https://ot-existing-abc.pages.dev',
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('/api/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
      body: JSON.stringify({
        projectId: 'project-1',
        html: '<html></html>',
        existingSiteId: 'ot-existing-abc',
      }),
    })
  })
})
```

- [ ] **Step 2: Run the tests**

```bash
npx vitest run src/lib/__tests__/deploy.test.ts
```

Expected: 2 tests pass.

- [ ] **Step 3: Run the full test suite**

```bash
npm run test
```

Expected: all tests pass (no regressions).

- [ ] **Step 4: Commit**

```bash
git add src/lib/__tests__/deploy.test.ts
git commit -m "test: update deploy tests for deploySite + /api/deploy"
```

---

## Task 9: Update `.env.example` and Final Cleanup

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Swap the Netlify token for Cloudflare vars**

Find:
```
# Netlify Personal Access Token used to deploy user-generated sites.
# Get it from app.netlify.com/user/applications
NETLIFY_TOKEN=your-netlify-pat-here
```
Replace with:
```
# Cloudflare credentials used to deploy user-generated sites to Cloudflare Pages.
# Account ID: Cloudflare dashboard → right sidebar on any page.
# API Token: cloudflare.com/profile/api-tokens → create token with "Cloudflare Pages: Edit" permission.
CLOUDFLARE_ACCOUNT_ID=your-account-id-here
CLOUDFLARE_API_TOKEN=your-api-token-here
```

- [ ] **Step 2: Run the full test suite one final time**

```bash
npm run test
```

Expected: all tests pass.

- [ ] **Step 3: Run the linter**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add .env.example
git commit -m "chore: update .env.example — swap NETLIFY_TOKEN for Cloudflare Pages vars"
```

---

## Setup Checklist (for Thomas to do manually)

Before testing the deploy flow end-to-end:

1. Sign up at cloudflare.com (free)
2. Note your **Account ID** from the dashboard right sidebar
3. Go to cloudflare.com/profile/api-tokens → Create Token → use the "Edit Cloudflare Workers" template → scope to Cloudflare Pages: Edit → generate
4. Add `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` to:
   - Your local `.env` file (for dev testing)
   - Vercel project environment variables (for production)
5. Remove `NETLIFY_TOKEN` from Vercel env vars once all existing projects have been redeployed
