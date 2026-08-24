begin;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values
  (
    'portfolio-private',
    'portfolio-private',
    false,
    10485760,
    array[
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/avif',
      'application/pdf'
    ]::text[]
  ),
  (
    'portfolio-public',
    'portfolio-public',
    true,
    10485760,
    array['image/webp', 'application/pdf']::text[]
  )
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types,
    updated_at = now();

-- Supabase Storage and Postgres now share one provider. Selecting a CV only
-- changes the database pointer; /resume.pdf validates and streams the retained
-- private object through the server.
drop function if exists public.claim_current_cv_transition(
  uuid, uuid, uuid, text, text, boolean, bigint, text
);
drop function if exists public.confirm_current_cv_transition(uuid, bigint, text, uuid);
drop function if exists public.finish_current_cv_transition(
  uuid, uuid, text, uuid, bigint, text, uuid
);
drop function if exists public.release_current_cv_transition(uuid, bigint, text, uuid);
drop function if exists public.claim_stale_current_cv_transition(bigint, text, uuid);

alter table public.site_settings
  drop constraint if exists site_settings_cv_transition_is_complete,
  drop constraint if exists site_settings_cv_transition_checksum_is_valid,
  drop constraint if exists site_settings_cv_transition_expected_version_is_valid,
  drop constraint if exists site_settings_current_cv_pointer_is_complete,
  drop column if exists current_cv_public_object_key,
  drop column if exists current_cv_generation,
  drop column if exists current_cv_transition_claimed_at,
  drop column if exists current_cv_transition_token,
  drop column if exists current_cv_transition_version_id,
  drop column if exists current_cv_transition_checksum,
  drop column if exists current_cv_transition_generation,
  drop column if exists current_cv_transition_previous_public_object_key,
  drop column if exists current_cv_transition_expected_pointer_etag,
  drop column if exists current_cv_transition_expected_pointer_absent;

create function public.set_current_cv(p_cv_version_id uuid)
returns public.site_settings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_settings public.site_settings%rowtype;
begin
  if not coalesce(private.is_admin(), false) then
    raise exception 'admin_not_allowed' using errcode = '42501';
  end if;
  if not exists (
    select 1
    from public.cv_versions cv
    join public.assets asset on asset.id = cv.asset_id
    where cv.id = p_cv_version_id
      and asset.purpose = 'cv_pdf'
      and asset.mime_type = 'application/pdf'
      and asset.processing_state = 'ready'
      and asset.visibility = 'private'
      and asset.checksum_sha256 ~ '^[0-9a-f]{64}$'
  ) then
    raise exception 'cv_version_not_ready' using errcode = '23514';
  end if;

  update public.site_settings
  set current_cv_version_id = p_cv_version_id,
      updated_by = v_actor,
      updated_at = now()
  where singleton
  returning * into v_settings;

  perform private.record_audit(
    v_actor,
    'cv',
    p_cv_version_id,
    'set_current',
    array['current_cv_version_id']
  );
  return v_settings;
end;
$$;

revoke execute on function public.set_current_cv(uuid)
from public, anon, service_role;
grant execute on function public.set_current_cv(uuid) to authenticated;

commit;
