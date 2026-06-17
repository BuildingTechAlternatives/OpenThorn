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

  it('rejects reserved column names', () => {
    expect(() => compileSchema({ tables: [{ name: 'ok', access: 'owner', columns: [{ name: 'user_id', type: 'uuid' }] }] }))
      .toThrow(/reserved/i)
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
    expect(types).toContain('done?: boolean')
    expect(types).toContain('id: string')
  })
})
