-- Rename the Netlify site id column to the provider-neutral CF Pages project name.
alter table public.projects
  rename column netlify_site_id to cf_pages_project_name;
