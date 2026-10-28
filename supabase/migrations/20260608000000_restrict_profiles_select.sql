-- Previously any authenticated user could read every row in public.profiles
-- (policy "profiles_select" using (true)), exposing all users' emails and names.
-- Restrict reads to the owner, and expose a narrow SECURITY DEFINER lookup for
-- the only legitimate cross-user need: resolving an email to an account when
-- inviting a collaborator. The lookup never returns the email back.

drop policy if exists "profiles_select" on public.profiles;

create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using (auth.uid() = id);

create or replace function public.find_account_by_email(lookup_email text)
returns table (id uuid, full_name text)
language sql
security definer
stable
set search_path = public
as $$
  select p.id, p.full_name
  from public.profiles p
  where lower(p.email) = lower(trim(lookup_email))
  limit 1;
$$;

revoke all on function public.find_account_by_email(text) from public;
-- Supabase default privileges auto-grant EXECUTE to anon on new functions;
-- revoke it so only signed-in users can resolve an account by email.
revoke execute on function public.find_account_by_email(text) from anon;
grant execute on function public.find_account_by_email(text) to authenticated;
