# Full-Stack App Generation — BYO Supabase Backend

**Date:** 2026-06-17
**Status:** Approved design, pre-implementation
**Wedge:** Let OpenThorn generate **CRUD-with-auth apps** (data that persists + users that
log in), not just static frontends — the single biggest gap for users who want a "real app."

---

## 1. Decisions (the load-bearing forks)

| Decision | Choice | Why |
|---|---|---|
| Scope of v1 | **Data + auth (CRUD)** only | Covers ~80% of "real app" requests without committing to running arbitrary compute. |
| Backend model | **BYO backend — the user's own Supabase project** | Keeps the BYOK identity intact (keys we encrypt, data the user owns); zero hosting cost/liability; Supabase Auth solves auth for free; deployed artifact stays static. |
| Schema apply | **Auto-apply via the Supabase Management API** | One tool, not "generate then go do database homework." |
| Connection auth | **"Authorize Supabase" OAuth2 button** | No pasting tokens; same model as the Vercel/GitHub integrations. |
| Preview model | **Live connection to the real Supabase** (Approach A) | The only model where the verification gate keeps its teeth — a real CRUD round-trip against the real schema. |

Rejected: managed multi-tenant backend (breaks the pure-tool/free-tier model, takes on
data liability); Cloudflare D1 (auth not solved, more plumbing); mock-backend preview
(weakens the verification gate — the preview could lie); copy-paste SQL (more friction,
less "one tool" feel).

---

## 2. Architecture overview

OpenThorn stays a **fully client-side generator with a static deploy artifact**. The new
capability is a thin server-side control plane (OAuth + migrations) plus a live data plane
the generated app talks to directly at runtime.

```
Builder (browser)                    OpenThorn server (Vercel fns)        User's Supabase
─────────────────                    ─────────────────────────────        ───────────────
Authorize Supabase ───OAuth code───▶ /api/supabase-oauth/callback ──────▶ /v1/oauth/token
                                     store access+refresh (encrypted)
pick project        ◀──projects list── (Management API) ◀────────────────  /v1/projects
agent: set_schema ──spec──▶ /api/migrate ─compile→diff→DDL──────────────▶ /v1/projects/{ref}/database/query
preview iframe ───────────────────────────────anon key, fetch/wss────────▶ PostgREST / Auth / Realtime
deploy (static HTML w/ injected anon key+url) ───────────────────────────▶ same
```

Key reuse of existing machinery:
- **Encryption:** `encryptForUser` / `decryptForUser` in `api/_shared.ts` (AES-256-GCM, per-user HKDF) for OAuth tokens.
- **Auth/rate-limit:** `verifyUser`, `rateLimit` in `api/_shared.ts`.
- **Dev parity:** every new `/api/*` endpoint gets a matching dev shim in `vite.config.ts` importing shared logic from `_shared.ts`.
- **Deploy:** unchanged. The bundled HTML the preview produces is the deploy artifact; it just carries an injected Supabase config global.
- **CSP:** **no change** — `connect-src 'self' https: wss:` already permits any `*.supabase.co` from the sandboxed preview iframe.

---

## 3. Connecting a backend — OAuth flow + data model

### One-time platform setup (owner)
Register OpenThorn as a Supabase OAuth app. Env vars (mirroring `KEY_ENCRYPTION_SECRET`):
- `SUPABASE_OAUTH_CLIENT_ID`
- `SUPABASE_OAUTH_CLIENT_SECRET` (server-only)
- Fixed redirect URL → `/api/supabase-oauth/callback`

### User flow (zero pasting)
1. Click **Authorize Supabase** → redirect to `https://api.supabase.com/v1/oauth/authorize?client_id=…&redirect_uri=…&response_type=code&state=…`. `state` is a signed, single-use nonce minted server-side (CSRF).
2. User consents and **picks an organization** (Supabase OAuth grants are org-scoped — one grant covers all projects in that org; requires org-admin rights).
3. Supabase redirects to `/api/supabase-oauth/callback?code=…&state=…`. Server verifies `state`, exchanges `code` at `https://api.supabase.com/v1/oauth/token` with `client_secret` → `access_token` (~24h TTL) + `refresh_token` (long-lived).
4. Server stores both tokens **encrypted**, then lists the org's projects via Management API. User picks which Supabase project this OpenThorn project maps to.
5. Server auto-fetches that project's `url` + `anon_key` (`/v1/projects/{ref}/api-keys`). Nothing is typed.

### Token lifecycle
Every server call needing the Management API checks `expires_at` first; if stale, refresh via
the `refresh_token` grant and re-encrypt the rotated pair. A `revoke` action deletes stored
tokens and calls Supabase's revoke endpoint.

### Data model (OpenThorn's own Supabase; new RLS-locked migration in `supabase/migrations/`)
- **`supabase_connections`** — keyed by `user_id` (reusable across that user's projects):
  `access_token_enc`, `refresh_token_enc`, `expires_at`, `org_id`, `scopes`, timestamps.
  Encrypted columns never client-selectable (service-role read only, or a client-safe view that omits them).
- **`project_backends`** — per project: `project_id` (FK, unique), chosen `project_ref`,
  `supabase_url`, `supabase_anon_key` (public/client-safe).
- **`project_migrations`** — `project_id`, `version`, `name`, `sql`, `checksum`, `applied_at`.
  Mirror of a `_openthorn_migrations` bookkeeping table created inside the user's DB.

Fallback (later): a paste-a-personal-access-token path for users without org-admin rights.

---

## 4. Migration engine + agent tools

### Declarative schema, never raw SQL
The agent calls one new tool, **`set_schema`**, with a *declarative* spec. OpenThorn compiles
it to SQL server-side. This is the central safety decision: it **guarantees RLS is enabled with
a sane policy on every table** — the exact failure mode (a forgotten `enable row level security`)
that makes BYO-database dangerous. The agent cannot inject SQL because it supplies structured
fields only.

`set_schema` input (sketch):
```
tables: [{
  name: 'todos',
  columns: [
    { name: 'title', type: 'text', nullable: false },
    { name: 'done',  type: 'boolean', default: false },
  ],
  access: 'owner'   // 'owner' | 'public_read' | 'authenticated'
}]
```
Auto-added per table: `id uuid pk`, `user_id uuid references auth.users default auth.uid()`,
`created_at timestamptz default now()`. `access` maps to a vetted RLS policy template; the agent
never hand-writes a policy.

### Pipeline (`/api/migrate`)
1. Agent calls `set_schema`; client sends spec + `projectId`.
2. Server loads `project_backends`, resolves a valid Management API token (refresh if expired).
3. Compile spec → **idempotent SQL** (`create table if not exists`, additive `alter … add column if not exists`, `enable row level security`, existence-guarded `create policy`).
4. Read user DB's `_openthorn_migrations` (create first run), **diff** desired-vs-applied, compute delta.
5. **Destructive-change guard:** drops / type-narrowing are *never* auto-applied — returned as
   `pendingDestructive` with exact SQL; require explicit user approval. Additive changes apply automatically.
6. Apply delta via `POST /v1/projects/{ref}/database/query`; record each step into both
   `_openthorn_migrations` (user DB) and `project_migrations` (OpenThorn DB) with a checksum.
7. Response: applied steps, generated **TypeScript types** for the schema, any `pendingDestructive`.

### Tool integration (`agent-prompt.ts`)
- `set_schema` added to `AGENT_TOOLS`, matching the existing definition shape.
- Included in `CORE_TOOL_NAMES` **only when the project has a backend connection** — hidden
  otherwise so pure-website builds are unchanged.
- Categorized in `TOOL_CATEGORIES` as `write`; sets `dirtySinceCompile`.
- `/api/migrate` reuses `rateLimit` (~30/min/user).

---

## 5. Client injection, auth UX, verification

### Live client in preview *and* deploy (mirror the router-injection trick)
- Add `@supabase/supabase-js` to `ALLOWED_PACKAGES` (pinned) → resolves via the esm.sh import map.
- Inject `<script>window.__OPENTHORN_SUPABASE__={url,anonKey}</script>` into the built HTML
  (values from `project_backends`, both public).
- Provide a **virtual module** `openthorn:db` (resolved by `virtualFsPlugin`) exposing `db` and
  `auth` from a generated client that reads `window.__OPENTHORN_SUPABASE__` and calls
  `createClient`. The agent imports `{ db, auth } from 'openthorn:db'` — never hardcodes keys; same
  code runs unchanged in preview and on `pages.dev`.
- `persistSession: true`. In the sandboxed preview the in-memory `localStorage` polyfill makes
  this a no-op (session lives for the iteration, not across reload); on the real deployed site
  `localStorage` works normally so users stay logged in.

### Auth UX
Supabase Auth provides email/password (+ OAuth) out of the box. The agent builds normal
sign-in/sign-up/sign-out UI against `auth.signUp` / `auth.signInWithPassword` /
`auth.onAuthStateChange`, styled like the rest of the app. No fixed auth component shipped — just
the `auth` helper. System prompt gains a short "backend apps" section: data is per-user via RLS,
gate writes behind a signed-in session, show a sign-in screen when logged out.

### Verification round-trip (keeps the done-gate honest)
- On backend connection, OpenThorn provisions **one persistent "preview test user"** in the
  user's Supabase project (via Management/Auth-admin API with the OAuth token; credentials stored
  server-side per project, never shipped to deploys).
- `compile`/`done` smoke test signs in as that user in the preview iframe and runs a real CRUD
  round-trip against the live schema: insert → read back → delete. RLS blocking it → gate fails
  with a specific message. Proves schema + RLS + client wiring + auth actually work.
- Test rows are namespaced and cleaned up so real data isn't polluted.

### Structured failure surfaces (consistent with how malformed tool-calls are surfaced today)
- `BACKEND_NOT_CONNECTED` — `set_schema` with no connection → tell the user to click Authorize.
- `MIGRATION_FAILED` — DDL error from Management API, verbatim.
- `PENDING_DESTRUCTIVE` — needs explicit user approval.

---

## 6. Scope cut for v1 (explicit YAGNI)

In: tables + columns + relationships, RLS templates (`owner` / `public_read` / `authenticated`),
Supabase Auth (email/password), CRUD, server-applied migrations with destructive guard, live
preview round-trip.

Out (clean follow-ons): storage/file uploads, edge functions, realtime subscriptions, arbitrary
SQL escape hatch, custom triggers/functions/extensions, custom RLS policies, paste-token fallback.

---

## 7. New/changed surfaces (implementation map)

**New server endpoints** (+ matching `vite.config.ts` dev shims, shared logic in `_shared.ts`):
- `api/supabase-oauth.ts` — start (mint `state`) + callback (exchange code, store tokens, list projects).
- `api/migrate.ts` — compile spec → diff → apply DDL; manage `_openthorn_migrations`.
- Shared helpers in `_shared.ts`: OAuth token exchange/refresh, Management API client,
  spec→SQL compiler, destructive-diff, preview-test-user provisioning.

**New DB migration:** `supabase_connections`, `project_backends`, `project_migrations` (all RLS-locked).

**Agent:** `set_schema` tool (`agent-prompt.ts`); conditional inclusion in `CORE_TOOL_NAMES`;
`TOOL_CATEGORIES` entry; "backend apps" prompt section; structured error results.

**Preview/bundle:** `@supabase/supabase-js` in `ALLOWED_PACKAGES`; `openthorn:db` virtual module in
`virtualFsPlugin.ts`; config-global injection in `preview-bundle.ts`; round-trip step in
`preview-runtime-check.ts`.

**UI:** "Connect backend" panel (sibling to Providers) — Authorize button, org/project picker,
connection status, revoke.

**Env:** `SUPABASE_OAUTH_CLIENT_ID`, `SUPABASE_OAUTH_CLIENT_SECRET` (+ `.env.example`, CLAUDE.md env list).
