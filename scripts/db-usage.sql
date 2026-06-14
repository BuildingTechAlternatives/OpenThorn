-- OpenThorn / bloom — Supabase Free-Tier Kapazitäts-Check (read-only)
-- Ausführen: Supabase SQL Editor, oder MCP execute_sql.
-- Free-Limit Postgres = 500 MB; realistisch nutzbar ~400 MB (Index/TOAST/Bloat).

-- 1) Gesamte DB-Größe
select pg_size_pretty(pg_database_size(current_database())) as db_total;

-- 2) Größte Tabellen (inkl. Indizes + TOAST)
select relname as table,
       pg_size_pretty(pg_total_relation_size(c.oid))                                as total,
       pg_size_pretty(pg_relation_size(c.oid))                                      as main,
       pg_size_pretty(pg_total_relation_size(c.oid) - pg_relation_size(c.oid))      as toast_plus_idx
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by pg_total_relation_size(c.oid) desc
limit 20;

-- 3) Pro-Projekt-Footprint: files (Quellcode) vs chat_history (Agent-Verlauf)
select
  (select count(*) from public.projects)                                           as projects,
  (select count(distinct user_id) from public.projects)                            as users_with_projects,
  (select count(*) from auth.users)                                                as total_users,
  pg_size_pretty(coalesce(sum(pg_column_size(files)),0)::bigint)                    as files_total,
  pg_size_pretty(coalesce(avg(pg_column_size(files)),0)::bigint)                    as files_avg,
  pg_size_pretty(coalesce(max(pg_column_size(files)),0)::bigint)                    as files_max,
  pg_size_pretty(coalesce(sum(pg_column_size(chat_history)),0)::bigint)             as chat_total,
  pg_size_pretty(coalesce(avg(pg_column_size(chat_history)),0)::bigint)            as chat_avg,
  pg_size_pretty(coalesce(max(pg_column_size(chat_history)),0)::bigint)            as chat_max
from public.projects;

-- 4) Top 10 größte Projekte (zum Aufspüren von Ausreißern)
select id, left(coalesce(title,''), 40) as title,
       pg_size_pretty((pg_column_size(files) + pg_column_size(chat_history))::bigint) as total,
       pg_size_pretty(pg_column_size(files)::bigint)        as files,
       pg_size_pretty(pg_column_size(chat_history)::bigint) as chat
from public.projects
order by (pg_column_size(files) + pg_column_size(chat_history)) desc
limit 10;

-- 5) Bloat-Indikator: tote Tupel (hoch = VACUUM sinnvoll)
select relname as table, n_live_tup as live_rows, n_dead_tup as dead_rows,
       last_autovacuum, last_vacuum
from pg_stat_user_tables
where schemaname = 'public'
order by n_dead_tup desc
limit 10;
