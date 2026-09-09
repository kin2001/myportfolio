begin;

-- Applied remotely as migration 20260909072626.
-- /resume.pdf resolves the selected private CV through the server-only
-- service-role client. Grants are required before PostgREST can apply RLS
-- bypass privileges.
grant select on table public.site_settings to service_role;
grant select on table public.cv_versions to service_role;
grant select on table public.assets to service_role;

commit;
