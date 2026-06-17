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
const TYPES: ReadonlySet<string> = new Set([
  'text', 'integer', 'numeric', 'boolean', 'timestamptz', 'date', 'uuid', 'jsonb',
])
// Columns OpenThorn manages itself — the agent must not redefine them.
const RESERVED = new Set(['id', 'user_id', 'created_at'])

function ident(kind: 'table' | 'column', name: string): string {
  if (typeof name !== 'string' || !IDENT.test(name)) {
    throw new Error(
      `invalid ${kind} name: ${JSON.stringify(name)} (use lowercase letters, digits, underscores; must start with a letter or underscore)`,
    )
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

  const readClause = access === 'owner' ? `using (${own})` : 'using (true)'
  const readRole = access === 'owner' || access === 'authenticated' ? 'authenticated' : 'anon, authenticated'
  return [
    mk('sel', 'select', readRole, readClause),
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
      if (RESERVED.has(cname)) {
        throw new Error(`column name "${cname}" is reserved (id, user_id, created_at are added automatically)`)
      }
      if (!TYPES.has(col.type)) {
        throw new Error(`invalid column type for "${cname}": ${JSON.stringify(col.type)}`)
      }
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
  return name.replace(/(^|_)([a-z])/g, (_m, _sep, c: string) => c.toUpperCase())
}

export function schemaToTypes(spec: SchemaSpec): string {
  return (spec.tables ?? []).map((table) => {
    const fields = [
      '  id: string',
      '  user_id: string',
      '  created_at: string',
      ...(table.columns ?? []).map(
        (c) => `  ${c.name}${c.nullable === false ? '' : '?'}: ${TS_TYPE[c.type] ?? 'unknown'}`,
      ),
    ].join('\n')
    return `export interface ${pascal(table.name)} {\n${fields}\n}`
  }).join('\n\n')
}
