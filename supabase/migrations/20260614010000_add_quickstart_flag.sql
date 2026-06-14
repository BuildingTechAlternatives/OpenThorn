-- First-login quickstart guide: track whether a user has seen it.
alter table public.profiles
  add column if not exists has_seen_quickstart boolean not null default false;

-- Existing users have already used the app — don't re-onboard them.
-- New signups created after this migration get the default `false`.
update public.profiles set has_seen_quickstart = true;
