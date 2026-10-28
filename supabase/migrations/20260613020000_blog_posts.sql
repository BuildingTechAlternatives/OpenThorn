-- ============================================================
-- Admin panel Phase 3: blog_posts table. Source of truth for the
-- blog; synced to static files at build time by scripts/sync-blog.mjs.
-- ============================================================

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  excerpt text not null default '',
  content text not null default '',
  date date not null default current_date,
  date_modified date,
  cover_youtube text,
  cover_image text,
  og_image text,
  tldr text,
  how_to jsonb,
  item_list jsonb,
  status text not null default 'draft' check (status in ('draft','published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.blog_posts enable row level security;

-- Anyone may read published posts (anon + authenticated).
drop policy if exists "blog_posts_select_published" on public.blog_posts;
create policy "blog_posts_select_published" on public.blog_posts
  for select to anon, authenticated using (status = 'published');

-- Admins may read everything (drafts included).
drop policy if exists "blog_posts_select_admin" on public.blog_posts;
create policy "blog_posts_select_admin" on public.blog_posts
  for select to authenticated using (public.is_admin());

-- Admins may write.
drop policy if exists "blog_posts_admin_insert" on public.blog_posts;
create policy "blog_posts_admin_insert" on public.blog_posts
  for insert to authenticated with check (public.is_admin());

drop policy if exists "blog_posts_admin_update" on public.blog_posts;
create policy "blog_posts_admin_update" on public.blog_posts
  for update to authenticated using (public.is_admin());

drop policy if exists "blog_posts_admin_delete" on public.blog_posts;
create policy "blog_posts_admin_delete" on public.blog_posts
  for delete to authenticated using (public.is_admin());

-- Explicit Data API grants for projects created after Supabase's 2026 change
-- where public tables are no longer automatically exposed to anon/auth roles.
grant select on table public.blog_posts to anon, authenticated;
grant insert, update, delete on table public.blog_posts to authenticated;
