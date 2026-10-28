-- Admin-managed dashboard bell notifications.
-- Authenticated users can read active messages; admins can manage all rows.

drop policy if exists "notifications_select_admin" on public.notifications;
create policy "notifications_select_admin" on public.notifications
  for select to authenticated using (public.is_admin());

drop policy if exists "notifications_admin_insert" on public.notifications;
create policy "notifications_admin_insert" on public.notifications
  for insert to authenticated with check (public.is_admin());

drop policy if exists "notifications_admin_update" on public.notifications;
create policy "notifications_admin_update" on public.notifications
  for update to authenticated using (public.is_admin());

drop policy if exists "notifications_admin_delete" on public.notifications;
create policy "notifications_admin_delete" on public.notifications
  for delete to authenticated using (public.is_admin());

grant select, insert, update, delete on table public.notifications to authenticated;
