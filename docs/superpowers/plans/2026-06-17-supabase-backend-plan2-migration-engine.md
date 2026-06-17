# Supabase Backend — Plan 2: Migration Engine (`set_schema`)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the agent a `set_schema` tool that declares tables + columns + an RLS access level; OpenThorn compiles it to safe, idempotent SQL and applies it to the connected user's Supabase project via the Management API, tracking what's been applied.

**Architecture:** A pure spec→SQL compiler (`api/_schema.ts`) turns a declarative `SchemaSpec` into idempotent DDL with RLS always enabled. `api/_supabase.ts` gains an apply pipeline that runs SQL against the user's DB via the Management API `database/query` endpoint and records a migration ledger. A new `/api/migrate` endpoint (+ dev shim) drives it. The agent gets the `set_schema` tool, included only when the project has a backend connection; its handler posts to `/api/migrate`.

**Tech Stack:** Vercel Functions, Supabase Management API (`POST /v1/projects/{ref}/database/query`, requires the Database scope granted in Plan 1), Postgres DDL + RLS, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-17-supabase-backend-generation-design.md` (§4).

**Depends on:** Plan 1 (connection control plane) — `getValidAccessToken`, `project_backends`, `project_migrations`.

**Key safety decision (v1 scope):** the compiler emits ONLY additive/idempotent statements. It never drops tables/columns or narrows types. Removing a field from the spec leaves the existing column and its data in place. Explicit destructive changes are out of scope (a later plan, behind an approval gate). This makes every `set_schema` re-runnable and removes the need to diff against live columns.

---

## File Structure

- **Create** `api/_schema.ts` — `SchemaSpec`/`TableSpec`/`ColumnSpec` types, identifier validation, `compileSchema(spec) → { statements: string[]; checksum: string }`, and `schemaToTypes(spec) → string` (TS interfaces).
- **Modify** `api/_supabase.ts` — `runUserSql`, `ensureMigrationsTable`, `appliedChecksums`, `applySchema` (orchestration + ledger).
- **Create** `api/migrate.ts` — the `/api/migrate` Vercel function.
- **Modify** `vite.config.ts` — `/api/migrate` dev shim.
- **Modify** `src/lib/backend-connection.ts` — `applySchema` client helper + shared `SchemaSpec` type re-export.
- **Modify** `src/lib/agent-prompt.ts` — `set_schema` tool def, conditional inclusion via a `hasBackend` flag, `TOOL_CATEGORIES` entry, system-prompt note.
- **Modify** `src/lib/agent.ts` — `AgentRunInput.projectId`/`hasBackend`, `RunContext.backend`, `set_schema` dispatch in `executeTool`.
- **Modify** `src/pages/ProjectBuilderPage.tsx` — pass `projectId` + `hasBackend` into the agent run.
- **Test** `src/lib/__tests__/schema-compiler.test.ts`, extend `src/lib/__tests__/supabase-connection.test.ts`.

**Shared types (defined once in `api/_schema.ts`, imported everywhere):**
```ts
export type ColumnType = 'text' | 'integer' | 'numeric' | 'boolean' | 'timestamptz' | 'date' | 'uuid' | 'jsonb'
export interface ColumnSpec { name: string; type: ColumnType; nullable?: boolean; default?: string | number | boolean }
export type AccessLevel = 'owner' | 'public_read' | 'authenticated'
export interface TableSpec { name: string; columns: ColumnSpec[]; access: AccessLevel }
export interface SchemaSpec { tables: TableSpec[] }
```

---

### Task 1: Schema spec types + SQL compiler

**Files:**
- Create: `api/_schema.ts`
- Test: `src/lib/__tests__/schema-compiler.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { compileSchema, schemaToTypes, type SchemaSpec } from '../../../api/_schema'

const todos: SchemaSpec = {
  tables: [{
    name: 'todos',
    access: 'owner',
    columns: [
      { name: 'title', type: 'text', nullable: false },
      { name: 'done', type: 'boolean', default: false },
    ],
  }],
}

describe('compileSchema', () => {
  it('emits idempotent create table + standard columns + RLS', () => {
    const { statements } = compileSchema(todos)
    const sql = statements.join('\n')
    expect(sql).toContain('create table if not exists public."todos"')
    expect(sql).toContain('"id" uuid primary key default gen_random_uuid()')
    expect(sql).toContain('"user_id" uuid not null default auth.uid() references auth.users (id) on delete cascade')
    expect(sql).toContain('alter table public."todos" add column if not exists "title" text not null')
    expect(sql).toContain('alter table public."todos" add column if not exists "done" boolean default false')
    expect(sql).toContain('alter table public."todos" enable row level security')
    // owner policy
    expect(sql).toContain('using (auth.uid() = user_id)')
  })

  it('is deterministic — same spec yields same checksum', () => {
    expect(compileSchema(todos).checksum).toBe(compileSchema(todos).checksum)
  })

  it('rejects invalid identifiers (SQL-injection guard)', () => {
    expect(() => compileSchema({ tables: [{ name: 'a"; drop table x;--', access: 'owner', columns: [] }] }))
      .toThrow(/invalid table name/i)
    expect(() => compileSchema({ tables: [{ name: 'ok', access: 'owner', columns: [{ name: '1bad', type: 'text' }] }] }))
      .toThrow(/invalid column name/i)
  })

  it('public_read allows anon select but owner-only writes', () => {
    const sql = compileSchema({ tables: [{ name: 'posts', access: 'public_read', columns: [] }] }).statements.join('\n')
    expect(sql).toContain('for select')
    expect(sql).toContain('using (true)')
    expect(sql).toContain('for insert')
  })

  it('schemaToTypes emits a TS interface per table', () => {
    const types = schemaToTypes(todos)
    expect(types).toContain('export interface Todos')
    expect(types).toContain('title: string')
    expect(types).toContain('done: boolean')
    expect(types).toContain('id: string')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/schema-compiler.test.ts`
Expected: FAIL — cannot find module `../../../api/_schema`.

- [ ] **Step 3: Implement `api/_schema.ts`**

```ts
// Pure, dependency-free spec→SQL compiler for the set_schema tool. No DB access
// here — only string generation + validation. Identifiers are strictly validated
// because they are interpolated into SQL; everything emitted is idempotent and
// additive (never drops or narrows).
import { createHash } from 'node:crypto'

export type ColumnType = 'text' | 'integer' | 'numeric' | 'boolean' | 'timestamptz' | 'date' | 'uuid' | 'jsonb'
export interface ColumnSpec { name: string; type: ColumnType; nullable?: boolean; default?: string | number | boolean }
export type AccessLevel = 'owner' | 'public_read' | 'authenticated'
export interface TableSpec { name: string; columns: ColumnSpec[]; access: AccessLevel }
export interface SchemaSpec { tables: TableSpec[] }

const IDENT = /^[a-z_][a-z0-9_]*$/
const TYPES: ReadonlySet<string> = new Set(['text', 'integer', 'numeric', 'boolean', 'timestamptz', 'date', 'uuid', 'jsonb'])
// Columns OpenThorn manages itself — the agent must not redefine them.
const RESERVED = new Set(['id', 'user_id', 'created_at'])

function ident(kind: 'table' | 'column', name: string): string {
  if (typeof name !== 'string' || !IDENT.test(name)) {
    throw new Error(`invalid ${kind} name: ${JSON.stringify(name)} (use lowercase letters, digits, underscores; must start with a letter or underscore)`)
  }
  return name
}

function defaultSql(col: ColumnSpec): string {
  if (col.default === undefined) return ''
  if (typeof col.default === 'boolean' || typeof col.default === 'number') return ` default ${col.default}`
  // text/other: single-quote and escape embedded quotes
  return ` default '${String(col.default).replace(/'/g, "''")}'`
}

function policies(table: string, access: AccessLevel): string[] {
  const t = `public."${table}"`
  const own = `auth.uid() = user_id`
  const mk = (suffix: string, cmd: string, role: string, clause: string) =>
    `do $$ begin if not exists (select 1 from pg_policies where schemaname='public' and tablename='${table}' and policyname='${table}_${suffix}') then ` +
    `create policy "${table}_${suffix}" on ${t} for ${cmd} to ${role} ${clause}; end if; end $$;`

  if (access === 'public_read') {
    return [
      mk('sel', 'select', 'anon, authenticated', 'using (true)'),
      mk('ins', 'insert', 'authenticated', `with check (${own})`),
      mk('upd', 'update', 'authenticated', `using (${own}) with check (${own})`),
      mk('del', 'delete', 'authenticated', `using (${own})`),
    ]
  }
  if (access === 'authenticated') {
    return [
      mk('sel', 'select', 'authenticated', 'using (true)'),
      mk('ins', 'insert', 'authenticated', `with check (${own})`),
      mk('upd', 'update', 'authenticated', `using (${own}) with check (${own})`),
      mk('del', 'delete', 'authenticated', `using (${own})`),
    ]
  }
  // owner (default): fully private to the row owner
  return [
    mk('sel', 'select', 'authenticated', `using (${own})`),
    mk('ins', 'insert', 'authenticated', `with check (${own})`),
    mk('upd', 'update', 'authenticated', `using (${own}) with check (${own})`),
    mk('del', 'delete', 'authenticated', `using (${own})`),
  ]
}

export function compileSchema(spec: SchemaSpec): { statements: string[]; checksum: string } {
  const statements: string[] = []
  for (const table of spec.tables ?? []) {
    const name = ident('table', table.name)
    const access: AccessLevel = table.access ?? 'owner'
    const t = `public."${name}"`

    statements.push(
      `create table if not exists ${t} (` +
        `"id" uuid primary key default gen_random_uuid(), ` +
        `"user_id" uuid not null default auth.uid() references auth.users (id) on delete cascade, ` +
        `"created_at" timestamptz not null default now());`,
    )

    for (const col of table.columns ?? []) {
      const cname = ident('column', col.name)
      if (RESERVED.has(cname)) throw new Error(`column name "${cname}" is reserved (id, user_id, created_at are added automatically)`)
      if (!TYPES.has(col.type)) throw new Error(`invalid column type for "${cname}": ${JSON.stringify(col.type)}`)
      const nn = col.nullable === false ? ' not null' : ''
      statements.push(`alter table ${t} add column if not exists "${cname}" ${col.type}${nn}${defaultSql(col)};`)
    }

    statements.push(`alter table ${t} enable row level security;`)
    statements.push(...policies(name, access))
  }

  const checksum = createHash('sha256').update(statements.join('\n')).digest('hex').slice(0, 16)
  return { statements, checksum }
}

const TS_TYPE: Record<ColumnType, string> = {
  text: 'string', integer: 'number', numeric: 'number', boolean: 'boolean',
  timestamptz: 'string', date: 'string', uuid: 'string', jsonb: 'unknown',
}

function pascal(name: string): string {
  return name.replace(/(^|_)([a-z])/g, (_, __, c: string) => c.toUpperCase())
}

export function schemaToTypes(spec: SchemaSpec): string {
  return (spec.tables ?? []).map((table) => {
    const fields = [
      '  id: string',
      '  user_id: string',
      '  created_at: string',
      ...(table.columns ?? []).map((c) => `  ${c.name}${c.nullable === false ? '' : '?'}: ${TS_TYPE[c.type] ?? 'unknown'}`),
    ].join('\n')
    return `export interface ${pascal(table.name)} {\n${fields}\n}`
  }).join('\n\n')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/schema-compiler.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add api/_schema.ts src/lib/__tests__/schema-compiler.test.ts
git commit -m "feat(backend): declarative schema → idempotent SQL compiler"
```

---

### Task 2: Apply pipeline + migration ledger (`api/_supabase.ts`)

**Files:**
- Modify: `api/_supabase.ts`
- Test: `src/lib/__tests__/supabase-connection.test.ts`

- [ ] **Step 1: Write the failing test** (append a new describe block)

```ts
describe('schema apply', () => {
  const USER = '11111111-1111-4111-8111-111111111111'
  beforeEach(() => {
    vi.resetModules(); fetchMock.mockReset()
    process.env.KEY_ENCRYPTION_SECRET = 'test-secret-test-secret-test-secret-test'
    process.env.SUPABASE_OAUTH_CLIENT_ID = 'cid'
    process.env.SUPABASE_OAUTH_CLIENT_SECRET = 'csecret'
    process.env.SUPABASE_URL = 'https://openthorn.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
  })

  function connRow() {
    return { org_id: 'o', access_token_enc: '', refresh_token_enc: '', expires_at: new Date(Date.now() + 3600_000).toISOString() }
  }

  it('runUserSql posts to the Management API database/query endpoint', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([{ ok: 1 }]))
    const { runUserSql } = await import('../../../api/_supabase')
    await runUserSql('AT', 'ref1', 'select 1;')
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toBe('https://api.supabase.com/v1/projects/ref1/database/query')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer AT')
    expect(JSON.parse(init.body as string)).toEqual({ query: 'select 1;' })
  })

  it('applySchema runs DDL, records the ledger, and returns types', async () => {
    const { encryptForUser } = await import('../../../api/_shared')
    const conn = { ...connRow(), access_token_enc: encryptForUser('AT', USER), refresh_token_enc: encryptForUser('RT', USER) }
    const backend = [{ project_ref: 'ref1' }]
    fetchMock
      .mockResolvedValueOnce(jsonResponse([conn]))      // getValidAccessToken: connection select
      .mockResolvedValueOnce(jsonResponse(backend))     // project_backends select (project_ref)
      .mockResolvedValueOnce(jsonResponse([]))          // ensure _openthorn_migrations
      .mockResolvedValueOnce(jsonResponse([]))          // applied checksums (none yet)
      .mockResolvedValueOnce(jsonResponse([]))          // apply DDL batch
      .mockResolvedValueOnce(jsonResponse([]))          // insert into _openthorn_migrations
      .mockResolvedValueOnce(jsonResponse({}))          // insert into project_migrations (OpenThorn DB)
    const { applySchema } = await import('../../../api/_supabase')
    const out = await applySchema(USER, 'proj-9', {
      tables: [{ name: 'todos', access: 'owner', columns: [{ name: 'title', type: 'text' }] }],
    })
    expect(out.applied).toBe(true)
    expect(out.types).toContain('export interface Todos')
  })

  it('applySchema is a no-op when the checksum already applied', async () => {
    const { encryptForUser } = await import('../../../api/_shared')
    const conn = { ...connRow(), access_token_enc: encryptForUser('AT', USER), refresh_token_enc: encryptForUser('RT', USER) }
    const { compileSchema } = await import('../../../api/_schema')
    const spec = { tables: [{ name: 'todos', access: 'owner' as const, columns: [{ name: 'title', type: 'text' as const }] }] }
    const { checksum } = compileSchema(spec)
    fetchMock
      .mockResolvedValueOnce(jsonResponse([conn]))                  // getValidAccessToken
      .mockResolvedValueOnce(jsonResponse([{ project_ref: 'ref1' }])) // project_backends
      .mockResolvedValueOnce(jsonResponse([]))                      // ensure table
      .mockResolvedValueOnce(jsonResponse([{ checksum }]))          // applied checksums — already there
    const { applySchema } = await import('../../../api/_supabase')
    const out = await applySchema(USER, 'proj-9', spec)
    expect(out.applied).toBe(false)
    expect(out.alreadyApplied).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/supabase-connection.test.ts -t "schema apply"`
Expected: FAIL — `runUserSql` not exported.

- [ ] **Step 3: Implement in `api/_supabase.ts`** (add near the Management API section; import the compiler)

At the top of the file add:
```ts
import { compileSchema, schemaToTypes, type SchemaSpec } from './_schema.js'
```

Add a helper to read a project's ref (client-safe column, service role):
```ts
async function projectRef(userId: string, projectId: string): Promise<string | null> {
  const { url, serviceKey } = ownEnv()
  const res = await fetch(
    `${url}/rest/v1/project_backends?project_id=eq.${encodeURIComponent(projectId)}&user_id=eq.${encodeURIComponent(userId)}&select=project_ref&limit=1`,
    { headers: { ...svcHeaders(serviceKey), Accept: 'application/json' } },
  )
  if (!res.ok) return null
  const rows = (await res.json()) as Array<{ project_ref?: string }>
  return rows?.[0]?.project_ref ?? null
}
```

Run arbitrary SQL on the user's DB via the Management API:
```ts
export async function runUserSql<T = unknown>(accessToken: string, ref: string, query: string): Promise<T> {
  const res = await fetch(`${SB_API}/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Database query failed (${res.status}): ${text.slice(0, 300)}`)
  try { return JSON.parse(text) as T } catch { return [] as unknown as T }
}

const MIGRATIONS_DDL =
  `create table if not exists public._openthorn_migrations (` +
  `version bigserial primary key, name text not null, checksum text not null unique, ` +
  `applied_at timestamptz not null default now());`

export interface ApplySchemaResult {
  applied: boolean
  alreadyApplied: boolean
  statements: number
  checksum: string
  types: string
}

export async function applySchema(userId: string, projectId: string, spec: SchemaSpec): Promise<ApplySchemaResult> {
  const accessToken = await getValidAccessToken(userId)
  if (!accessToken) throw new Error('BACKEND_NOT_CONNECTED')
  const ref = await projectRef(userId, projectId)
  if (!ref) throw new Error('BACKEND_NOT_CONNECTED')

  const { statements, checksum } = compileSchema(spec)
  const types = schemaToTypes(spec)

  // Ensure the ledger table exists, then check whether this exact schema applied.
  await runUserSql(accessToken, ref, MIGRATIONS_DDL)
  const existing = await runUserSql<Array<{ checksum: string }>>(
    accessToken, ref,
    `select checksum from public._openthorn_migrations where checksum = '${checksum}' limit 1;`,
  )
  if (Array.isArray(existing) && existing.length > 0) {
    return { applied: false, alreadyApplied: true, statements: statements.length, checksum, types }
  }

  // Apply the DDL as one batch, then record it in both ledgers.
  await runUserSql(accessToken, ref, statements.join('\n'))
  const name = `schema_${new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)}`
  await runUserSql(
    accessToken, ref,
    `insert into public._openthorn_migrations (name, checksum) values ('${name}', '${checksum}');`,
  )

  // Mirror into OpenThorn's own ledger (best-effort; never blocks the apply).
  try {
    const { url, serviceKey } = ownEnv()
    await fetch(`${url}/rest/v1/project_migrations`, {
      method: 'POST',
      headers: { ...svcHeaders(serviceKey), Prefer: 'return=minimal' },
      body: JSON.stringify({
        project_id: projectId, version: Date.now(), name, sql: statements.join('\n'), checksum,
      }),
    })
  } catch { /* non-fatal */ }

  return { applied: true, alreadyApplied: false, statements: statements.length, checksum, types }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/supabase-connection.test.ts -t "schema apply"`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add api/_supabase.ts src/lib/__tests__/supabase-connection.test.ts
git commit -m "feat(backend): apply schema via Management API + migration ledger"
```

---

### Task 3: `/api/migrate` endpoint + dev shim

**Files:**
- Create: `api/migrate.ts`
- Modify: `vite.config.ts`

- [ ] **Step 1: Implement `api/migrate.ts`**

```ts
import { verifyUser, rateLimit } from './_shared.js'
import { applySchema } from './_supabase.js'
import type { SchemaSpec } from './_schema.js'

interface Req { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown }
interface Res { status: (c: number) => Res; json: (b: unknown) => void }
function header(req: Req, n: string): string | undefined {
  const v = req.headers[n] ?? req.headers[n.toLowerCase()]
  return Array.isArray(v) ? v[0] : v
}

export default async function handler(req: Req, res: Res): Promise<void> {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }
  const user = await verifyUser(header(req, 'authorization'))
  if (!user) { res.status(401).json({ error: 'Unauthorized' }); return }
  if (!(await rateLimit(`migrate:${user.id}`, 30, 60_000))) { res.status(429).json({ error: 'Too many requests' }); return }

  const body = (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}) as
    { projectId?: string; spec?: SchemaSpec }
  if (!body.projectId || !body.spec || !Array.isArray(body.spec.tables)) {
    res.status(400).json({ error: 'Missing projectId or spec' }); return
  }

  try {
    const result = await applySchema(user.id, body.projectId, body.spec)
    res.status(200).json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Migration failed'
    if (msg === 'BACKEND_NOT_CONNECTED') { res.status(400).json({ error: msg }); return }
    res.status(500).json({ error: msg })
  }
}
```

- [ ] **Step 2: Add the dev shim in `vite.config.ts`** (import `applySchema`, add a middleware mirroring the function)

Extend the `./api/_supabase` import to include `applySchema`, then register:
```ts
server.middlewares.use('/api/migrate', async (req, res) => {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })
  const user = await verifyUser(req.headers.authorization)
  if (!user) return sendJson(res, 401, { error: 'Unauthorized' })
  if (!(await rateLimit(`migrate:${user.id}`, 30, 60_000))) return sendJson(res, 429, { error: 'Too many requests' })
  const body = await readJsonBody<{ projectId?: string; spec?: import('./api/_schema').SchemaSpec }>(req)
  if (!body.projectId || !body.spec || !Array.isArray(body.spec.tables)) {
    return sendJson(res, 400, { error: 'Missing projectId or spec' })
  }
  try {
    return sendJson(res, 200, await applySchema(user.id, body.projectId, body.spec))
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Migration failed'
    return sendJson(res, msg === 'BACKEND_NOT_CONNECTED' ? 400 : 500, { error: msg })
  }
})
```

- [ ] **Step 3: Typecheck + boot check**

Run: `npx tsc -b` → EXIT 0. Then `npm run dev`, and `curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:5173/api/migrate` → `401` (route registered).

- [ ] **Step 4: Commit**

```bash
git add api/migrate.ts vite.config.ts
git commit -m "feat(backend): /api/migrate endpoint + dev shim"
```

---

### Task 4: Client helper

**Files:**
- Modify: `src/lib/backend-connection.ts`
- Test: `src/lib/__tests__/supabase-connection.test.ts`

- [ ] **Step 1: Write the failing test** (add to the `backend-connection client` block)

```ts
it('applySchema POSTs the spec to /api/migrate', async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse({ applied: true, alreadyApplied: false, statements: 3, checksum: 'abc', types: 'export interface Todos {}' }))
  const { applySchema } = await import('../backend-connection')
  const spec = { tables: [{ name: 'todos', access: 'owner' as const, columns: [] }] }
  const out = await applySchema('tok', 'proj-9', spec)
  expect(out.applied).toBe(true)
  const [url, init] = fetchMock.mock.calls[0]
  expect(String(url)).toBe('/api/migrate')
  expect(JSON.parse(init.body as string)).toEqual({ projectId: 'proj-9', spec })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/supabase-connection.test.ts -t "applySchema POSTs"`
Expected: FAIL — `applySchema` not exported.

- [ ] **Step 3: Implement** (add to `src/lib/backend-connection.ts`)

```ts
import type { SchemaSpec } from '../../api/_schema'
export type { SchemaSpec, TableSpec, ColumnSpec, AccessLevel } from '../../api/_schema'

export interface ApplySchemaResult {
  applied: boolean
  alreadyApplied: boolean
  statements: number
  checksum: string
  types: string
}

export function applySchema(token: string, projectId: string, spec: SchemaSpec): Promise<ApplySchemaResult> {
  return post(token, { projectId, spec }, '/api/migrate')
}
```

Update the private `post` helper to accept an optional path (default `/api/supabase-oauth`):
```ts
async function post<T>(token: string, body: unknown, path = '/api/supabase-oauth'): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error || `Request failed ${res.status}`)
  }
  return res.json() as Promise<T>
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/supabase-connection.test.ts -t "applySchema POSTs"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/backend-connection.ts src/lib/__tests__/supabase-connection.test.ts
git commit -m "feat(backend): applySchema client helper"
```

---

### Task 5: `set_schema` tool definition + conditional inclusion

**Files:**
- Modify: `src/lib/agent-prompt.ts`

- [ ] **Step 1: Add the tool to `AGENT_TOOLS`** (after `read_file`/near the write tools)

```ts
{
  name: 'set_schema',
  description:
    'Declare the database tables this app needs (only available when a Supabase ' +
    'backend is connected). Provide tables with columns and an access level; ' +
    'OpenThorn creates/updates them safely with row-level security enabled — you ' +
    'do NOT write SQL. id (uuid), user_id (the signed-in user), and created_at are ' +
    'added automatically to every table; do not declare them. access: "owner" = ' +
    'each row private to its creator (todos, notes); "public_read" = anyone can ' +
    'read, only the owner writes (blog posts); "authenticated" = any signed-in user ' +
    'can read, only the owner writes. Calling again is safe and additive — it never ' +
    'drops columns or data. After this, read/write data with the injected client ' +
    '(see the backend apps guidance).',
  input_schema: {
    type: 'object',
    properties: {
      tables: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'snake_case table name, e.g. "todos".' },
            access: { type: 'string', enum: ['owner', 'public_read', 'authenticated'], description: 'Row access policy.' },
            columns: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  type: { type: 'string', enum: ['text', 'integer', 'numeric', 'boolean', 'timestamptz', 'date', 'uuid', 'jsonb'] },
                  nullable: { type: 'boolean' },
                  default: { description: 'Optional default (string, number, or boolean).' },
                },
                required: ['name', 'type'],
                additionalProperties: false,
              },
            },
          },
          required: ['name', 'access', 'columns'],
          additionalProperties: false,
        },
      },
    },
    required: ['tables'],
    additionalProperties: false,
  },
},
```

- [ ] **Step 2: Add to `TOOL_CATEGORIES`**

```ts
set_schema: 'write',
```

- [ ] **Step 3: Conditional inclusion in `selectToolsForRun`**

Add `hasBackend?: boolean` to the params type, and after computing `tools` (both the expanded and core branches), append `set_schema` only when `hasBackend`:

```ts
export function selectToolsForRun(params: {
  mode: 'create' | 'refine'
  isNewProject: boolean
  prompt: string
  smallRefine?: boolean
  hasBackend?: boolean
}): { tools: ToolDefinition[]; expanded: boolean } {
  const withBackend = (tools: ToolDefinition[]): ToolDefinition[] =>
    params.hasBackend ? tools : tools.filter((t) => t.name !== 'set_schema')

  if (params.smallRefine) {
    const tools = AGENT_TOOLS.filter((t) => SMALL_REFINE_TOOL_NAMES.has(t.name))
    return { tools: withBackend(tools), expanded: false }
  }
  const expanded = params.mode === 'refine' || !params.isNewProject || EXPANSION_TRIGGER.test(params.prompt)
  if (expanded) return { tools: withBackend(AGENT_TOOLS), expanded: true }
  const tools = AGENT_TOOLS.filter((t) => CORE_TOOL_NAMES.has(t.name))
  return { tools: withBackend(tools), expanded: false }
}
```

Add `'set_schema'` to `CORE_TOOL_NAMES` and `SMALL_REFINE_TOOL_NAMES` (so the `withBackend` filter, not the core allowlist, decides). Since AGENT_TOOLS is filtered by these sets in the non-expanded/small paths, set_schema must be in those sets to survive the filter, then `withBackend` removes it when no backend.

- [ ] **Step 4: Add a system-prompt note** — in the system prompt builder, when `hasBackend`, include a short "Backend apps" section:

> A Supabase backend is connected. Use `set_schema` to declare tables (RLS is automatic; id/user_id/created_at are added for you). In the app, import the client: `import { db, auth } from 'openthorn:db'` (added in the next milestone) — until then, declare schema with set_schema and build the UI; data wiring lands next. Gate writes behind a signed-in user.

(If the system prompt is a static string, thread a `hasBackend` boolean into the builder and conditionally append this paragraph. Keep it out of the cached prefix only if it varies per run — append it in the same place other per-run flags go.)

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc -b` → EXIT 0.
```bash
git add src/lib/agent-prompt.ts
git commit -m "feat(agent): set_schema tool, gated on a connected backend"
```

---

### Task 6: Agent dispatch + run wiring (`src/lib/agent.ts`)

**Files:**
- Modify: `src/lib/agent.ts`

- [ ] **Step 1: Extend `AgentRunInput`**

```ts
  /** Current project id — required for backend (set_schema) operations. */
  projectId?: string
  /** True when this project has a connected Supabase backend. */
  hasBackend?: boolean
```

- [ ] **Step 2: Add `backend` to `RunContext`**

```ts
  /** Backend connection context for set_schema, when a backend is connected. */
  backend?: { projectId: string }
```

- [ ] **Step 3: Populate it at run start** (in the `runCtx` literal around line 1267)

```ts
    backend: input.hasBackend && input.projectId ? { projectId: input.projectId } : undefined,
```

- [ ] **Step 4: Pass `hasBackend` into `selectToolsForRun`** (find its call site near line 1147)

```ts
    hasBackend: Boolean(input.hasBackend && input.projectId),
```

- [ ] **Step 5: Add the dispatch case in `executeTool`** (in the switch, near `write_file`)

```ts
    // ── set_schema ──────────────────────────────────────────────
    case 'set_schema': {
      if (!runCtx?.backend?.projectId) {
        return { content: 'No Supabase backend is connected to this project. Ask the user to connect one via the Backend button, then retry.', isError: true }
      }
      const tables = Array.isArray(toolCall.input.tables) ? toolCall.input.tables : []
      if (tables.length === 0) {
        return { content: 'set_schema requires at least one table.', isError: true }
      }
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return { content: 'Not signed in — cannot apply schema.', isError: true }
        const { applySchema } = await import('./backend-connection')
        const result = await applySchema(session.access_token, runCtx.backend.projectId, { tables } as never)
        const head = result.alreadyApplied
          ? 'Schema already up to date (no changes applied).'
          : `Schema applied: ${result.statements} statement(s) run against your database.`
        return {
          content: `${head}\n\nGenerated TypeScript types for your tables:\n\n${result.types}\n\nQuery these tables from the app with the injected client once data wiring is available.`,
          isError: false,
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Migration failed'
        return { content: `Could not apply schema: ${msg}`, isError: true }
      }
    }
```

(Confirm `supabase` is imported in agent.ts — it is used elsewhere; if not, add `import { supabase } from './supabase'`.)

- [ ] **Step 6: Typecheck + commit**

Run: `npx tsc -b` → EXIT 0.
```bash
git add src/lib/agent.ts
git commit -m "feat(agent): dispatch set_schema to /api/migrate with project context"
```

---

### Task 7: Pass project context from the builder

**Files:**
- Modify: `src/pages/ProjectBuilderPage.tsx`

- [ ] **Step 1: Find the `runOpenThornAgent(...)` call** and add the two fields to its input object:

```ts
      projectId,
      hasBackend: backendConnected,
```

(`projectId` from `useParams`, `backendConnected` is the state added in Plan 1. If the agent is invoked from a helper that builds the input, thread these through.)

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc -b` → EXIT 0.
```bash
git add src/pages/ProjectBuilderPage.tsx
git commit -m "feat(agent): pass project id + backend flag into agent runs"
```

---

### Task 8: Full verification + manual smoke test

- [ ] **Step 1: Full automated suite**

Run: `npm run test && npm run lint && npx tsc -b`
Expected: all pass; new schema-compiler + apply tests green.

- [ ] **Step 2: Manual smoke test** (requires a connected backend)

Run `npm run dev` (restart — server + vite.config changed). In a project with a connected backend, prompt the agent: "add a table of todos with a title and a done flag". Confirm:
- The agent calls `set_schema` and reports "Schema applied".
- In Supabase (or via MCP `list_tables`), `public.todos` exists with RLS enabled, plus `_openthorn_migrations` has a row.
- Re-running the same prompt reports "already up to date".

- [ ] **Step 3: Commit any fixes, then finish**

Use the finishing-a-development-branch skill.

---

## Self-Review notes

- **Spec §4 coverage:** declarative spec (Task 1), forced RLS templates (Task 1 `policies`), idempotent compile (Task 1), apply via Management API + `_openthorn_migrations` ledger + `project_migrations` mirror (Task 2), `/api/migrate` (Task 3), `set_schema` tool gated on backend (Tasks 5–6), TS types returned to the agent (Tasks 1/2/6), structured `BACKEND_NOT_CONNECTED` error (Tasks 2/3/6). ✓
- **Deliberate v1 simplification vs spec:** the spec described a destructive-change guard with `pendingDestructive`. Because the compiler emits only additive/idempotent SQL, v1 has nothing destructive to guard — removing a field leaves the column intact. Explicit drops + the approval gate are deferred. This is a safe narrowing, documented here.
- **Type consistency:** `SchemaSpec`/`TableSpec`/`ColumnSpec`/`AccessLevel` defined once in `api/_schema.ts` and re-exported through `backend-connection.ts`; `ApplySchemaResult` shape matches between `api/_supabase.ts`, the endpoint, and the client.
- **Deferred to Plan 3:** `supabase-js` injection, `openthorn:db` virtual module, auth UX, preview round-trip. `set_schema` works without them (it only touches the DB); the agent guidance notes data-wiring lands next.
```
