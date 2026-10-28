# Deploy Button & GitHub Integration — Design Spec

**Date:** 2026-06-02
**Status:** Approved

## Overview

Two independent actions in the Project Builder topbar:

1. **GitHub icon** — Push project files to a GitHub repo (if user has connected GitHub)
2. **Deploy button** — Bundle code into a single HTML file, upload to Supabase Storage, return a public URL

## Architecture

```
Topbar
├── GitHub icon  ───▶  pushToGitHub()   ───▶ GitHub API (user-connected token)
└── Deploy button ──▶  deployProject()  ───▶ Supabase Storage (public bucket)
```

### Deploy flow

```
Code files  ──bundleFiles()──▶  index.html  ──upload()──▶  Supabase Storage  ──▶ public URL
  (in mem)      inline CSS/JS    (self-contained)   public bucket       https://<project>.supabase.co/...
```

1. Collect all generated source files
2. Bundle into a single `index.html` — inline `<style>` tags for CSS, inline `<script>` tags for JS (CodePen-style)
3. Upload to public Supabase Storage bucket at `deployments/{projectId}/index.html`
4. Return the public URL to the user

### GitHub push flow

1. Click GitHub icon → check if user has GitHb connection in `user_integrations`
2. If not connected → compact dialog offering to connect via Supabase GitHub OAuth
3. If connected → push files to a new repo via GitHub REST API (Contents API for file creation). Show a toast on success/failure.

## Database

### New table: `user_integrations`

| Column | Type | Purpose |
|---|---|---|
| `id` | uuid PK | Auto-generated |
| `user_id` | uuid FK → auth.users | Owner |
| `provider` | text | `'github'` |
| `access_token` | text | OAuth token from Supabase |
| `provider_username` | text | For display |
| `metadata` | jsonb | Additional provider data |
| `connected_at` | timestamptz | When connected |
| `updated_at` | timestamptz | Last update |

RLS: users can only read/update/delete their own rows.

### New Supabase Storage bucket: `deployments`

- **Public access** for reads (anyone can view deployed sites)
- **Authenticated writes** with RLS policy: user can write to `deployments/{projectId}/**` if they own the project or have `edit` permission

## UI States

### GitHub icon

| State | Behavior |
|---|---|
| Not connected | Click → dialog: "Connect GitHub to push code" + Connect button |
| Connected | Click → push files to new repo, toast confirmation with repo link |

### Deploy button

| State | Button rendering | Action |
|---|---|---|
| Idle | "Deploy" (gradient green) | Start deploy |
| Deploying | Spinner + "Deploying…" (disabled) | — |
| Deployed | "View site ↗" (green glow) | Open URL in new tab |

When deployed, the preview address bar updates to show the live URL instead of the mock path.

## Files to create/modify

| File | Action | Purpose |
|---|---|---|
| `src/lib/deploy.ts` | Create | `bundleProject()`, `deployToStorage()`, `pushToGitHub()` |
| `src/lib/github.ts` | Create | GitHub API helpers (create repo, push files) |
| `src/pages/ProjectBuilderPage.tsx` | Modify | Wire up Deploy + GitHub icon handlers, add deploy states |
| `src/pages/ProjectBuilderPage.module.css` | Modify | Spinner animation, deployed button glow |
| Supabase migration | Create | `user_integrations` table |
| Supabase Storage | Create | `deployments` bucket with RLS |

## Out of scope (future)

- Vercel auto-deploy detection (linking repo → Vercel)
- Multi-file deployment (for now, single bundled HTML)
- Custom domains
- Deploy history / rollback
