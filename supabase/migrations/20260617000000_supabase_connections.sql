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
