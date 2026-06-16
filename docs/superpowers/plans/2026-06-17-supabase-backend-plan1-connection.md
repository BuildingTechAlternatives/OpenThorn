# Supabase Backend — Plan 1: Connection Control Plane

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user click "Authorize Supabase", grant OAuth access to their Supabase org, pick a project, and have OpenThorn store a refreshable connection — the foundation every later backend feature consumes.

**Architecture:** A new server module `api/_supabase.ts` holds all Supabase-connection logic (OAuth state signing, code exchange, token refresh, Management API calls, connection persistence). A new `api/supabase-oauth.ts` Vercel function (plus a twin dev shim in `vite.config.ts`) drives the browser flow. Three new RLS-locked tables store the connection. A "Connect backend" UI panel sits beside the existing Providers UI.

**Tech Stack:** Vercel Functions, Supabase Management API + OAuth2, Postgres/RLS, Node `crypto` (HMAC state signing, reusing `KEY_ENCRYPTION_SECRET`), Vitest, React 19 + CSS Modules.

**Spec:** `docs/superpowers/specs/2026-06-17-supabase-backend-generation-design.md` (§3).

---

## File Structure

- **Create** `api/_supabase.ts` — connection helpers (pure, server-only, unit-tested).
- **Create** `api/supabase-oauth.ts` — Vercel function: `start` + `callback` + `pick-project` + `revoke`.
- **Create** `supabase/migrations/20260617000000_supabase_connections.sql` — 3 tables + RLS + client-safe view.
- **Create** `src/components/ConnectBackend/ConnectBackend.tsx` + `.module.css` — the UI panel.
- **Create** `src/lib/backend-connection.ts` — client helper that calls `/api/supabase-oauth` and reads connection status.
- **Create** `src/lib/__tests__/supabase-connection.test.ts` — unit tests for `api/_supabase.ts`.
- **Modify** `vite.config.ts` — add the `/api/supabase-oauth` dev shim.
- **Modify** `.env.example` and `CLAUDE.md` — document `SUPABASE_OAUTH_CLIENT_ID` / `SUPABASE_OAUTH_CLIENT_SECRET`.

**Constants (used across tasks — defined once in `api/_supabase.ts`):**
```ts
const SB_API = 'https://api.supabase.com'
const OAUTH_AUTHORIZE = `${SB_API}/v1/oauth/authorize`
const OAUTH_TOKEN = `${SB_API}/v1/oauth/token`
const STATE_TTL_MS = 10 * 60_000   // 10 min
const REFRESH_SKEW_MS = 60_000     // refresh 1 min before expiry
```

---

### Task 1: Database migration — connection tables

**Files:**
- Create: `supabase/migrations/20260617000000_supabase_connections.sql`

- [ ] **Step 1: Write the migration**

```sql
-- One Supabase OAuth grant per OpenThorn user (org-scoped, reusable across projects).
create table if not exists public.supabase_connections (
  user_id uuid primary key references auth.users (id) on delete cascade,
  org_id text not null,
  access_token_enc text not null,
  refresh_token_enc text not null,
  expires_at timestamptz not null,
  scopes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.supabase_connections enable row level security;

-- Owner may see that a connection exists + its non-secret metadata, but NEVER the
-- encrypted token columns. Client reads go through the view below; the base table is
-- written only by the server (service role bypasses RLS). No client SELECT policy on
-- the secret columns means a direct client select returns nothing.
create policy "own connection meta is readable"
  on public.supabase_connections for select
  using (auth.uid() = user_id);

-- Client-safe projection — excludes *_enc columns.
create or replace view public.supabase_connection_status as
  select user_id, org_id, scopes, expires_at, updated_at
  from public.supabase_connections;

-- Which Supabase project each OpenThorn project targets (all values here are public).
create table if not exists public.project_backends (
  project_id uuid primary key references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  project_ref text not null,
  supabase_url text not null,
  supabase_anon_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.project_backends enable row level security;
create policy "own project backends are readable"
  on public.project_backends for select
  using (auth.uid() = user_id);

-- Applied-migration ledger (mirrors _openthorn_migrations inside the user's DB).
create table if not exists public.project_migrations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  version bigint not null,
  name text not null,
  sql text not null,
  checksum text not null,
  applied_at timestamptz not null default now(),
  unique (project_id, version)
);
alter table public.project_migrations enable row level security;
create policy "own project migrations are readable"
  on public.project_migrations for select
  using (
    auth.uid() = (select user_id from public.project_backends b where b.project_id = project_migrations.project_id)
  );
```

- [ ] **Step 2: Apply locally / verify SQL parses**

Run: `supabase db push` (or paste into the Supabase SQL editor on a dev project).
Expected: no errors; three tables + one view exist; `\d public.supabase_connections` shows RLS enabled.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260617000000_supabase_connections.sql
git commit -m "feat(db): supabase connection, project_backends, project_migrations tables"
```

---

### Task 2: OAuth state signing (HMAC, no DB round-trip)

**Files:**
- Create: `api/_supabase.ts`
- Test: `src/lib/__tests__/supabase-connection.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) }
}

describe('oauth state', () => {
  beforeEach(() => {
    vi.resetModules()
    fetchMock.mockReset()
    process.env.KEY_ENCRYPTION_SECRET = 'test-secret-test-secret-test-secret-test'
  })

  it('mintOAuthState/verifyOAuthState round-trips for the same user', async () => {
    const { mintOAuthState, verifyOAuthState } = await import('../../../api/_supabase')
    const state = mintOAuthState('user-1', 'proj-9')
    expect(verifyOAuthState(state)).toEqual(
      expect.objectContaining({ userId: 'user-1', projectId: 'proj-9' }),
    )
  })

  it('verifyOAuthState rejects a tampered or expired state', async () => {
    const { mintOAuthState, verifyOAuthState } = await import('../../../api/_supabase')
    const state = mintOAuthState('user-1', 'proj-9')
    expect(verifyOAuthState(state + 'x')).toBeNull()
    expect(verifyOAuthState('garbage')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/supabase-connection.test.ts -t "oauth state"`
Expected: FAIL — cannot find module `../../../api/_supabase`.

- [ ] **Step 3: Implement state signing in `api/_supabase.ts`**

```ts
import { createHmac, timingSafeEqual, hkdfSync, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const SB_API = 'https://api.supabase.com'
const OAUTH_AUTHORIZE = `${SB_API}/v1/oauth/authorize`
const OAUTH_TOKEN = `${SB_API}/v1/oauth/token`
const STATE_TTL_MS = 10 * 60_000
const REFRESH_SKEW_MS = 60_000

function stateKey(): Buffer {
  const secret = process.env.KEY_ENCRYPTION_SECRET
  if (!secret) throw new Error('KEY_ENCRYPTION_SECRET is not configured')
  return Buffer.from(hkdfSync('sha256', secret, 'supabase-oauth', 'state-v1', 32))
}

export interface OAuthState {
  userId: string
  projectId: string
  ts: number
}

/** Sign a CSRF state token: base64url(payload).hmac — no DB needed. */
export function mintOAuthState(userId: string, projectId: string): string {
  const payload = JSON.stringify({ userId, projectId, ts: Date.now() } satisfies OAuthState)
  const b64 = Buffer.from(payload).toString('base64url')
  const sig = createHmac('sha256', stateKey()).update(b64).digest('base64url')
  return `${b64}.${sig}`
}

export function verifyOAuthState(state: string): OAuthState | null {
  const [b64, sig] = (state || '').split('.')
  if (!b64 || !sig) return null
  const expected = createHmac('sha256', stateKey()).update(b64).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const parsed = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8')) as OAuthState
    if (Date.now() - parsed.ts > STATE_TTL_MS) return null
    return parsed
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/supabase-connection.test.ts -t "oauth state"`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add api/_supabase.ts src/lib/__tests__/supabase-connection.test.ts
git commit -m "feat(backend): signed OAuth state tokens for Supabase connect flow"
```

---

### Task 3: OAuth code exchange + token refresh

**Files:**
- Modify: `api/_supabase.ts`
- Test: `src/lib/__tests__/supabase-connection.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
describe('oauth token exchange', () => {
  beforeEach(() => {
    vi.resetModules()
    fetchMock.mockReset()
    process.env.SUPABASE_OAUTH_CLIENT_ID = 'cid'
    process.env.SUPABASE_OAUTH_CLIENT_SECRET = 'csecret'
  })

  it('exchangeOAuthCode posts the authorization_code grant with basic auth', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ access_token: 'at', refresh_token: 'rt', expires_in: 86400 }),
    )
    const { exchangeOAuthCode } = await import('../../../api/_supabase')
    const tok = await exchangeOAuthCode('the-code', 'https://app/cb')
    expect(tok).toEqual({ accessToken: 'at', refreshToken: 'rt', expiresIn: 86400 })

    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toBe('https://api.supabase.com/v1/oauth/token')
    expect(init.headers.Authorization).toBe('Basic ' + Buffer.from('cid:csecret').toString('base64'))
    const body = new URLSearchParams(init.body as string)
    expect(body.get('grant_type')).toBe('authorization_code')
    expect(body.get('code')).toBe('the-code')
    expect(body.get('redirect_uri')).toBe('https://app/cb')
  })

  it('refreshOAuthToken posts the refresh_token grant', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ access_token: 'at2', refresh_token: 'rt2', expires_in: 86400 }),
    )
    const { refreshOAuthToken } = await import('../../../api/_supabase')
    const tok = await refreshOAuthToken('old-rt')
    expect(tok.accessToken).toBe('at2')
    const body = new URLSearchParams(fetchMock.mock.calls[0][1].body as string)
    expect(body.get('grant_type')).toBe('refresh_token')
    expect(body.get('refresh_token')).toBe('old-rt')
  })

  it('exchangeOAuthCode throws on a non-OK response', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'bad' }, false, 400))
    const { exchangeOAuthCode } = await import('../../../api/_supabase')
    await expect(exchangeOAuthCode('x', 'y')).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/supabase-connection.test.ts -t "oauth token exchange"`
Expected: FAIL — `exchangeOAuthCode` is not exported.

- [ ] **Step 3: Implement in `api/_supabase.ts`**

```ts
export interface OAuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

function oauthClient(): { id: string; secret: string } {
  const id = process.env.SUPABASE_OAUTH_CLIENT_ID
  const secret = process.env.SUPABASE_OAUTH_CLIENT_SECRET
  if (!id || !secret) throw new Error('Supabase OAuth client is not configured')
  return { id, secret }
}

export function hasOAuthClient(): boolean {
  return Boolean(process.env.SUPABASE_OAUTH_CLIENT_ID && process.env.SUPABASE_OAUTH_CLIENT_SECRET)
}

async function postToken(params: Record<string, string>): Promise<OAuthTokens> {
  const { id, secret } = oauthClient()
  const res = await fetch(OAUTH_TOKEN, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'),
    },
    body: new URLSearchParams(params).toString(),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Supabase OAuth token error ${res.status}: ${text.slice(0, 200)}`)
  const data = JSON.parse(text) as { access_token: string; refresh_token: string; expires_in: number }
  return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresIn: data.expires_in }
}

export function exchangeOAuthCode(code: string, redirectUri: string): Promise<OAuthTokens> {
  return postToken({ grant_type: 'authorization_code', code, redirect_uri: redirectUri })
}

export function refreshOAuthToken(refreshToken: string): Promise<OAuthTokens> {
  return postToken({ grant_type: 'refresh_token', refresh_token: refreshToken })
}

/** Build the authorize redirect URL the browser is sent to. */
export function buildAuthorizeUrl(redirectUri: string, state: string): string {
  const { id } = oauthClient()
  const q = new URLSearchParams({
    client_id: id,
    redirect_uri: redirectUri,
    response_type: 'code',
    state,
  })
  return `${OAUTH_AUTHORIZE}?${q.toString()}`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/supabase-connection.test.ts -t "oauth token exchange"`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add api/_supabase.ts src/lib/__tests__/supabase-connection.test.ts
git commit -m "feat(backend): Supabase OAuth code exchange + token refresh"
```

---

### Task 4: Connection persistence + valid-token resolution

Reuses `encryptForUser`/`decryptForUser` and the service-role Supabase helpers already in
`api/_shared.ts`. The connection row is written/read server-side with the service role (RLS
forbids the client from reading the `*_enc` columns).

**Files:**
- Modify: `api/_supabase.ts`
- Test: `src/lib/__tests__/supabase-connection.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
describe('connection persistence', () => {
  const USER = '11111111-1111-4111-8111-111111111111'
  beforeEach(() => {
    vi.resetModules()
    fetchMock.mockReset()
    process.env.KEY_ENCRYPTION_SECRET = 'test-secret-test-secret-test-secret-test'
    process.env.SUPABASE_OAUTH_CLIENT_ID = 'cid'
    process.env.SUPABASE_OAUTH_CLIENT_SECRET = 'csecret'
    process.env.SUPABASE_URL = 'https://openthorn.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
  })

  it('storeConnection upserts encrypted tokens via the service role', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}))
    const { storeConnection } = await import('../../../api/_supabase')
    await storeConnection(USER, {
      orgId: 'org_1',
      tokens: { accessToken: 'AT', refreshToken: 'RT', expiresIn: 86400 },
      scopes: 'all',
    })
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('/rest/v1/supabase_connections')
    expect(init.headers.Authorization).toBe('Bearer service-key')
    const row = JSON.parse(init.body as string)
    expect(row.user_id).toBe(USER)
    expect(row.org_id).toBe('org_1')
    // tokens are encrypted, not plaintext
    expect(row.access_token_enc).not.toContain('AT')
    expect(row.access_token_enc.startsWith('senc:')).toBe(true)
  })

  it('getValidAccessToken returns the stored token when not expired', async () => {
    const { encryptForUser } = await import('../../../api/_shared')
    const future = new Date(Date.now() + 3600_000).toISOString()
    fetchMock.mockResolvedValueOnce(jsonResponse([{
      org_id: 'org_1',
      access_token_enc: encryptForUser('AT', USER),
      refresh_token_enc: encryptForUser('RT', USER),
      expires_at: future,
    }]))
    const { getValidAccessToken } = await import('../../../api/_supabase')
    await expect(getValidAccessToken(USER)).resolves.toBe('AT')
  })

  it('getValidAccessToken refreshes + re-persists when expired', async () => {
    const { encryptForUser } = await import('../../../api/_shared')
    const past = new Date(Date.now() - 1000).toISOString()
    fetchMock
      .mockResolvedValueOnce(jsonResponse([{
        org_id: 'org_1',
        access_token_enc: encryptForUser('OLD', USER),
        refresh_token_enc: encryptForUser('RT', USER),
        expires_at: past,
      }]))                                                   // select
      .mockResolvedValueOnce(jsonResponse({ access_token: 'NEW', refresh_token: 'RT2', expires_in: 86400 })) // refresh
      .mockResolvedValueOnce(jsonResponse({}))               // re-persist
    const { getValidAccessToken } = await import('../../../api/_supabase')
    await expect(getValidAccessToken(USER)).resolves.toBe('NEW')
    expect(String(fetchMock.mock.calls[1][0])).toBe('https://api.supabase.com/v1/oauth/token')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/supabase-connection.test.ts -t "connection persistence"`
Expected: FAIL — `storeConnection` not exported.

- [ ] **Step 3: Implement in `api/_supabase.ts`**

```ts
import { encryptForUser, decryptForUser } from './_shared.js'

function ownEnv(): { url: string; serviceKey: string } {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('OpenThorn Supabase service role not configured')
  return { url, serviceKey }
}
function svcHeaders(key: string): Record<string, string> {
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
}

export interface StoredConnection {
  orgId: string
  tokens: OAuthTokens
  scopes?: string
}

export async function storeConnection(userId: string, conn: StoredConnection): Promise<void> {
  const { url, serviceKey } = ownEnv()
  const row = {
    user_id: userId,
    org_id: conn.orgId,
    access_token_enc: encryptForUser(conn.tokens.accessToken, userId),
    refresh_token_enc: encryptForUser(conn.tokens.refreshToken, userId),
    expires_at: new Date(Date.now() + conn.tokens.expiresIn * 1000).toISOString(),
    scopes: conn.scopes ?? null,
    updated_at: new Date().toISOString(),
  }
  const res = await fetch(`${url}/rest/v1/supabase_connections`, {
    method: 'POST',
    headers: { ...svcHeaders(serviceKey), Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(row),
  })
  if (!res.ok) throw new Error(`storeConnection failed ${res.status}`)
}

/** Returns a non-expired access token, refreshing + re-persisting if needed, or null if no connection. */
export async function getValidAccessToken(userId: string): Promise<string | null> {
  const { url, serviceKey } = ownEnv()
  const res = await fetch(
    `${url}/rest/v1/supabase_connections?user_id=eq.${userId}&select=org_id,access_token_enc,refresh_token_enc,expires_at&limit=1`,
    { headers: { ...svcHeaders(serviceKey), Accept: 'application/json' } },
  )
  if (!res.ok) return null
  const rows = (await res.json()) as Array<{ org_id: string; access_token_enc: string; refresh_token_enc: string; expires_at: string }>
  const row = rows?.[0]
  if (!row) return null

  const notExpired = new Date(row.expires_at).getTime() - REFRESH_SKEW_MS > Date.now()
  if (notExpired) return decryptForUser(row.access_token_enc, userId)

  const refreshed = await refreshOAuthToken(decryptForUser(row.refresh_token_enc, userId))
  await storeConnection(userId, { orgId: row.org_id, tokens: refreshed })
  return refreshed.accessToken
}

export async function deleteConnection(userId: string): Promise<void> {
  const { url, serviceKey } = ownEnv()
  await fetch(`${url}/rest/v1/supabase_connections?user_id=eq.${userId}`, {
    method: 'DELETE',
    headers: { ...svcHeaders(serviceKey), Prefer: 'return=minimal' },
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/supabase-connection.test.ts -t "connection persistence"`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add api/_supabase.ts src/lib/__tests__/supabase-connection.test.ts
git commit -m "feat(backend): persist + auto-refresh Supabase OAuth tokens"
```

---

### Task 5: Management API — list projects, fetch anon key, save project backend

**Files:**
- Modify: `api/_supabase.ts`
- Test: `src/lib/__tests__/supabase-connection.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
describe('management api', () => {
  beforeEach(() => {
    vi.resetModules(); fetchMock.mockReset()
    process.env.SUPABASE_URL = 'https://openthorn.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
  })

  it('listOrgProjects maps the Management API response', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([
      { id: 'ref1', name: 'App One', organization_id: 'org_1', region: 'us-east-1' },
    ]))
    const { listOrgProjects } = await import('../../../api/_supabase')
    const projects = await listOrgProjects('AT')
    expect(projects[0]).toEqual({ ref: 'ref1', name: 'App One', orgId: 'org_1', region: 'us-east-1' })
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer AT')
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://api.supabase.com/v1/projects')
  })

  it('getProjectConnectionInfo returns url + anon key', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([
      { name: 'anon', api_key: 'anon-xyz' },
      { name: 'service_role', api_key: 'secret-should-be-ignored' },
    ]))
    const { getProjectConnectionInfo } = await import('../../../api/_supabase')
    const info = await getProjectConnectionInfo('AT', 'ref1')
    expect(info).toEqual({ supabaseUrl: 'https://ref1.supabase.co', anonKey: 'anon-xyz' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/supabase-connection.test.ts -t "management api"`
Expected: FAIL — `listOrgProjects` not exported.

- [ ] **Step 3: Implement in `api/_supabase.ts`**

```ts
export interface SupabaseProject { ref: string; name: string; orgId: string; region: string }

async function mgmt<T>(accessToken: string, path: string): Promise<T> {
  const res = await fetch(`${SB_API}/v1${path}`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Supabase Management API ${res.status}: ${text.slice(0, 200)}`)
  return JSON.parse(text) as T
}

export async function listOrgProjects(accessToken: string): Promise<SupabaseProject[]> {
  const raw = await mgmt<Array<{ id: string; name: string; organization_id: string; region: string }>>(
    accessToken, '/projects',
  )
  return raw.map((p) => ({ ref: p.id, name: p.name, orgId: p.organization_id, region: p.region }))
}

export async function getProjectConnectionInfo(
  accessToken: string,
  ref: string,
): Promise<{ supabaseUrl: string; anonKey: string }> {
  const keys = await mgmt<Array<{ name: string; api_key: string }>>(accessToken, `/projects/${ref}/api-keys`)
  const anon = keys.find((k) => k.name === 'anon')
  if (!anon) throw new Error('No anon key returned for project')
  return { supabaseUrl: `https://${ref}.supabase.co`, anonKey: anon.api_key }
}

export async function saveProjectBackend(
  userId: string,
  projectId: string,
  ref: string,
  info: { supabaseUrl: string; anonKey: string },
): Promise<void> {
  const { url, serviceKey } = ownEnv()
  const res = await fetch(`${url}/rest/v1/project_backends`, {
    method: 'POST',
    headers: { ...svcHeaders(serviceKey), Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      project_id: projectId, user_id: userId, project_ref: ref,
      supabase_url: info.supabaseUrl, supabase_anon_key: info.anonKey,
      updated_at: new Date().toISOString(),
    }),
  })
  if (!res.ok) throw new Error(`saveProjectBackend failed ${res.status}`)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/supabase-connection.test.ts -t "management api"`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add api/_supabase.ts src/lib/__tests__/supabase-connection.test.ts
git commit -m "feat(backend): list org projects, fetch anon key, save project backend"
```

---

### Task 6: The `/api/supabase-oauth` Vercel function

Drives the browser flow via a `?action=` query param. `start` and `callback` are GET (browser
redirects); `pick-project` and `revoke` are POST (authenticated fetch from the UI).

**Files:**
- Create: `api/supabase-oauth.ts`

- [ ] **Step 1: Implement the handler**

```ts
import {
  hasOAuthClient, mintOAuthState, verifyOAuthState, buildAuthorizeUrl,
  exchangeOAuthCode, storeConnection, getValidAccessToken,
  listOrgProjects, getProjectConnectionInfo, saveProjectBackend, deleteConnection,
} from './_supabase.js'
import { verifyUser, rateLimit } from './_shared.js'

interface Req { method?: string; url?: string; headers: Record<string, string | string[] | undefined>; body?: unknown }
interface Res {
  status: (c: number) => Res
  json: (b: unknown) => void
  setHeader: (k: string, v: string) => void
  end: (s?: string) => void
}
function header(req: Req, n: string): string | undefined {
  const v = req.headers[n] ?? req.headers[n.toLowerCase()]
  return Array.isArray(v) ? v[0] : v
}
function redirectUri(req: Req): string {
  const proto = (header(req, 'x-forwarded-proto') || 'https').split(',')[0]
  const host = header(req, 'host')
  return `${proto}://${host}/api/supabase-oauth?action=callback`
}
function appBase(req: Req): string {
  const proto = (header(req, 'x-forwarded-proto') || 'https').split(',')[0]
  return `${proto}://${header(req, 'host')}`
}

export default async function handler(req: Req, res: Res): Promise<void> {
  if (!hasOAuthClient()) { res.status(503).json({ error: 'Supabase OAuth not configured' }); return }
  const url = new URL(req.url || '', 'http://localhost')
  const action = url.searchParams.get('action')

  // --- start: redirect the browser to Supabase's consent screen ---
  if (action === 'start' && req.method === 'GET') {
    const user = await verifyUser(header(req, 'authorization') || `Bearer ${url.searchParams.get('token') ?? ''}`)
    if (!user) { res.status(401).json({ error: 'Unauthorized' }); return }
    const projectId = url.searchParams.get('projectId') || ''
    const state = mintOAuthState(user.id, projectId)
    res.setHeader('Location', buildAuthorizeUrl(redirectUri(req), state))
    res.status(302).end()
    return
  }

  // --- callback: exchange code, store tokens, bounce back to the app ---
  if (action === 'callback' && req.method === 'GET') {
    const code = url.searchParams.get('code') || ''
    const parsed = verifyOAuthState(url.searchParams.get('state') || '')
    if (!code || !parsed) { res.status(400).json({ error: 'Invalid OAuth callback' }); return }
    try {
      const tokens = await exchangeOAuthCode(code, redirectUri(req))
      const projects = await listOrgProjects(tokens.accessToken)
      await storeConnection(parsed.userId, { orgId: projects[0]?.orgId ?? 'unknown', tokens })
      const back = `${appBase(req)}/app?backend=connected&projectId=${encodeURIComponent(parsed.projectId)}`
      res.setHeader('Location', back)
      res.status(302).end()
    } catch (err) {
      const back = `${appBase(req)}/app?backend=error&message=${encodeURIComponent(err instanceof Error ? err.message : 'failed')}`
      res.setHeader('Location', back); res.status(302).end()
    }
    return
  }

  // --- POST actions (authenticated fetch from the UI) ---
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }
  const user = await verifyUser(header(req, 'authorization'))
  if (!user) { res.status(401).json({ error: 'Unauthorized' }); return }
  if (!(await rateLimit(`sboauth:${user.id}`, 30, 60_000))) { res.status(429).json({ error: 'Too many requests' }); return }
  const body = (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}) as
    { action?: string; projectId?: string; ref?: string }

  try {
    if (body.action === 'list-projects') {
      const at = await getValidAccessToken(user.id)
      if (!at) { res.status(400).json({ error: 'No Supabase connection' }); return }
      res.status(200).json({ projects: await listOrgProjects(at) }); return
    }
    if (body.action === 'pick-project' && body.projectId && body.ref) {
      const at = await getValidAccessToken(user.id)
      if (!at) { res.status(400).json({ error: 'No Supabase connection' }); return }
      const info = await getProjectConnectionInfo(at, body.ref)
      await saveProjectBackend(user.id, body.projectId, body.ref, info)
      res.status(200).json({ ok: true, supabaseUrl: info.supabaseUrl }); return
    }
    if (body.action === 'revoke') {
      await deleteConnection(user.id)
      res.status(200).json({ ok: true }); return
    }
    res.status(400).json({ error: 'Unknown action' })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'OAuth action failed' })
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: no errors in `api/supabase-oauth.ts`.

- [ ] **Step 3: Commit**

```bash
git add api/supabase-oauth.ts
git commit -m "feat(backend): /api/supabase-oauth start/callback/pick-project/revoke"
```

---

### Task 7: Dev shim in `vite.config.ts`

Mirror the production function so `vite dev` behaves identically (per CLAUDE.md "dual implementation" rule).

**Files:**
- Modify: `vite.config.ts` (add an import + a new `server.middlewares.use('/api/supabase-oauth', …)` block beside the existing ones near line 100)

- [ ] **Step 1: Add the shim**

At the top, extend the existing `import { … } from './api/_shared'` and add a new import:
```ts
import {
  hasOAuthClient, mintOAuthState, verifyOAuthState, buildAuthorizeUrl, exchangeOAuthCode,
  storeConnection, getValidAccessToken, listOrgProjects, getProjectConnectionInfo,
  saveProjectBackend, deleteConnection,
} from './api/_supabase'
```

Then register the middleware (handles GET start/callback + POST actions; same logic as Task 6,
using the existing `sendJson`/`readJsonBody` helpers):
```ts
server.middlewares.use('/api/supabase-oauth', async (req, res) => {
  if (!hasOAuthClient()) return sendJson(res, 503, { error: 'Supabase OAuth not configured' })
  const u = new URL(req.url || '', 'http://localhost')
  const action = u.searchParams.get('action')
  const proto = 'http'; const host = req.headers.host
  const redirect = `${proto}://${host}/api/supabase-oauth?action=callback`
  const appBase = `${proto}://${host}`

  if (action === 'start' && req.method === 'GET') {
    const user = await verifyUser(req.headers.authorization || `Bearer ${u.searchParams.get('token') ?? ''}`)
    if (!user) return sendJson(res, 401, { error: 'Unauthorized' })
    const state = mintOAuthState(user.id, u.searchParams.get('projectId') || '')
    res.statusCode = 302; res.setHeader('Location', buildAuthorizeUrl(redirect, state)); return res.end()
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
      res.setHeader('Location', `${appBase}/app?backend=connected&projectId=${encodeURIComponent(parsed.projectId)}`)
      return res.end()
    } catch (err) {
      res.statusCode = 302
      res.setHeader('Location', `${appBase}/app?backend=error&message=${encodeURIComponent(err instanceof Error ? err.message : 'failed')}`)
      return res.end()
    }
  }
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })
  const user = await verifyUser(req.headers.authorization)
  if (!user) return sendJson(res, 401, { error: 'Unauthorized' })
  if (!(await rateLimit(`sboauth:${user.id}`, 30, 60_000))) return sendJson(res, 429, { error: 'Too many requests' })
  const body = await readJsonBody<{ action?: string; projectId?: string; ref?: string }>(req)
  try {
    if (body.action === 'list-projects') {
      const at = await getValidAccessToken(user.id)
      if (!at) return sendJson(res, 400, { error: 'No Supabase connection' })
      return sendJson(res, 200, { projects: await listOrgProjects(at) })
    }
    if (body.action === 'pick-project' && body.projectId && body.ref) {
      const at = await getValidAccessToken(user.id)
      if (!at) return sendJson(res, 400, { error: 'No Supabase connection' })
      const info = await getProjectConnectionInfo(at, body.ref)
      await saveProjectBackend(user.id, body.projectId, body.ref, info)
      return sendJson(res, 200, { ok: true, supabaseUrl: info.supabaseUrl })
    }
    if (body.action === 'revoke') { await deleteConnection(user.id); return sendJson(res, 200, { ok: true }) }
    sendJson(res, 400, { error: 'Unknown action' })
  } catch (err) {
    sendJson(res, 500, { error: err instanceof Error ? err.message : 'OAuth action failed' })
  }
})
```

- [ ] **Step 2: Verify dev server boots**

Run: `npm run dev` then in another shell: `curl -s -o /dev/null -w "%{http_code}" "http://localhost:5173/api/supabase-oauth?action=start"`
Expected: `401` (no auth) — proves the route is registered, not 404.

- [ ] **Step 3: Commit**

```bash
git add vite.config.ts
git commit -m "feat(backend): dev shim for /api/supabase-oauth"
```

---

### Task 8: Client helper `src/lib/backend-connection.ts`

**Files:**
- Create: `src/lib/backend-connection.ts`
- Test: `src/lib/__tests__/supabase-connection.test.ts` (add a `backend-connection client` block)

- [ ] **Step 1: Write the failing test**

```ts
describe('backend-connection client', () => {
  beforeEach(() => { vi.resetModules(); fetchMock.mockReset() })

  it('pickProject POSTs the chosen ref with the auth token', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, supabaseUrl: 'https://ref1.supabase.co' }))
    const { pickProject } = await import('../backend-connection')
    const out = await pickProject('tok', 'proj-9', 'ref1')
    expect(out.supabaseUrl).toBe('https://ref1.supabase.co')
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toBe('/api/supabase-oauth')
    expect(init.headers.Authorization).toBe('Bearer tok')
    expect(JSON.parse(init.body)).toEqual({ action: 'pick-project', projectId: 'proj-9', ref: 'ref1' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/supabase-connection.test.ts -t "backend-connection client"`
Expected: FAIL — cannot find module `../backend-connection`.

- [ ] **Step 3: Implement `src/lib/backend-connection.ts`**

```ts
export interface RemoteProject { ref: string; name: string; orgId: string; region: string }

async function post<T>(token: string, body: unknown): Promise<T> {
  const res = await fetch('/api/supabase-oauth', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Request failed ${res.status}`)
  return res.json() as Promise<T>
}

/** URL the "Authorize Supabase" button navigates to (full-page redirect). */
export function authorizeUrl(token: string, projectId: string): string {
  const q = new URLSearchParams({ action: 'start', token, projectId })
  return `/api/supabase-oauth?${q.toString()}`
}

export function listProjects(token: string): Promise<{ projects: RemoteProject[] }> {
  return post(token, { action: 'list-projects' })
}
export function pickProject(token: string, projectId: string, ref: string): Promise<{ ok: boolean; supabaseUrl: string }> {
  return post(token, { action: 'pick-project', projectId, ref })
}
export function revokeBackend(token: string): Promise<{ ok: boolean }> {
  return post(token, { action: 'revoke' })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/supabase-connection.test.ts -t "backend-connection client"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/backend-connection.ts src/lib/__tests__/supabase-connection.test.ts
git commit -m "feat(backend): client helper for the connect-backend flow"
```

---

### Task 9: "Connect backend" UI panel

No unit test (UI) — verified manually. Follow the existing Providers panel's structure and the
design tokens in `src/index.css` (`--color-bg`, `--color-text`, `--color-accent`).

**Files:**
- Create: `src/components/ConnectBackend/ConnectBackend.tsx`
- Create: `src/components/ConnectBackend/ConnectBackend.module.css`
- Reference: read an existing panel (e.g. the Providers UI) first to match props/session access.

- [ ] **Step 1: Read the existing Providers panel to copy its session/token + styling conventions**

Run: open the providers page/component (search `provider-keys` usages) and note how it gets the
Supabase access token (session) and how it lays out cards.

- [ ] **Step 2: Implement the component**

```tsx
import { useEffect, useState } from 'react'
import { authorizeUrl, listProjects, pickProject, revokeBackend, type RemoteProject } from '../../lib/backend-connection'
import styles from './ConnectBackend.module.css'

interface Props {
  /** Current OpenThorn project id. */
  projectId: string
  /** Supabase access token for the signed-in OpenThorn user (from the session). */
  token: string
  /** True once a project_backends row exists for this project. */
  connected: boolean
  onChange?: () => void
}

export function ConnectBackend({ projectId, token, connected, onChange }: Props) {
  const [projects, setProjects] = useState<RemoteProject[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // After the OAuth redirect bounces back (?backend=connected) we can list projects.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('backend') === 'connected' && params.get('projectId') === projectId) {
      setBusy(true)
      listProjects(token)
        .then((r) => setProjects(r.projects))
        .catch((e) => setError(e.message))
        .finally(() => setBusy(false))
    }
    if (params.get('backend') === 'error') setError(params.get('message') || 'Authorization failed')
  }, [projectId, token])

  async function choose(ref: string) {
    setBusy(true); setError(null)
    try { await pickProject(token, projectId, ref); onChange?.() }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed') }
    finally { setBusy(false) }
  }

  if (connected) {
    return (
      <div className={styles.panel}>
        <p className={styles.connected}>Backend connected ✓</p>
        <button className={styles.secondary} disabled={busy}
          onClick={async () => { setBusy(true); await revokeBackend(token); onChange?.(); setBusy(false) }}>
          Disconnect
        </button>
      </div>
    )
  }

  return (
    <div className={styles.panel}>
      <h3 className={styles.title}>Add a backend</h3>
      <p className={styles.desc}>Connect your Supabase project to add a database, auth, and saved data to this app.</p>
      {error && <p className={styles.error}>{error}</p>}
      {!projects && (
        <a className={styles.primary} href={authorizeUrl(token, projectId)}>Authorize Supabase</a>
      )}
      {projects && (
        <ul className={styles.list}>
          {projects.map((p) => (
            <li key={p.ref}>
              <button className={styles.projectBtn} disabled={busy} onClick={() => choose(p.ref)}>
                {p.name} <span className={styles.ref}>{p.region}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Implement `ConnectBackend.module.css`** (use design tokens, mirror Providers panel spacing)

```css
.panel { display: flex; flex-direction: column; gap: 0.75rem; padding: 1rem; }
.title { margin: 0; color: var(--color-text); }
.desc { margin: 0; color: var(--color-text); opacity: 0.7; font-size: 0.9rem; }
.primary { align-self: flex-start; background: var(--color-accent); color: #fff; padding: 0.6rem 1rem; border-radius: 8px; text-decoration: none; }
.secondary, .projectBtn { background: transparent; border: 1px solid var(--color-accent); color: var(--color-text); padding: 0.5rem 0.9rem; border-radius: 8px; cursor: pointer; }
.list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.ref { opacity: 0.6; font-size: 0.8rem; margin-left: 0.5rem; }
.connected { color: var(--color-accent); font-weight: 600; }
.error { color: #c0392b; font-size: 0.85rem; }
```

- [ ] **Step 4: Mount the panel** where the project's settings/providers live (e.g. the builder
  sidebar or settings drawer). Pass `projectId`, the session access token, and a `connected` flag
  derived from querying `project_backends` for this project (a `select` on the client-safe columns).

- [ ] **Step 5: Manual verification**

Run: `npm run dev`, open a project, click **Authorize Supabase**, complete consent on Supabase,
get bounced back, pick a project, confirm "Backend connected ✓". Then check the OpenThorn DB:
`project_backends` has a row; `supabase_connections` has encrypted `*_enc` values.

- [ ] **Step 6: Commit**

```bash
git add src/components/ConnectBackend/
git commit -m "feat(backend): Connect backend UI panel"
```

---

### Task 10: Env + docs

**Files:**
- Modify: `.env.example`
- Modify: `CLAUDE.md` (the Environment section)

- [ ] **Step 1: Add to `.env.example`**

```bash
# Supabase OAuth app (for "Authorize Supabase" backend connections).
# Register an OAuth app in your Supabase org settings; redirect URL = <app>/api/supabase-oauth?action=callback
SUPABASE_OAUTH_CLIENT_ID=
SUPABASE_OAUTH_CLIENT_SECRET=
```

- [ ] **Step 2: Update the `CLAUDE.md` Environment section** — add `SUPABASE_OAUTH_CLIENT_ID` and
  `SUPABASE_OAUTH_CLIENT_SECRET` to the Optional list, noting they enable BYO-Supabase backends and
  reuse `SUPABASE_SERVICE_ROLE_KEY` (already required by the admin panel) for connection storage.

- [ ] **Step 3: Full test + lint + typecheck**

Run: `npm run test && npm run lint && npx tsc -b --noEmit`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add .env.example CLAUDE.md
git commit -m "docs(backend): document Supabase OAuth env vars"
```

---

## Self-Review notes

- **Spec §3 coverage:** OAuth start/callback (Task 6/7), token storage+refresh (Task 4),
  org/project listing + anon-key fetch (Task 5), three RLS tables + client-safe view (Task 1),
  Connect-backend UI (Task 9), env setup (Task 10). ✓
- **Deferred to later plans (correctly out of scope here):** `set_schema` + `/api/migrate`
  (Plan 2); `supabase-js` injection, `openthorn:db`, auth UX, preview round-trip, preview test
  user (Plan 3). The `project_migrations` table is created here so Plan 2 has its ledger ready.
- **Type consistency:** `OAuthTokens {accessToken,refreshToken,expiresIn}`, `SupabaseProject/
  RemoteProject {ref,name,orgId,region}`, and `getProjectConnectionInfo → {supabaseUrl,anonKey}`
  are used identically across server, function, shim, and client.
- **Assumption to verify during Task 6:** the post-OAuth redirect target path (`/app?...`). Adjust
  to wherever the builder lives in `src/App.tsx` if it isn't `/app`.
```
