alter table public.projects
  add column if not exists agent_history jsonb;
