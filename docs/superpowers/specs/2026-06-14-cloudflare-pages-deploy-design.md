---
name: cloudflare-pages-deploy
description: Replace Netlify with Cloudflare Pages for user-generated site hosting. Full clean replacement: new env vars, DB column rename, new API endpoint, updated frontend.
metadata:
  type: project
  date: 2026-06-14
---

# Cloudflare Pages Deploy — Design Spec

## Goal

Replace Netlify with Cloudflare Pages for hosting user-generated sites. Cloudflare Pages offers unlimited sites and unlimited bandwidth on its free tier (500 builds/month), removing the per-site ceiling that limits how many users can be served without additional cost.

All existing projects migrate automatically on next redeploy — they get a new Cloudflare Pages URL replacing their Netlify URL. No manual migration step for users.

## Approach

Option A — clean replacement. Rename the endpoint, rename the DB column, replace all Netlify logic. No Netlify compatibility shim retained.

## Environment Variables

**Remove:** `NETLIFY_TOKEN`

**Add:**
- `CLOUDFLARE_ACCOUNT_ID` — found in the Cloudflare dashboard (right sidebar on any zone page)
- `CLOUDFLARE_API_TOKEN` — API token with **Cloudflare Pages: Edit** permission (create at cloudflare.com/profile/api-tokens)

Update `.env.example` accordingly.

## Database Migration

Single migration file added to `supabase/migrations/`:

```sql
ALTER TABLE public.projects
  RENAME COLUMN netlify_site_id TO cf_pages_project_name;
```

Existing rows are untouched — their values (old Netlify site IDs) stay in place but become irrelevant until the project is next deployed, at which point CF Pages creates a new project and the column is overwritten with the CF project name.

## Cloudflare Pages Deploy Logic (`api/_shared.ts`)

Replace the Netlify block with a Cloudflare Pages block. The `runNetlifyDeploy` function and all Netlify helpers (`netlifyFetch`, `createNetlifySite`, `deployToNetlifySite`, `uploadDeployFile`, `waitForDeployReady`) are removed and replaced with `runCloudflareDeploy` and supporting helpers.

**Deploy flow:**

1. **Create CF Pages project** (first deploy only, when `cf_pages_project_name` is null):
   - `POST https://api.cloudflare.com/client/v4/accounts/{account_id}/pages/projects`
   - Body: `{ "name": "ot-{projectId.slice(0,8)}-{randomSuffix}", "production_branch": "main" }`
   - Returns the project name which becomes the persistent identifier

2. **Upload deployment:**
   - `POST /accounts/{account_id}/pages/projects/{project_name}/deployments`
   - Multipart form containing files as a zip archive: `index.html`, `_headers`, `_redirects`
   - Use Node.js `zlib`/`Buffer` to produce the zip (no external dependency needed for a 3-file zip, or use a minimal zip builder)

3. **Poll for ready state:**
   - `GET /accounts/{account_id}/pages/projects/{project_name}/deployments/{deployment_id}`
   - Poll every 1s, up to 60 attempts (CF Pages typically deploys in 5–15s)
   - Ready when `result.latest_stage.name === "deploy"` and `result.latest_stage.status === "success"`

4. **Return** `{ url: "https://{project_name}.pages.dev", siteId: project_name }`

**Security invariant preserved:** The CF project name is always looked up from the DB via `getProjectForDeploy` (scoped to the authenticated user's JWT via RLS). The request body supplies only `projectId` and `html` — the project name is never trusted from the client.

**Updated shared helpers:**
- `getProjectForDeploy` — change `select=netlify_site_id` to `select=cf_pages_project_name`, update return type field name
- `persistProjectSiteId` — change `{ netlify_site_id: siteId }` to `{ cf_pages_project_name: siteId }`

## API Endpoint

- **File:** `api/deploy-netlify.ts` → `api/deploy.ts`
- **Route:** `/api/deploy-netlify` → `/api/deploy`
- Handler logic is otherwise identical (auth → rate limit → parse body → ownership check → deploy → persist → respond)

## Vite Dev Shim (`vite.config.ts`)

Change the middleware route from `/api/deploy-netlify` to `/api/deploy`. Import `runCloudflareDeploy` instead of `runNetlifyDeploy`.

## Frontend Changes

**`src/lib/deploy.ts`**
- Rename function `deployToNetlify` → `deploySite`
- Update fetch URL from `/api/deploy-netlify` to `/api/deploy`

**`src/pages/ProjectBuilderPage.tsx`**
- Update `select(...)` call: `netlify_site_id` → `cf_pages_project_name`
- Update state variable `netlifySiteId` → `cfPagesProjectName` (and its setter)
- Update the `supabase.from('projects').update({ netlify_site_id: ... })` call
- Update import of `deployToNetlify` to `deploySite`

**`src/pages/DashboardPage.tsx`**
- Update `Project` type field `netlify_site_id` → `cf_pages_project_name`
- Update `.select(...)` string
- Update `deployedProject` finder: `p.netlify_site_id` → `p.cf_pages_project_name`

## Tests

**`src/lib/__tests__/deploy.test.ts`**
- Update expected fetch URL from `/api/deploy-netlify` to `/api/deploy`
- Update `siteId` references if needed (shape is unchanged: `{ url, siteId }`)

## Files Touched

| File | Change |
|------|--------|
| `api/_shared.ts` | Remove Netlify block, add CF Pages block; update `getProjectForDeploy` + `persistProjectSiteId` |
| `api/deploy-netlify.ts` | Delete (replaced by `api/deploy.ts`) |
| `api/deploy.ts` | New file (same structure as old endpoint) |
| `vite.config.ts` | Update route + import |
| `src/lib/deploy.ts` | Rename function, update URL |
| `src/pages/ProjectBuilderPage.tsx` | Rename `netlify_site_id` → `cf_pages_project_name` throughout |
| `src/pages/DashboardPage.tsx` | Same rename |
| `src/lib/__tests__/deploy.test.ts` | Update URL assertion |
| `.env.example` | Swap `NETLIFY_TOKEN` for `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN` |
| `supabase/migrations/YYYYMMDD_rename_netlify_site_id.sql` | `ALTER TABLE projects RENAME COLUMN netlify_site_id TO cf_pages_project_name` |

## Out of Scope

- Custom domains on CF Pages (can be a follow-up)
- Migrating old Netlify sites programmatically (they stay live on Netlify until the user redeploys)
- Removing the Netlify account (manual, can be done after all sites have migrated)
