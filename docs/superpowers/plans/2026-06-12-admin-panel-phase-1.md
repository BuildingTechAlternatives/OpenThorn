# Admin Panel Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the admin foundation (is_admin role, `/admin` route group) plus community moderation and user management, per `docs/superpowers/specs/2026-06-12-admin-panel-design.md` Phase 1.

**Architecture:** An `is_admin` flag on `profiles` guarded by a `security definer` helper (`public.is_admin()`) drives new RLS policies; plain CRUD (moderation, publish bans) goes straight to Supabase from the admin UI, while suspend/delete-user go through a new `api/admin.ts` Vercel function (mirrored by a vite dev shim) using the service-role key. Admin pages are a lazy-loaded route group under `/admin`.

**Tech Stack:** React 19 + TypeScript, React Router v7, CSS Modules, Supabase (Postgres/RLS/Auth admin API), Vercel Functions, Vitest.

**Conventions that bind every task:**
- Never add `Co-Authored-By` to commits.
- Use CSS custom-property tokens (`--color-bg`, `--color-text`, `--color-accent`) — no hardcoded hex except where the existing file already does.
- Server endpoint logic lives in `api/_shared.ts` and is consumed by BOTH `api/admin.ts` and the vite dev shim.
- Run commands from the repo root (`C:\Users\Thoma\OneDrive\Dokumente\Informatik\Bloom`).

**Context an engineer needs (read these before starting):**
- `api/_shared.ts` — existing JWT verify (`verifyUser`), `rateLimit`, fetch-based PostgREST access patterns.
- `api/provider-keys.ts` — the Vercel handler shape (`VercelReq`/`VercelRes` local interfaces).
- `vite.config.ts` — dev shims for `/api/*`; new shims must match production behavior.
- `src/App.tsx` — lazy route registration pattern.
- `src/components/ProtectedRoute/ProtectedRoute.tsx` — gate component pattern; `useAuth()` exposes `{ user, session, loading }`.
- `supabase/migrations/20260608000000_restrict_profiles_select.sql` — profiles SELECT is restricted to own row; cross-user reads need `security definer` functions or new admin policies.
- **Note:** `community_posts` / `community_likes` were created via the Supabase dashboard and have no migration file. The migration below alters them directly — it is written to be applied to the production database where they exist.

---

### Task 1: Database migration — admin foundation

**Files:**
- Create: `supabase/migrations/20260613000000_admin_foundation.sql`

- [ ] **Step 1: Write the migration**

```sql
-- ============================================================
-- Admin panel Phase 1: is_admin role, moderation columns,
-- admin RLS policies, publish-ban enforcement, user listing RPC.
-- See docs/superpowers/specs/2026-06-12-admin-panel-design.md
-- ============================================================

-- 1. Privileged columns on profiles
alter table public.profiles
  add column if not exists is_admin boolean not null default false,
  add column if not exists suspended boolean not null default false,
  add column if not exists publish_banned boolean not null default false;

-- 2. is_admin() helper. SECURITY DEFINER so RLS policies can call it
-- without recursing into the profiles policies (this project has hit
-- RLS infinite recursion from cross-table policy subqueries before).
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- 3. Publish-ban helper (same recursion-safe pattern)
create or replace function public.is_publish_banned()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select publish_banned from public.profiles where id = auth.uid()), false)
$$;

revoke all on function public.is_publish_banned() from public, anon;
grant execute on function public.is_publish_banned() to authenticated;

-- 4. Self-escalation guard: a signed-in non-admin may not change the
-- privileged columns (their own update policy would otherwise let them
-- flip is_admin on their own row). auth.uid() is null for the SQL
-- editor and the service role, so server-side admin ops still work.
create or replace function public.protect_privileged_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.is_admin is distinct from old.is_admin
      or new.suspended is distinct from old.suspended
      or new.publish_banned is distinct from old.publish_banned) then
    if auth.uid() is not null and not public.is_admin() then
      raise exception 'changing privileged profile columns is not allowed';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_privileged_profile_columns on public.profiles;
create trigger protect_privileged_profile_columns
  before update on public.profiles
  for each row execute procedure public.protect_privileged_profile_columns();

-- 5. Admin policies on profiles (list users, set publish_banned)
drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin" on public.profiles
  for select to authenticated using (public.is_admin());

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin" on public.profiles
  for update to authenticated using (public.is_admin());

-- 6. Moderation columns on community_posts
alter table public.community_posts
  add column if not exists hidden boolean not null default false,
  add column if not exists featured boolean not null default false;

-- 7. Hidden posts disappear for everyone except their author and admins.
-- RESTRICTIVE so it ANDs with whatever permissive select policy the
-- table already has (created via dashboard).
drop policy if exists "community_posts_hide_hidden" on public.community_posts;
create policy "community_posts_hide_hidden" on public.community_posts
  as restrictive for select to authenticated
  using (hidden = false or user_id = auth.uid() or public.is_admin());

-- 8. Admins can moderate any post
drop policy if exists "community_posts_admin_update" on public.community_posts;
create policy "community_posts_admin_update" on public.community_posts
  for update to authenticated using (public.is_admin());

drop policy if exists "community_posts_admin_delete" on public.community_posts;
create policy "community_posts_admin_delete" on public.community_posts
  for delete to authenticated using (public.is_admin());

-- 9. Publish-banned users cannot create new community posts
drop policy if exists "community_posts_block_banned" on public.community_posts;
create policy "community_posts_block_banned" on public.community_posts
  as restrictive for insert to authenticated
  with check (not public.is_publish_banned());

-- 10. Admin user listing with per-user counts (avoids N+1 from the
-- client and avoids granting admins broad SELECT on projects).
create or replace function public.admin_list_users()
returns table (
  id uuid,
  email text,
  full_name text,
  avatar_url text,
  is_admin boolean,
  suspended boolean,
  publish_banned boolean,
  project_count bigint,
  post_count bigint
)
language sql
security definer
stable
set search_path = public
as $$
  select
    p.id, p.email, p.full_name, p.avatar_url,
    p.is_admin, p.suspended, p.publish_banned,
    (select count(*) from public.projects pr where pr.user_id = p.id),
    (select count(*) from public.community_posts cp where cp.user_id = p.id)
  from public.profiles p
  where public.is_admin()
  order by p.email
$$;

revoke all on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;
```

- [ ] **Step 2: Apply the migration to the Supabase project**

Apply via the Supabase MCP `apply_migration` tool (name: `admin_foundation`), or paste into the dashboard SQL editor, or run `supabase db push`.
Expected: success, no errors. If `community_posts` is missing in the target database the migration fails at section 6 — that means you're pointed at the wrong database (production has it).

- [ ] **Step 3: Verify the helper exists and you are not yet admin**

Run in the SQL editor (or MCP `execute_sql`):
```sql
select public.is_admin();
select id, email, is_admin from public.profiles limit 5;
```
Expected: `is_admin()` returns `false` (SQL editor has no auth.uid()... it returns false via the coalesce); profiles rows show the new columns defaulting to false.

- [ ] **Step 4: Grant yourself admin**

```sql
update public.profiles set is_admin = true where email = 'thomas.tschinkel123@gmail.com';
```
Expected: `UPDATE 1`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260613000000_admin_foundation.sql
git commit -m "feat(db): admin role, moderation columns, admin RLS policies"
```

---

### Task 2: Server helpers in `api/_shared.ts` (TDD)

**Files:**
- Modify: `api/_shared.ts` (append a new section at the end)
- Test: `src/lib/__tests__/admin-shared.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/admin-shared.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

const USER_ID = '11111111-1111-4111-8111-111111111111'

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) }
}

describe('admin server helpers', () => {
  beforeEach(() => {
    vi.resetModules()
    fetchMock.mockReset()
    process.env.SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_ANON_KEY = 'anon-key'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
  })

  it('isAdminUser returns true when the profile row has is_admin', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([{ is_admin: true }]))
    const { isAdminUser } = await import('../../../api/_shared')
    await expect(isAdminUser(USER_ID)).resolves.toBe(true)
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toContain(`/rest/v1/profiles?id=eq.${USER_ID}`)
    expect(init.headers.Authorization).toBe('Bearer service-key')
  })

  it('isAdminUser returns false on non-admin, error, or missing service key', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([{ is_admin: false }]))
    const shared = await import('../../../api/_shared')
    await expect(shared.isAdminUser(USER_ID)).resolves.toBe(false)

    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    await expect(shared.isAdminUser(USER_ID)).resolves.toBe(false)
  })

  it('adminSetUserSuspended bans via the auth admin API and mirrors the flag', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}))
    const { adminSetUserSuspended } = await import('../../../api/_shared')
    await adminSetUserSuspended(USER_ID, true)

    const calls = fetchMock.mock.calls.map(([u]) => String(u))
    expect(calls[0]).toBe(`https://test.supabase.co/auth/v1/admin/users/${USER_ID}`)
    expect(fetchMock.mock.calls[0][1].method).toBe('PUT')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ ban_duration: '876000h' })
    expect(calls[1]).toContain(`/rest/v1/profiles?id=eq.${USER_ID}`)
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ suspended: true })
  })

  it('adminSetUserSuspended(false) lifts the ban', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}))
    const { adminSetUserSuspended } = await import('../../../api/_shared')
    await adminSetUserSuspended(USER_ID, false)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ ban_duration: 'none' })
  })

  it('adminDeleteUser deletes via the auth admin API', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}))
    const { adminDeleteUser } = await import('../../../api/_shared')
    await adminDeleteUser(USER_ID)
    expect(String(fetchMock.mock.calls[0][0])).toBe(`https://test.supabase.co/auth/v1/admin/users/${USER_ID}`)
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE')
  })

  it('admin mutations throw when the auth admin API errors', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'nope' }, false, 500))
    const { adminDeleteUser } = await import('../../../api/_shared')
    await expect(adminDeleteUser(USER_ID)).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Run the tests — they must fail**

Run: `npx vitest run src/lib/__tests__/admin-shared.test.ts`
Expected: FAIL — `isAdminUser` etc. are not exported from `api/_shared`.

- [ ] **Step 3: Implement the helpers**

Append to `api/_shared.ts` (after the Netlify section, end of file):

```ts
// ---------------------------------------------------------------------------
// Admin operations (service role)
//
// Used by api/admin.ts and the matching vite dev shim. The service role key
// must never reach the client; these helpers run only server-side. The
// caller's admin status is always re-checked here via the database — the
// client is never trusted.
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isValidUserId(id: string): boolean {
  return UUID_RE.test(id)
}

function serviceRoleKey(): string | null {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || null
}

export function hasServiceRoleKey(): boolean {
  return Boolean(serviceRoleKey())
}

function serviceHeaders(key: string): Record<string, string> {
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
}

/** True only when the given user's profile row has is_admin = true. */
export async function isAdminUser(userId: string): Promise<boolean> {
  const env = supabaseEnv()
  const key = serviceRoleKey()
  if (!env || !key || !isValidUserId(userId)) return false
  try {
    const res = await fetch(
      `${env.url}/rest/v1/profiles?id=eq.${userId}&select=is_admin&limit=1`,
      { headers: { ...serviceHeaders(key), Accept: 'application/json' } },
    )
    if (!res.ok) return false
    const rows = (await res.json()) as Array<{ is_admin?: boolean }>
    return Boolean(rows?.[0]?.is_admin)
  } catch {
    return false
  }
}

/** Ban or unban a user at the auth level and mirror the flag on profiles. */
export async function adminSetUserSuspended(userId: string, suspended: boolean): Promise<void> {
  const env = supabaseEnv()
  const key = serviceRoleKey()
  if (!env || !key) throw new Error('Service role not configured')
  if (!isValidUserId(userId)) throw new Error('Invalid user id')

  const res = await fetch(`${env.url}/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    headers: serviceHeaders(key),
    // "none" lifts the ban; 876000h ≈ 100 years.
    body: JSON.stringify({ ban_duration: suspended ? '876000h' : 'none' }),
  })
  if (!res.ok) throw new Error(`Auth admin error ${res.status}`)

  const mirror = await fetch(`${env.url}/rest/v1/profiles?id=eq.${userId}`, {
    method: 'PATCH',
    headers: { ...serviceHeaders(key), Prefer: 'return=minimal' },
    body: JSON.stringify({ suspended }),
  })
  if (!mirror.ok) throw new Error(`Profile update error ${mirror.status}`)
}

/** Permanently delete a user. The profiles row cascades via its FK. */
export async function adminDeleteUser(userId: string): Promise<void> {
  const env = supabaseEnv()
  const key = serviceRoleKey()
  if (!env || !key) throw new Error('Service role not configured')
  if (!isValidUserId(userId)) throw new Error('Invalid user id')

  const res = await fetch(`${env.url}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: serviceHeaders(key),
  })
  if (!res.ok) throw new Error(`Auth admin error ${res.status}`)
}
```

- [ ] **Step 4: Run the tests — they must pass**

Run: `npx vitest run src/lib/__tests__/admin-shared.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add api/_shared.ts src/lib/__tests__/admin-shared.test.ts
git commit -m "feat(api): service-role admin helpers (isAdminUser, suspend, delete)"
```

---

### Task 3: `api/admin.ts` Vercel function (TDD)

**Files:**
- Create: `api/admin.ts`
- Test: `src/lib/__tests__/admin-api.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/admin-api.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

const ADMIN_ID = '11111111-1111-4111-8111-111111111111'
const TARGET_ID = '22222222-2222-4222-8222-222222222222'

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) }
}

interface FakeRes {
  statusCode: number
  body: unknown
  status: (code: number) => FakeRes
  json: (body: unknown) => void
}

function makeRes(): FakeRes {
  const res: FakeRes = {
    statusCode: 0,
    body: undefined,
    status(code: number) { res.statusCode = code; return res },
    json(body: unknown) { res.body = body },
  }
  return res
}

function makeReq(body: unknown, method = 'POST') {
  return { method, headers: { authorization: 'Bearer caller-token' }, body }
}

/** fetch stub: caller-token resolves to ADMIN_ID; admin check configurable. */
function stubFetch({ callerIsAdmin }: { callerIsAdmin: boolean }) {
  fetchMock.mockImplementation(async (url: unknown) => {
    const u = String(url)
    if (u.includes('/auth/v1/user')) return jsonResponse({ id: ADMIN_ID, email: 'admin@test.dev' })
    if (u.includes(`/rest/v1/profiles?id=eq.${ADMIN_ID}`)) return jsonResponse([{ is_admin: callerIsAdmin }])
    if (u.includes('/auth/v1/admin/users/')) return jsonResponse({})
    if (u.includes('/rest/v1/profiles?id=eq.')) return jsonResponse([])
    return jsonResponse({ error: 'unexpected' }, false, 404)
  })
}

describe('api/admin handler', () => {
  beforeEach(() => {
    vi.resetModules()
    fetchMock.mockReset()
    process.env.SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_ANON_KEY = 'anon-key'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
  })

  it('rejects non-POST', async () => {
    const { default: handler } = await import('../../../api/admin')
    const res = makeRes()
    await handler(makeReq({}, 'GET'), res)
    expect(res.statusCode).toBe(405)
  })

  it('rejects missing/invalid auth', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, false, 401))
    const { default: handler } = await import('../../../api/admin')
    const res = makeRes()
    await handler({ method: 'POST', headers: {}, body: { action: 'delete-user', userId: TARGET_ID } }, res)
    expect(res.statusCode).toBe(401)
  })

  it('rejects callers who are not admins', async () => {
    stubFetch({ callerIsAdmin: false })
    const { default: handler } = await import('../../../api/admin')
    const res = makeRes()
    await handler(makeReq({ action: 'delete-user', userId: TARGET_ID }), res)
    expect(res.statusCode).toBe(403)
  })

  it('rejects unknown actions and bad user ids', async () => {
    stubFetch({ callerIsAdmin: true })
    const { default: handler } = await import('../../../api/admin')

    const res1 = makeRes()
    await handler(makeReq({ action: 'nuke-everything', userId: TARGET_ID }), res1)
    expect(res1.statusCode).toBe(400)

    const res2 = makeRes()
    await handler(makeReq({ action: 'delete-user', userId: 'not-a-uuid' }), res2)
    expect(res2.statusCode).toBe(400)
  })

  it('rejects acting on yourself', async () => {
    stubFetch({ callerIsAdmin: true })
    const { default: handler } = await import('../../../api/admin')
    const res = makeRes()
    await handler(makeReq({ action: 'delete-user', userId: ADMIN_ID }), res)
    expect(res.statusCode).toBe(400)
  })

  it('suspend-user bans the target via the auth admin API', async () => {
    stubFetch({ callerIsAdmin: true })
    const { default: handler } = await import('../../../api/admin')
    const res = makeRes()
    await handler(makeReq({ action: 'suspend-user', userId: TARGET_ID }), res)
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ ok: true })
    const adminCall = fetchMock.mock.calls.find(([u]) => String(u).includes(`/auth/v1/admin/users/${TARGET_ID}`))
    expect(adminCall).toBeDefined()
    expect(adminCall![1].method).toBe('PUT')
  })

  it('delete-user deletes the target via the auth admin API', async () => {
    stubFetch({ callerIsAdmin: true })
    const { default: handler } = await import('../../../api/admin')
    const res = makeRes()
    await handler(makeReq({ action: 'delete-user', userId: TARGET_ID }), res)
    expect(res.statusCode).toBe(200)
    const adminCall = fetchMock.mock.calls.find(
      ([u, init]) => String(u).includes(`/auth/v1/admin/users/${TARGET_ID}`) && init.method === 'DELETE',
    )
    expect(adminCall).toBeDefined()
  })

  it('returns 503 when the service role key is missing', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    stubFetch({ callerIsAdmin: true })
    const { default: handler } = await import('../../../api/admin')
    const res = makeRes()
    await handler(makeReq({ action: 'delete-user', userId: TARGET_ID }), res)
    expect(res.statusCode).toBe(503)
  })
})
```

- [ ] **Step 2: Run the tests — they must fail**

Run: `npx vitest run src/lib/__tests__/admin-api.test.ts`
Expected: FAIL — cannot resolve `../../../api/admin`.

- [ ] **Step 3: Implement the handler**

Create `api/admin.ts`:

```ts
import {
  verifyUser,
  rateLimit,
  isAdminUser,
  isValidUserId,
  hasServiceRoleKey,
  adminSetUserSuspended,
  adminDeleteUser,
} from './_shared.js'

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

const ACTIONS = ['suspend-user', 'unsuspend-user', 'delete-user'] as const
type AdminAction = (typeof ACTIONS)[number]

function parseBody(body: unknown): { action?: string; userId?: string } {
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

  if (!hasServiceRoleKey()) {
    res.status(503).json({ error: 'Admin operations not configured' })
    return
  }

  const user = await verifyUser(header(req, 'authorization'))
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  if (!(await rateLimit(`admin:${user.id}`, 30, 60_000))) {
    res.status(429).json({ error: 'Too many requests' })
    return
  }

  // Re-verify admin status server-side — never trust the client.
  if (!(await isAdminUser(user.id))) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }

  const { action, userId } = parseBody(req.body)
  if (!ACTIONS.includes(action as AdminAction) || typeof userId !== 'string' || !isValidUserId(userId)) {
    res.status(400).json({ error: 'Invalid request' })
    return
  }
  if (userId === user.id) {
    res.status(400).json({ error: 'You cannot perform this action on your own account' })
    return
  }

  try {
    if (action === 'suspend-user') await adminSetUserSuspended(userId, true)
    else if (action === 'unsuspend-user') await adminSetUserSuspended(userId, false)
    else await adminDeleteUser(userId)
    res.status(200).json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Admin action failed' })
  }
}
```

- [ ] **Step 4: Run the tests — they must pass**

Run: `npx vitest run src/lib/__tests__/admin-api.test.ts`
Expected: PASS (8 tests). Also run `npx vitest run src/lib/__tests__/admin-shared.test.ts` — still PASS.

- [ ] **Step 5: Commit**

```bash
git add api/admin.ts src/lib/__tests__/admin-api.test.ts
git commit -m "feat(api): /api/admin endpoint for suspend/unsuspend/delete user"
```

---

### Task 4: Vite dev shim + environment plumbing

**Files:**
- Modify: `vite.config.ts` (import block ~line 4-13, env mirroring ~line 38-41, new middleware after the `/api/provider-keys` shim ~line 89)
- Modify: `.env.example`

- [ ] **Step 1: Extend the `api/_shared` import in `vite.config.ts`**

Change the existing import to also pull the admin helpers:

```ts
import {
  verifyUser,
  rateLimit,
  runNetlifyDeploy,
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
} from './api/_shared'
```

- [ ] **Step 2: Mirror the service role env var**

After the line `if (env.KEY_ENCRYPTION_SECRET) process.env.KEY_ENCRYPTION_SECRET ||= env.KEY_ENCRYPTION_SECRET` add:

```ts
  if (env.SUPABASE_SERVICE_ROLE_KEY) process.env.SUPABASE_SERVICE_ROLE_KEY ||= env.SUPABASE_SERVICE_ROLE_KEY
```

- [ ] **Step 3: Add the `/api/admin` dev shim**

Inside `configureServer(server)`, after the `/api/provider-keys` middleware block, add (mirrors `api/admin.ts` exactly):

```ts
          server.middlewares.use('/api/admin', async (req, res) => {
            if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })
            if (!hasServiceRoleKey()) return sendJson(res, 503, { error: 'Admin operations not configured' })
            try {
              const user = await verifyUser(req.headers.authorization)
              if (!user) return sendJson(res, 401, { error: 'Unauthorized' })
              if (!(await rateLimit(`admin:${user.id}`, 30, 60_000))) return sendJson(res, 429, { error: 'Too many requests' })
              if (!(await isAdminUser(user.id))) return sendJson(res, 403, { error: 'Forbidden' })
              const body = await readJsonBody<{ action?: string; userId?: string }>(req)
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
```

- [ ] **Step 4: Document the new env var**

In `.env.example`, after the existing Supabase server vars, add:

```bash
# Server-only. Required for the /api/admin endpoint (suspend/delete users).
# Supabase dashboard -> Project Settings -> API -> service_role key.
SUPABASE_SERVICE_ROLE_KEY=
```

Also add `SUPABASE_SERVICE_ROLE_KEY` to your local `.env` and to Vercel project env vars (production + preview) — manual step, note it in the commit message body if not done yet.

- [ ] **Step 5: Typecheck and commit**

Run: `npm run build`
Expected: tsc + vite build succeed.

```bash
git add vite.config.ts .env.example
git commit -m "feat(dev): /api/admin dev shim and SUPABASE_SERVICE_ROLE_KEY plumbing"
```

---

### Task 5: Client admin library (`useIsAdmin` + API wrapper)

**Files:**
- Create: `src/lib/useIsAdmin.ts`
- Create: `src/lib/admin.ts`

- [ ] **Step 1: Create the `useIsAdmin` hook**

Create `src/lib/useIsAdmin.ts`:

```ts
import { useState, useEffect } from 'react'
import { useAuth } from './AuthContext'
import { supabase } from './supabase'

/**
 * Resolves whether the signed-in user is an admin (profiles.is_admin).
 * RLS lets every user read their own row, so this is safe to call anywhere.
 */
export function useIsAdmin(): { isAdmin: boolean; loading: boolean } {
  const { user, loading: authLoading } = useAuth()
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setIsAdmin(false)
      setLoading(false)
      return
    }
    let cancelled = false
    supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (!cancelled) {
          setIsAdmin(Boolean(data?.is_admin))
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [user, authLoading])

  return { isAdmin, loading: loading || authLoading }
}
```

- [ ] **Step 2: Create the admin API wrapper and types**

Create `src/lib/admin.ts`:

```ts
import { supabase } from './supabase'

export interface AdminUserRow {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  is_admin: boolean
  suspended: boolean
  publish_banned: boolean
  project_count: number
  post_count: number
}

export type AdminUserAction = 'suspend-user' | 'unsuspend-user' | 'delete-user'

/** All users with per-user counts. Server-side admin check via RPC. */
export async function adminListUsers(): Promise<AdminUserRow[]> {
  const { data, error } = await supabase.rpc('admin_list_users')
  if (error) throw new Error(error.message)
  return (data ?? []) as AdminUserRow[]
}

/** Calls the /api/admin endpoint for actions that need the service role. */
export async function adminUserAction(action: AdminUserAction, userId: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not signed in')
  const res = await fetch('/api/admin', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ action, userId }),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error || 'Admin action failed')
  }
}

/** Toggle a user's permission to publish to the community (direct, via admin RLS). */
export async function adminSetPublishBanned(userId: string, banned: boolean): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ publish_banned: banned })
    .eq('id', userId)
  if (error) throw new Error(error.message)
}
```

- [ ] **Step 3: Typecheck and commit**

Run: `npm run build`
Expected: success.

```bash
git add src/lib/useIsAdmin.ts src/lib/admin.ts
git commit -m "feat(admin): client admin library (useIsAdmin, admin actions)"
```

---

### Task 6: AdminGuard, AdminLayout, and routes

**Files:**
- Create: `src/components/AdminGuard/AdminGuard.tsx`
- Create: `src/pages/admin/AdminLayout.tsx`
- Create: `src/pages/admin/AdminLayout.module.css`
- Modify: `src/App.tsx` (lazy imports ~line 43, routes ~line 161)

- [ ] **Step 1: Create AdminGuard**

Create `src/components/AdminGuard/AdminGuard.tsx` (no CSS module needed — it renders nothing of its own):

```tsx
import { Navigate } from 'react-router-dom'
import { useIsAdmin } from '../../lib/useIsAdmin'

/**
 * Gate for /admin routes. Non-admins (including signed-out visitors) are
 * sent to the dashboard — the admin area is not advertised to them.
 */
export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading } = useIsAdmin()

  if (loading) return null
  if (!isAdmin) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}
```

- [ ] **Step 2: Create AdminLayout**

Create `src/pages/admin/AdminLayout.tsx`:

```tsx
import { NavLink, Outlet, Link } from 'react-router-dom'
import { usePageTitle } from '../../lib/usePageTitle'
import styles from './AdminLayout.module.css'

const NAV_ITEMS = [
  { to: '/admin', label: 'Moderation', end: true },
  { to: '/admin/users', label: 'Users', end: false },
]

export default function AdminLayout() {
  usePageTitle('Admin')

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link to="/dashboard" className={styles.logo}>
          <img src="/assets/logo.png" alt="OpenThorn" className={styles.logoImg} />
          <span className={styles.logoText}>Admin</span>
        </Link>
        <nav className={styles.nav}>
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => isActive ? `${styles.navItem} ${styles.navItemActive}` : styles.navItem}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <Link to="/dashboard" className={styles.backLink}>← Back to app</Link>
      </aside>
      <main className={styles.content}>
        <Outlet />
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Create the layout styles**

Create `src/pages/admin/AdminLayout.module.css`:

```css
.shell {
  display: flex;
  min-height: 100vh;
  background: var(--color-bg);
  color: var(--color-text);
}

.sidebar {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  width: 220px;
  flex-shrink: 0;
  padding: 1.5rem 1rem;
  border-right: 1px solid color-mix(in srgb, var(--color-text) 12%, transparent);
}

.logo {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  text-decoration: none;
  color: var(--color-text);
}

.logoImg {
  width: 28px;
  height: 28px;
}

.logoText {
  font-weight: 700;
  letter-spacing: 0.02em;
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.navItem {
  padding: 0.55rem 0.75rem;
  border-radius: 8px;
  text-decoration: none;
  color: var(--color-text);
  opacity: 0.75;
  font-size: 0.95rem;
}

.navItem:hover {
  opacity: 1;
  background: color-mix(in srgb, var(--color-text) 6%, transparent);
}

.navItemActive {
  opacity: 1;
  background: color-mix(in srgb, var(--color-accent) 16%, transparent);
  color: var(--color-accent);
  font-weight: 600;
}

.backLink {
  margin-top: auto;
  font-size: 0.85rem;
  color: var(--color-text);
  opacity: 0.6;
  text-decoration: none;
}

.backLink:hover {
  opacity: 1;
}

.content {
  flex: 1;
  min-width: 0;
  padding: 2rem;
}

@media (max-width: 720px) {
  .shell {
    flex-direction: column;
  }
  .sidebar {
    width: auto;
    flex-direction: row;
    align-items: center;
    border-right: none;
    border-bottom: 1px solid color-mix(in srgb, var(--color-text) 12%, transparent);
  }
  .nav {
    flex-direction: row;
  }
  .backLink {
    margin-top: 0;
    margin-left: auto;
  }
}
```

- [ ] **Step 4: Register the routes in `src/App.tsx`**

Add to the lazy-import block (after `const NotFoundPage = ...`):

```tsx
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'))
const AdminModerationPage = lazy(() => import('./pages/admin/AdminModerationPage'))
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage'))
```

Add an eager import next to the `ProtectedRoute` import:

```tsx
import AdminGuard from './components/AdminGuard/AdminGuard'
```

Add routes right before `<Route path="*" ...>`:

```tsx
            <Route path="/admin" element={<AdminGuard><AdminLayout /></AdminGuard>}>
              <Route index element={<AdminModerationPage />} />
              <Route path="users" element={<AdminUsersPage />} />
            </Route>
```

**Note:** `AdminModerationPage` and `AdminUsersPage` don't exist yet (Tasks 7-8). To keep this task compiling on its own, create both as minimal stubs now:

`src/pages/admin/AdminModerationPage.tsx`:
```tsx
export default function AdminModerationPage() {
  return <h1>Moderation</h1>
}
```

`src/pages/admin/AdminUsersPage.tsx`:
```tsx
export default function AdminUsersPage() {
  return <h1>Users</h1>
}
```

- [ ] **Step 5: Verify manually**

Run: `npm run dev`, sign in as the admin account, open `http://localhost:5173/admin`.
Expected: admin shell with Moderation/Users nav renders. In a private window (signed out or non-admin), `/admin` redirects to `/dashboard`.

- [ ] **Step 6: Commit**

```bash
git add src/components/AdminGuard src/pages/admin src/App.tsx
git commit -m "feat(admin): /admin route group with guard and layout"
```

---

### Task 7: Admin users page

**Files:**
- Modify: `src/pages/admin/AdminUsersPage.tsx` (replace the stub)
- Create: `src/pages/admin/AdminUsersPage.module.css`

- [ ] **Step 1: Implement the page**

Replace `src/pages/admin/AdminUsersPage.tsx` with:

```tsx
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../../lib/AuthContext'
import {
  adminListUsers,
  adminUserAction,
  adminSetPublishBanned,
  type AdminUserRow,
} from '../../lib/admin'
import styles from './AdminUsersPage.module.css'

export default function AdminUsersPage() {
  const { user } = useAuth()
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setUsers(await adminListUsers())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return users
    return users.filter(u =>
      u.email.toLowerCase().includes(q) || (u.full_name ?? '').toLowerCase().includes(q),
    )
  }, [users, query])

  const run = useCallback(async (id: string, fn: () => Promise<void>) => {
    setBusyId(id)
    setError(null)
    try {
      await fn()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setBusyId(null)
      setDeleteConfirmId(null)
    }
  }, [load])

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.heading}>Users</h1>
        <input
          className={styles.search}
          type="search"
          placeholder="Search by email or name…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </header>

      {error && <div className={styles.error} role="alert">{error}</div>}
      {loading && <p className={styles.muted}>Loading users…</p>}
      {!loading && filtered.length === 0 && <p className={styles.muted}>No users match.</p>}

      {!loading && filtered.length > 0 && (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>User</th>
              <th>Projects</th>
              <th>Posts</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => {
              const isSelf = u.id === user?.id
              const busy = busyId === u.id
              return (
                <tr key={u.id}>
                  <td>
                    <div className={styles.userCell}>
                      <span className={styles.userName}>{u.full_name || '—'}</span>
                      <span className={styles.userEmail}>{u.email}</span>
                    </div>
                  </td>
                  <td>{u.project_count}</td>
                  <td>{u.post_count}</td>
                  <td>
                    <div className={styles.badges}>
                      {u.is_admin && <span className={`${styles.badge} ${styles.badgeAdmin}`}>admin</span>}
                      {u.suspended && <span className={`${styles.badge} ${styles.badgeDanger}`}>suspended</span>}
                      {u.publish_banned && <span className={`${styles.badge} ${styles.badgeWarn}`}>publish ban</span>}
                    </div>
                  </td>
                  <td>
                    {isSelf ? (
                      <span className={styles.muted}>you</span>
                    ) : (
                      <div className={styles.actions}>
                        <button
                          type="button"
                          className={styles.btn}
                          disabled={busy}
                          onClick={() => run(u.id, () => adminSetPublishBanned(u.id, !u.publish_banned))}
                        >
                          {u.publish_banned ? 'Unban publish' : 'Ban publish'}
                        </button>
                        <button
                          type="button"
                          className={styles.btn}
                          disabled={busy}
                          onClick={() => run(u.id, () => adminUserAction(u.suspended ? 'unsuspend-user' : 'suspend-user', u.id))}
                        >
                          {u.suspended ? 'Unsuspend' : 'Suspend'}
                        </button>
                        {deleteConfirmId === u.id ? (
                          <>
                            <button
                              type="button"
                              className={`${styles.btn} ${styles.btnDanger}`}
                              disabled={busy}
                              onClick={() => run(u.id, () => adminUserAction('delete-user', u.id))}
                            >
                              Confirm delete
                            </button>
                            <button type="button" className={styles.btn} onClick={() => setDeleteConfirmId(null)}>
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className={`${styles.btn} ${styles.btnDanger}`}
                            disabled={busy}
                            onClick={() => setDeleteConfirmId(u.id)}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create the styles**

Create `src/pages/admin/AdminUsersPage.module.css`:

```css
.page {
  max-width: 1000px;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.25rem;
  flex-wrap: wrap;
}

.heading {
  font-size: 1.5rem;
  margin: 0;
}

.search {
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--color-text) 18%, transparent);
  background: transparent;
  color: var(--color-text);
  min-width: 260px;
}

.error {
  padding: 0.6rem 0.9rem;
  border-radius: 8px;
  background: color-mix(in srgb, #e0524f 15%, transparent);
  color: var(--color-text);
  margin-bottom: 1rem;
}

.muted {
  opacity: 0.6;
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.92rem;
}

.table th,
.table td {
  text-align: left;
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid color-mix(in srgb, var(--color-text) 10%, transparent);
  vertical-align: top;
}

.table th {
  font-weight: 600;
  opacity: 0.7;
}

.userCell {
  display: flex;
  flex-direction: column;
}

.userName {
  font-weight: 600;
}

.userEmail {
  opacity: 0.65;
  font-size: 0.85rem;
}

.badges {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.badge {
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  font-size: 0.75rem;
  background: color-mix(in srgb, var(--color-text) 10%, transparent);
}

.badgeAdmin {
  background: color-mix(in srgb, var(--color-accent) 20%, transparent);
  color: var(--color-accent);
}

.badgeDanger {
  background: color-mix(in srgb, #e0524f 20%, transparent);
}

.badgeWarn {
  background: color-mix(in srgb, #f7c048 25%, transparent);
}

.actions {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.btn {
  padding: 0.35rem 0.7rem;
  border-radius: 7px;
  border: 1px solid color-mix(in srgb, var(--color-text) 18%, transparent);
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  font-size: 0.85rem;
}

.btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--color-text) 8%, transparent);
}

.btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.btnDanger {
  border-color: color-mix(in srgb, #e0524f 50%, transparent);
  color: #e0524f;
}
```

- [ ] **Step 3: Verify manually**

Run: `npm run dev` (with `SUPABASE_SERVICE_ROLE_KEY` set in `.env`), open `/admin/users` as the admin.
Expected: user list with counts renders; publish-ban toggles instantly; suspend works (status badge appears); delete requires the confirm click. Suspending a test account then trying to sign in as it fails with a banned error.

- [ ] **Step 4: Commit**

```bash
git add src/pages/admin/AdminUsersPage.tsx src/pages/admin/AdminUsersPage.module.css
git commit -m "feat(admin): user management page (suspend, delete, publish ban)"
```

---

### Task 8: Admin moderation page

**Files:**
- Modify: `src/pages/admin/AdminModerationPage.tsx` (replace the stub)
- Create: `src/pages/admin/AdminModerationPage.module.css`

- [ ] **Step 1: Implement the page**

Replace `src/pages/admin/AdminModerationPage.tsx` with:

```tsx
import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { adminSetPublishBanned } from '../../lib/admin'
import styles from './AdminModerationPage.module.css'

interface ModerationPost {
  id: string
  user_id: string
  title: string
  description: string | null
  author_name: string
  likes_count: number
  published_at: string
  hidden: boolean
  featured: boolean
}

export default function AdminModerationPage() {
  const [posts, setPosts] = useState<ModerationPost[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('community_posts')
      .select('id, user_id, title, description, author_name, likes_count, published_at, hidden, featured')
      .order('featured', { ascending: false })
      .order('published_at', { ascending: false })
    if (err) {
      setError(err.message)
    } else {
      setPosts((data ?? []) as ModerationPost[])
      setError(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return posts
    return posts.filter(p =>
      p.title.toLowerCase().includes(q) || p.author_name.toLowerCase().includes(q),
    )
  }, [posts, query])

  const run = useCallback(async (id: string, fn: () => Promise<void>) => {
    setBusyId(id)
    setError(null)
    try {
      await fn()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setBusyId(null)
      setDeleteConfirmId(null)
    }
  }, [load])

  const setFlag = useCallback(async (id: string, patch: Partial<Pick<ModerationPost, 'hidden' | 'featured'>>) => {
    const { error: err } = await supabase.from('community_posts').update(patch).eq('id', id)
    if (err) throw new Error(err.message)
  }, [])

  const deletePost = useCallback(async (id: string) => {
    const { error: err } = await supabase.from('community_posts').delete().eq('id', id)
    if (err) throw new Error(err.message)
  }, [])

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.heading}>Community moderation</h1>
        <input
          className={styles.search}
          type="search"
          placeholder="Search by title or author…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </header>

      {error && <div className={styles.error} role="alert">{error}</div>}
      {loading && <p className={styles.muted}>Loading posts…</p>}
      {!loading && filtered.length === 0 && <p className={styles.muted}>No posts match.</p>}

      <div className={styles.list}>
        {filtered.map(post => {
          const busy = busyId === post.id
          return (
            <article key={post.id} className={`${styles.card} ${post.hidden ? styles.cardHidden : ''}`}>
              <div className={styles.cardMain}>
                <div className={styles.cardTitleRow}>
                  <h2 className={styles.cardTitle}>{post.title}</h2>
                  {post.featured && <span className={`${styles.badge} ${styles.badgeAccent}`}>featured</span>}
                  {post.hidden && <span className={`${styles.badge} ${styles.badgeDanger}`}>hidden</span>}
                </div>
                {post.description && <p className={styles.cardDesc}>{post.description}</p>}
                <p className={styles.cardMeta}>
                  by {post.author_name} · {post.likes_count} likes ·{' '}
                  {new Date(post.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.btn}
                  disabled={busy}
                  onClick={() => run(post.id, () => setFlag(post.id, { featured: !post.featured }))}
                >
                  {post.featured ? 'Unfeature' : 'Feature'}
                </button>
                <button
                  type="button"
                  className={styles.btn}
                  disabled={busy}
                  onClick={() => run(post.id, () => setFlag(post.id, { hidden: !post.hidden }))}
                >
                  {post.hidden ? 'Unhide' : 'Hide'}
                </button>
                <button
                  type="button"
                  className={styles.btn}
                  disabled={busy}
                  onClick={() => run(post.id, () => adminSetPublishBanned(post.user_id, true))}
                >
                  Ban author
                </button>
                {deleteConfirmId === post.id ? (
                  <>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnDanger}`}
                      disabled={busy}
                      onClick={() => run(post.id, () => deletePost(post.id))}
                    >
                      Confirm delete
                    </button>
                    <button type="button" className={styles.btn} onClick={() => setDeleteConfirmId(null)}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnDanger}`}
                    disabled={busy}
                    onClick={() => setDeleteConfirmId(post.id)}
                  >
                    Delete
                  </button>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create the styles**

Create `src/pages/admin/AdminModerationPage.module.css`:

```css
.page {
  max-width: 1000px;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.25rem;
  flex-wrap: wrap;
}

.heading {
  font-size: 1.5rem;
  margin: 0;
}

.search {
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--color-text) 18%, transparent);
  background: transparent;
  color: var(--color-text);
  min-width: 260px;
}

.error {
  padding: 0.6rem 0.9rem;
  border-radius: 8px;
  background: color-mix(in srgb, #e0524f 15%, transparent);
  color: var(--color-text);
  margin-bottom: 1rem;
}

.muted {
  opacity: 0.6;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.card {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border: 1px solid color-mix(in srgb, var(--color-text) 12%, transparent);
  border-radius: 12px;
  flex-wrap: wrap;
}

.cardHidden {
  opacity: 0.55;
}

.cardMain {
  min-width: 0;
  flex: 1;
}

.cardTitleRow {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.cardTitle {
  font-size: 1.05rem;
  margin: 0;
}

.cardDesc {
  margin: 0.35rem 0 0;
  opacity: 0.75;
  font-size: 0.9rem;
}

.cardMeta {
  margin: 0.4rem 0 0;
  font-size: 0.82rem;
  opacity: 0.55;
}

.badge {
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  font-size: 0.75rem;
  background: color-mix(in srgb, var(--color-text) 10%, transparent);
}

.badgeAccent {
  background: color-mix(in srgb, var(--color-accent) 20%, transparent);
  color: var(--color-accent);
}

.badgeDanger {
  background: color-mix(in srgb, #e0524f 20%, transparent);
}

.actions {
  display: flex;
  gap: 0.4rem;
  align-items: flex-start;
  flex-wrap: wrap;
}

.btn {
  padding: 0.35rem 0.7rem;
  border-radius: 7px;
  border: 1px solid color-mix(in srgb, var(--color-text) 18%, transparent);
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  font-size: 0.85rem;
}

.btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--color-text) 8%, transparent);
}

.btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.btnDanger {
  border-color: color-mix(in srgb, #e0524f 50%, transparent);
  color: #e0524f;
}
```

- [ ] **Step 3: Verify manually**

Run: `npm run dev`, open `/admin` as the admin.
Expected: all posts listed (featured first); Hide makes a post disappear from `/community` for a different (non-author) account but stay visible — dimmed — in the admin list; Feature moves it to the top; Delete requires confirm; Ban author then verify that account can no longer publish a project to the community.

- [ ] **Step 4: Commit**

```bash
git add src/pages/admin/AdminModerationPage.tsx src/pages/admin/AdminModerationPage.module.css
git commit -m "feat(admin): community moderation page (hide, feature, delete, ban author)"
```

---

### Task 9: Surface admin entry point + featured ordering in Community

**Files:**
- Modify: `src/components/DashboardSidebar/DashboardSidebar.tsx` (profile menu, near the Settings item ~line 358)
- Modify: `src/pages/CommunityPage.tsx` (interface ~line 11, query ~line 76, card badge)

- [ ] **Step 1: Add the Admin link to the profile menu**

In `src/components/DashboardSidebar/DashboardSidebar.tsx`:

Add the import:
```tsx
import { useIsAdmin } from '../../lib/useIsAdmin'
```

Inside the component, next to the other hooks:
```tsx
const { isAdmin } = useIsAdmin()
```

In the profile menu, directly after the Settings menu item (~line 358), add a new item. **Mirror the exact markup of the adjacent Settings item** (including its icon `<svg>`/`<span>` structure and `styles.profileMenuItem` class); the shape is:

```tsx
{isAdmin && (
  <button
    className={styles.profileMenuItem}
    onClick={() => { navigate('/admin'); setProfileMenuOpen(false) }}
    type="button"
  >
    Admin
  </button>
)}
```

- [ ] **Step 2: Featured posts first on the community page**

In `src/pages/CommunityPage.tsx`:

Extend the `CommunityPost` interface (line 11-22) with:
```ts
  hidden: boolean
  featured: boolean
```

Change the posts query (line 76-79) to order featured posts first:
```ts
    supabase
      .from('community_posts')
      .select('*')
      .order('featured', { ascending: false })
      .order('published_at', { ascending: false })
```

Note: the "recent"/"likes" client-side sort options must keep featured posts on top. Find the `sortBy` sorting logic in the same file (search for `sortBy`) and make `featured` the primary sort key, e.g. if the current comparator is `(a, b) => ...`, wrap it:
```ts
const byFeatured = (a: CommunityPost, b: CommunityPost) =>
  Number(b.featured) - Number(a.featured)
// then: byFeatured(a, b) || existingComparator(a, b)
```

Add a small "Featured" badge on cards where `post.featured` is true, using the existing card markup style (place next to the title; reuse an existing badge/pill class from `CommunityPage.module.css` if one exists, otherwise add `.featuredBadge` with the same pill pattern as the admin pages: accent color-mix background, 999px radius).

- [ ] **Step 3: Verify manually**

Run: `npm run dev`. As admin, feature a post in `/admin`; open `/community` and confirm it sorts first with a badge in both sort modes. Confirm hidden posts don't appear for a non-author account.

- [ ] **Step 4: Run lint and tests**

Run: `npm run lint && npm run test`
Expected: both pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/DashboardSidebar/DashboardSidebar.tsx src/pages/CommunityPage.tsx src/pages/CommunityPage.module.css
git commit -m "feat(community): featured post ordering and admin menu entry"
```

---

### Task 10: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Full test suite, lint, build**

Run: `npm run lint && npm run test && npm run build`
Expected: all pass, build succeeds (prerender included).

- [ ] **Step 2: Manual RLS verification (security gate — do not skip)**

With a **non-admin** test account, verify each of the following:

1. `/admin` redirects to `/dashboard`.
2. In the browser console on any page:
   ```js
   // self-escalation must fail with the trigger exception
   const { error } = await window.__supabase?.from?.('profiles')?.update({ is_admin: true })?.eq('id', '<non-admin-user-id>')
   ```
   If `window.__supabase` isn't exposed, run instead via the SQL editor impersonation or simply attempt the update through a temporary script using the anon key + the non-admin session token. Expected: error containing "changing privileged profile columns is not allowed".
3. `POST /api/admin` with the non-admin's token returns 403:
   ```bash
   curl -s -X POST http://localhost:5173/api/admin -H "Authorization: Bearer <non-admin-access-token>" -H "Content-Type: application/json" -d '{"action":"delete-user","userId":"00000000-0000-4000-8000-000000000000"}'
   ```
4. `admin_list_users` RPC returns zero rows for the non-admin.
5. A hidden post is invisible to the non-admin on `/community` (unless they authored it).
6. A publish-banned account gets an RLS error when publishing a project to the community.

- [ ] **Step 3: Production env**

Add `SUPABASE_SERVICE_ROLE_KEY` to Vercel project environment variables (Production + Preview). Without it, `/api/admin` returns 503 in prod.

- [ ] **Step 4: Push**

```bash
git push
```

---

## Self-review notes (already applied)

- Spec coverage: foundation (Task 1, 6), moderation (Task 1 §6-9, Task 8), users (Task 1 §10, Tasks 2-3, 7), admin API + dev shim (Tasks 3-4), featured surfacing + publish-ban enforcement (Tasks 1, 9). Phase 1 items all mapped.
- The spec's "suspend blocks login" is implemented via Supabase auth `ban_duration`; `profiles.suspended` is a mirrored display flag.
- Type consistency: `AdminUserRow`/`AdminUserAction` defined in Task 5 and consumed in Task 7; `isAdminUser`/`isValidUserId`/`hasServiceRoleKey`/`adminSetUserSuspended`/`adminDeleteUser` defined in Task 2, consumed in Tasks 3-4. `ModerationPost` is local to Task 8.
