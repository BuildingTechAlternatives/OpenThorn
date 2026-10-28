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
-- community_posts / community_likes were initially created from the dashboard.
-- Keep the migration self-contained so a fresh database reset still supports
-- the community and admin moderation surfaces.
create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  description text,
  preview_url text,
  author_name text not null default '',
  files_snapshot jsonb not null default '[]'::jsonb,
  likes_count integer not null default 0,
  published_at timestamptz not null default now()
);

create table if not exists public.community_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.community_posts(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

alter table public.community_posts enable row level security;
alter table public.community_likes enable row level security;

drop policy if exists "community_posts_select" on public.community_posts;
create policy "community_posts_select" on public.community_posts
  for select to authenticated using (true);

drop policy if exists "community_posts_insert" on public.community_posts;
create policy "community_posts_insert" on public.community_posts
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "community_posts_update" on public.community_posts;
create policy "community_posts_update" on public.community_posts
  for update to authenticated using (user_id = auth.uid());

drop policy if exists "community_posts_delete" on public.community_posts;
create policy "community_posts_delete" on public.community_posts
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists "community_likes_select" on public.community_likes;
create policy "community_likes_select" on public.community_likes
  for select to authenticated using (true);

drop policy if exists "community_likes_insert" on public.community_likes;
create policy "community_likes_insert" on public.community_likes
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "community_likes_delete" on public.community_likes;
create policy "community_likes_delete" on public.community_likes
  for delete to authenticated using (user_id = auth.uid());

create or replace function public.update_community_likes_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.community_posts
      set likes_count = likes_count + 1
      where id = new.post_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.community_posts
      set likes_count = greatest(likes_count - 1, 0)
      where id = old.post_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists community_likes_count_trigger on public.community_likes;
create trigger community_likes_count_trigger
  after insert or delete on public.community_likes
  for each row execute procedure public.update_community_likes_count();

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

-- Explicit Data API grants for projects created after Supabase's 2026 change
-- where public tables are no longer automatically exposed to anon/auth roles.
grant select, insert, update, delete on table public.community_posts to authenticated;
grant select, insert, delete on table public.community_likes to authenticated;
grant select, update on table public.profiles to authenticated;
