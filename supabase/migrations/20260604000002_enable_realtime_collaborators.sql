-- Enable Supabase Realtime for project_collaborators so INSERT events fire
-- when someone is added as a collaborator. Without this the dashboard's
-- postgres_changes subscription never receives new-share events.
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_collaborators;
