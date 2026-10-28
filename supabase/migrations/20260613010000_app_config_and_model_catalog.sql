-- ============================================================
-- Admin panel Phase 2: app_config table (disabled providers,
-- announcement banner, feature flags) and admin write access to
-- the existing global default_models catalog.
-- ============================================================

-- 1. app_config: key/value store for platform configuration.
create table if not exists public.app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_config enable row level security;

-- Everyone (including signed-out visitors, e.g. the landing page
-- announcement banner) may read configuration.
drop policy if exists "app_config_select_all" on public.app_config;
create policy "app_config_select_all" on public.app_config
  for select to anon, authenticated using (true);

drop policy if exists "app_config_admin_insert" on public.app_config;
create policy "app_config_admin_insert" on public.app_config
  for insert to authenticated with check (public.is_admin());

drop policy if exists "app_config_admin_update" on public.app_config;
create policy "app_config_admin_update" on public.app_config
  for update to authenticated using (public.is_admin());

drop policy if exists "app_config_admin_delete" on public.app_config;
create policy "app_config_admin_delete" on public.app_config
  for delete to authenticated using (public.is_admin());

-- 2. default_models: global model catalog. This was originally created via
-- the dashboard, but the migration now defines it so fresh resets work too.
create table if not exists public.default_models (
  provider_id text primary key,
  models text not null,
  updated_at timestamptz not null default now()
);

alter table public.default_models enable row level security;

drop policy if exists "default_models_select_all" on public.default_models;
create policy "default_models_select_all" on public.default_models
  for select to anon, authenticated using (true);

drop policy if exists "default_models_admin_insert" on public.default_models;
create policy "default_models_admin_insert" on public.default_models
  for insert to authenticated with check (public.is_admin());

drop policy if exists "default_models_admin_update" on public.default_models;
create policy "default_models_admin_update" on public.default_models
  for update to authenticated using (public.is_admin());

drop policy if exists "default_models_admin_delete" on public.default_models;
create policy "default_models_admin_delete" on public.default_models
  for delete to authenticated using (public.is_admin());

-- Explicit Data API grants for projects created after Supabase's 2026 change
-- where public tables are no longer automatically exposed to anon/auth roles.
grant select on table public.app_config to anon, authenticated;
grant insert, update, delete on table public.app_config to authenticated;
grant select on table public.default_models to anon, authenticated;
grant insert, update, delete on table public.default_models to authenticated;
