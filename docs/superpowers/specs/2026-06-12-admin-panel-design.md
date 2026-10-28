# OpenThorn Admin Panel — Design

**Date:** 2026-06-12
**Status:** Approved

## Goal

A built-in admin panel at `/admin` covering three areas: community moderation + user management, platform configuration (global model catalog, provider toggles, banner, feature flags), and a content CMS for blog posts and templates. Observability dashboards are explicitly out of scope for now.

## Decisions made during brainstorming

- **Admin access:** `is_admin boolean` flag on `profiles`, set manually via SQL. Supports multiple admins later without redeploy.
- **Blog publishing model:** "Instant + rebuild" — blog pages fetch published posts from Supabase at runtime (instant visibility); publishing also fires a Vercel deploy hook so the prerender pipeline regenerates static HTML / OG cards / sitemap for SEO.
- **Write architecture:** Hybrid — plain CRUD goes directly to Supabase under new `is_admin` RLS policies (same pattern as the rest of the app); a small `api/admin.ts` Vercel function handles only operations that need server power (deploy hook, suspend/delete users via service role).

## 1. Foundation (admin role + route)

### Migration

- Add `is_admin boolean not null default false` to `profiles`.
- **Self-escalation guard:** the existing profile-update RLS policy must be tightened so a user cannot set their own `is_admin` (enforced via a `security definer` trigger or a column-level check on update).
- **Recursion guard:** create `public.is_admin()` as a `security definer` function; all admin RLS policies call it instead of subquerying `profiles` directly. This project has previously hit RLS infinite recursion from cross-table policies — do not regress.

### Routing & layout

- Lazy-loaded `/admin` route group in `src/App.tsx`, consistent with existing code-splitting (keeps admin code out of the main bundle).
- `AdminGuard` component: redirects non-admins away (checks `profiles.is_admin` for the signed-in user).
- Nav link to `/admin` renders only for admins.
- `AdminLayout` with sidebar sections: Moderation, Users, Config, Blog, Templates.

## 2. New tables (one migration)

| Table | Columns (essentials) |
|---|---|
| `blog_posts` | id, slug (unique), title, description, content (markdown), tags, cover image, status (`draft`/`published`), published_at, SEO fields, timestamps |
| `templates` | id, name, category, description, `files` jsonb (`[{path, code}]`), featured flag, sort_order, status, timestamps |
| `app_config` | key (pk), value jsonb, updated_at |

Additional columns on existing tables:

- `community_posts.hidden boolean default false`
- `community_posts.featured boolean default false`
- `profiles.suspended boolean default false`
- `profiles.publish_banned boolean default false`

RLS:

- Public/anon can read `blog_posts` where status = published, `templates` where status = published, and all of `app_config`.
- Only `is_admin()` can insert/update/delete on these tables and set the moderation columns.
- `community_posts` public SELECT excludes `hidden = true` rows (or the UI filters them; policy-level preferred).

Seeding: the migration seeds `blog_posts` from the existing static markdown posts and `templates` from the hardcoded `TEMPLATES` in `src/lib/templates.ts`.

## 3. Admin sections

### Moderation

- Searchable list of community posts; hide (soft, reversible) and hard delete.
- Feature/pin posts (`featured`) so they surface first on the community page.
- Ban a user from publishing to community (`publish_banned`); publish flow checks the flag.

### Users

- Search/list profiles with project and community-post counts.
- Suspend account and delete account — both go through the admin API (require service role: Supabase auth ban / existing `delete_user_function`).

### Platform config

- **Model catalog editor:** `app_config` key `provider_models` overrides the hardcoded `DEFAULT_PROVIDER_MODELS` at load time; hardcoded list remains the fallback when the key is absent or partial. Goal: ship model-list updates without a redeploy.
- Per-provider enable/disable toggle.
- Site-wide announcement banner (text + dismissible + optional link), rendered app-wide when set.
- Simple feature flags (key → boolean) readable by the app.

### Blog CMS

- Post list with status; markdown editor with live preview (reuse the existing blog markdown renderer).
- Draft → publish workflow; publish sets `published_at` and fires the deploy hook via the admin API.
- Public blog pages switch to fetching published posts from Supabase at runtime.
- `scripts/prerender.mjs` fetches published posts from Supabase at build time so prerendered HTML, OG cards, and sitemap stay in sync.

### Template manager

- CRUD on templates with a per-file code editor.
- Live preview via the existing `buildPreview` pipeline (same as `TemplatesPage`).
- Featured flag and sort order controls.
- `TemplatesPage` switches to reading templates from the DB.

## 4. Admin API — `api/admin.ts`

- Single action-based endpoint following the existing `api/_shared.ts` pattern (Supabase JWT verification + per-user rate limiting).
- Re-verifies `is_admin` **server-side** via service role lookup; never trusts client claims.
- Actions:
  - `trigger-deploy` — fires the Vercel deploy hook (new env var `VERCEL_DEPLOY_HOOK_URL`).
  - `suspend-user` — Supabase auth admin ban + set `profiles.suspended`.
  - `delete-user` — via existing `delete_user_function` / auth admin API.
- A matching dev shim must be added in `vite.config.ts` so `/api/admin` behaves identically in dev (per project convention).
- New env vars: `VERCEL_DEPLOY_HOOK_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server-only). Update `.env.example`.

## 5. Error handling & testing

- Admin mutations show inline success/failure feedback.
- Deploy-hook failure is surfaced but does not block publishing — the post is already live at runtime.
- Tests in `src/lib/__tests__/`:
  - config-override merge logic (`DEFAULT_PROVIDER_MODELS` + `app_config.provider_models`)
  - blog post seed/serialization round-trip
  - admin API action handlers (auth rejection for non-admins, happy paths)
- Manual RLS verification with a non-admin account before launch (cannot read drafts, cannot write admin tables, cannot self-escalate `is_admin`).

## 6. Build order (each phase ships independently)

1. **Phase 1 — Foundation + Moderation + Users:** migration (`is_admin`, helper fn, moderation columns), `/admin` route + guard + layout, moderation UI, user management UI, `api/admin.ts` (suspend/delete actions) + dev shim.
2. **Phase 2 — Platform config:** `app_config` table, model catalog editor + load-time override in `providers.ts`, provider toggles, announcement banner, feature flags.
3. **Phase 3 — Blog CMS:** `blog_posts` table + seed, admin editor, runtime blog fetching, prerender pipeline change, `trigger-deploy` action + deploy hook.
4. **Phase 4 — Template manager:** `templates` table + seed, admin CRUD/editor/preview, `TemplatesPage` DB switch.

## Out of scope

- Observability dashboards (usage stats, deployment monitor, abuse logs) — possible later phase.
- Granular admin roles/permissions (single `is_admin` tier only).
- Editing `changelog.json` / `faq.json` / `glossary.json` from the panel.
- Editing the allowed npm package list from the panel.
