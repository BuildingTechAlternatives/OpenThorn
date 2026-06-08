-- Global notifications controlled from Supabase dashboard
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  time_label text not null default 'New',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Only authenticated users can read active notifications
alter table public.notifications enable row level security;

create policy "Authenticated users can read active notifications"
  on public.notifications
  for select
  to authenticated
  using (is_active = true);

-- Only service role can insert/update/delete (managed via Supabase dashboard)
