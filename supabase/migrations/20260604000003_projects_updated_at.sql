-- Add updated_at to projects, defaulting to now() for new rows
alter table public.projects
  add column if not exists updated_at timestamptz not null default now();

-- Back-fill existing rows: set updated_at = created_at
update public.projects set updated_at = created_at where updated_at = now();

-- Trigger function: keep updated_at current on every row update
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists projects_updated_at on public.projects;
create trigger projects_updated_at
  before update on public.projects
  for each row execute procedure public.set_updated_at();
