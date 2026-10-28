-- ============================================================
-- Admin panel Phase 4: templates table. Source of truth for the
-- template gallery; bundled src/lib/templates.ts is the fallback.
-- ============================================================

create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  template_key text unique not null,
  name text not null,
  description text not null default '',
  category text not null default 'SaaS',
  accent_color text not null default '#2563eb',
  highlights jsonb not null default '[]'::jsonb,
  files jsonb not null default '[]'::jsonb,
  featured boolean not null default false,
  sort_order int not null default 0,
  status text not null default 'draft' check (status in ('draft','published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.templates enable row level security;

-- Signed-in users may read published templates (the gallery is auth-gated).
drop policy if exists "templates_select_published" on public.templates;
create policy "templates_select_published" on public.templates
  for select to authenticated using (status = 'published');

-- Admins read everything (drafts included).
drop policy if exists "templates_select_admin" on public.templates;
create policy "templates_select_admin" on public.templates
  for select to authenticated using (public.is_admin());

-- Admins write.
drop policy if exists "templates_admin_insert" on public.templates;
create policy "templates_admin_insert" on public.templates
  for insert to authenticated with check (public.is_admin());

drop policy if exists "templates_admin_update" on public.templates;
create policy "templates_admin_update" on public.templates
  for update to authenticated using (public.is_admin());

drop policy if exists "templates_admin_delete" on public.templates;
create policy "templates_admin_delete" on public.templates
  for delete to authenticated using (public.is_admin());

-- Explicit Data API grants for projects created after Supabase's 2026 change
-- where public tables are no longer automatically exposed to anon/auth roles.
grant select, insert, update, delete on table public.templates to authenticated;
