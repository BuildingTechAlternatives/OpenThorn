-- Fix infinite recursion in RLS policies between projects ↔ project_collaborators.
-- Security definer functions bypass RLS on the queried table, breaking the cycle.

drop policy if exists "Collaborators can view shared projects" on public.projects;
drop policy if exists "Collaborators can update shared projects" on public.projects;
drop policy if exists "Project owners can manage collaborators" on public.project_collaborators;
drop policy if exists "Project members can view collaborators" on public.project_collaborators;
drop policy if exists "Collaborators can view own record" on public.project_collaborators;

create or replace function public.current_user_is_collaborator(project_uuid uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.project_collaborators
    where project_id = project_uuid
      and user_id = auth.uid()
  );
$$;

create or replace function public.current_user_has_edit_permission(project_uuid uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.project_collaborators
    where project_id = project_uuid
      and user_id = auth.uid()
      and permission = 'edit'
  );
$$;

create or replace function public.current_user_is_owner(project_uuid uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.projects
    where id = project_uuid
      and user_id = auth.uid()
  );
$$;

create policy "Collaborators can view shared projects" on public.projects
  for select to authenticated
  using (public.current_user_is_collaborator(id));

create policy "Collaborators can update shared projects" on public.projects
  for update to authenticated
  using (public.current_user_has_edit_permission(id));

create policy "Project owners can manage collaborators" on public.project_collaborators
  for all to authenticated
  using (public.current_user_is_owner(project_id));

create policy "Collaborators can view own record" on public.project_collaborators
  for select to authenticated
  using (user_id = auth.uid());
