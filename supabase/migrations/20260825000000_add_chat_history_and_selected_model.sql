-- chat_history was added ad-hoc to live databases but never captured as a
-- migration, so fresh environments missed the column and every project load
-- failed (the builder then persisted an empty/error chat over real history).
alter table public.projects
  add column if not exists chat_history jsonb,
  add column if not exists selected_model text;
