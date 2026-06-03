-- ============================================================
-- 1. profiles table
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  avatar_url text
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_select" on public.profiles
  for select to authenticated using (true);

create policy "profiles_update_own" on public.profiles
  for update to authenticated using (auth.uid() = id);

-- ============================================================
-- 2. Trigger: populate profiles on every new signup
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- 3. Backfill existing users into profiles
-- ============================================================
insert into public.profiles (id, email, full_name, avatar_url)
select
  id,
  email,
  raw_user_meta_data->>'full_name',
  raw_user_meta_data->>'avatar_url'
from auth.users
on conflict (id) do nothing;

-- ============================================================
-- 4. Add generating columns to projects
-- ============================================================
alter table public.projects
  add column if not exists generating boolean not null default false,
  add column if not exists generating_by uuid references auth.users(id) on delete set null;

-- ============================================================
-- 5. Fix project_collaborators.user_id FK (idempotent)
-- ============================================================
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'project_collaborators_user_id_fkey'
      and table_name = 'project_collaborators'
  ) then
    alter table public.project_collaborators
      add constraint project_collaborators_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end;
$$;

-- ============================================================
-- 6. Add collaborator self-select on project_collaborators
-- ============================================================
drop policy if exists "Collaborators can view own record" on public.project_collaborators;

create policy "Collaborators can view own record" on public.project_collaborators
  for select to authenticated
  using (user_id = auth.uid());

-- ============================================================
-- 7. Expand projects RLS to include collaborators
-- ============================================================
drop policy if exists "Collaborators can view shared projects" on public.projects;
drop policy if exists "Collaborators can update shared projects" on public.projects;

create policy "Collaborators can view shared projects" on public.projects
  for select to authenticated
  using (
    exists (
      select 1 from public.project_collaborators
      where project_collaborators.project_id = projects.id
        and project_collaborators.user_id = auth.uid()
    )
  );

create policy "Collaborators can update shared projects" on public.projects
  for update to authenticated
  using (
    exists (
      select 1 from public.project_collaborators
      where project_collaborators.project_id = projects.id
        and project_collaborators.user_id = auth.uid()
        and project_collaborators.permission = 'edit'
    )
  );
