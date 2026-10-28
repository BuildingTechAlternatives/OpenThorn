-- The "Public can read deployments" policy let anyone (including anon) LIST every
-- object in the public `deployments` bucket via the storage API. Public object
-- downloads do not need a SELECT policy (the bucket is public), and the app only
-- uploads thumbnails + builds public URLs — it never lists the bucket. Replace the
-- broad policy with an owner/collaborator-scoped one so cross-user enumeration is
-- no longer possible.

drop policy if exists "Public can read deployments" on storage.objects;

create policy "Auth users read own deployments" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'deployments'
    and (
      (storage.foldername(name))[1] in (
        select projects.id::text from public.projects where projects.user_id = auth.uid()
        union
        select project_collaborators.project_id::text from public.project_collaborators
        where project_collaborators.user_id = auth.uid()
      )
      or (
        (storage.foldername(name))[1] = 'previews'
        and (storage.foldername(name))[2] in (
          select projects.id::text from public.projects where projects.user_id = auth.uid()
          union
          select project_collaborators.project_id::text from public.project_collaborators
          where project_collaborators.user_id = auth.uid()
        )
      )
    )
  );
