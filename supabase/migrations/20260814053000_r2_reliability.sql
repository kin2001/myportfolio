begin;

alter table public.assets
  add column cleanup_claimed_at timestamptz,
  add column cleanup_claim_token uuid,
  add column publication_claimed_at timestamptz,
  add column publication_claim_token uuid,
  add column publication_target_object_key text,
  add column publication_target_mime_type text,
  add column public_revert_claimed_at timestamptz,
  add column public_revert_claim_token uuid;

-- Preserve any interrupted claims from the original unleased cleanup flow and
-- make them immediately reclaimable by the next cleanup run.
update public.assets
set cleanup_claimed_at = now() - interval '16 minutes',
    cleanup_claim_token = pg_catalog.gen_random_uuid()
where processing_state = 'deleting';

alter table public.assets
  add constraint assets_cleanup_lease_matches_state check (
    (processing_state = 'deleting') = (cleanup_claimed_at is not null)
  ),
  add constraint assets_cleanup_token_matches_state check (
    (processing_state = 'deleting') = (cleanup_claim_token is not null)
  ),
  add constraint assets_publication_claim_is_complete check (
    (publication_claimed_at is null)
      = (publication_claim_token is null)
    and (publication_claimed_at is null)
      = (publication_target_object_key is null)
    and (publication_claimed_at is null)
      = (publication_target_mime_type is null)
  ),
  add constraint assets_publication_claim_matches_state check (
    publication_claimed_at is null or processing_state = 'ready'
  ),
  add constraint assets_public_revert_claim_matches_state check (
    public_revert_claimed_at is null
    or processing_state = 'published'
  ),
  add constraint assets_public_revert_token_matches_claim check (
    (public_revert_claimed_at is null) = (public_revert_claim_token is null)
  ),
  add constraint assets_public_transitions_are_exclusive check (
    publication_claimed_at is null or public_revert_claimed_at is null
  );

alter table public.site_settings
  add column current_cv_generation uuid,
  add column current_cv_transition_claimed_at timestamptz,
  add column current_cv_transition_token uuid,
  add column current_cv_transition_version_id uuid
    references public.cv_versions(id) on delete restrict,
  add column current_cv_transition_checksum text,
  add column current_cv_transition_generation uuid,
  add column current_cv_transition_previous_public_object_key text,
  add column current_cv_transition_expected_pointer_etag text,
  add column current_cv_transition_expected_pointer_absent boolean,
  add constraint site_settings_cv_transition_is_complete check (
    (current_cv_transition_claimed_at is null)
      = (current_cv_transition_token is null)
    and (current_cv_transition_claimed_at is null)
      = (current_cv_transition_version_id is null)
    and (current_cv_transition_claimed_at is null)
      = (current_cv_transition_checksum is null)
    and (current_cv_transition_claimed_at is null)
      = (current_cv_transition_generation is null)
    and (current_cv_transition_claimed_at is null)
      = (current_cv_transition_expected_pointer_absent is null)
    and (
      current_cv_transition_claimed_at is not null
      or current_cv_transition_expected_pointer_etag is null
    )
  ),
  add constraint site_settings_cv_transition_checksum_is_valid check (
    current_cv_transition_checksum is null
    or current_cv_transition_checksum ~ '^[0-9a-f]{64}$'
  ),
  add constraint site_settings_cv_transition_expected_version_is_valid check (
    current_cv_transition_claimed_at is null
    or (
      current_cv_transition_expected_pointer_absent
      and current_cv_transition_expected_pointer_etag is null
    )
    or (
      not current_cv_transition_expected_pointer_absent
      and current_cv_transition_expected_pointer_etag is not null
      and pg_catalog.length(current_cv_transition_expected_pointer_etag) between 1 and 200
    )
  );

create or replace function private.protect_asset_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.processing_state = 'pending'
    and new.processing_state not in ('pending', 'deleting', 'ready')
  then
    raise exception 'asset_must_be_validated_before_publication' using errcode = '55000';
  end if;

  if old.processing_state = 'deleting'
    and new.processing_state not in ('pending', 'deleting')
  then
    raise exception 'asset_cleanup_claim_is_locked' using errcode = '55000';
  end if;

  if new.processing_state = 'deleting'
    or old.processing_state = 'deleting'
  then
    if new.object_key is distinct from old.object_key
      or new.purpose is distinct from old.purpose
      or new.original_filename is distinct from old.original_filename
      or new.mime_type is distinct from old.mime_type
      or new.size_bytes is distinct from old.size_bytes
      or new.owner_id is distinct from old.owner_id
      or new.created_at is distinct from old.created_at
    then
      raise exception 'cleanup_claim_may_only_change_state' using errcode = '55000';
    end if;
  end if;

  if old.processing_state in ('ready', 'published') then
    if new.processing_state not in ('ready', 'published') then
      raise exception 'asset_state_cannot_change' using errcode = '55000';
    end if;
    if new.object_key is distinct from old.object_key
      or new.purpose is distinct from old.purpose
      or new.original_filename is distinct from old.original_filename
      or new.private_derivative_key is distinct from old.private_derivative_key
      or new.private_derivative_size_bytes is distinct from old.private_derivative_size_bytes
      or new.mime_type is distinct from old.mime_type
      or new.width is distinct from old.width
      or new.height is distinct from old.height
      or new.size_bytes is distinct from old.size_bytes
      or new.checksum_sha256 is distinct from old.checksum_sha256
      or new.owner_id is distinct from old.owner_id
      or new.validated_at is distinct from old.validated_at
      or new.created_at is distinct from old.created_at
    then
      raise exception 'validated_asset_metadata_is_immutable' using errcode = '55000';
    end if;
  end if;

  if old.processing_state = 'published' and new.processing_state = 'published' and (
    new.visibility <> 'public'
    or new.public_object_key is distinct from old.public_object_key
    or new.public_mime_type is distinct from old.public_mime_type
    or new.publication_permission_confirmed_at is distinct from old.publication_permission_confirmed_at
  ) then
    raise exception 'published_asset_may_only_change_revert_claim' using errcode = '55000';
  end if;

  if old.processing_state = 'published' and new.processing_state = 'ready' and (
    new.visibility <> 'private'
    or new.public_object_key is not null
    or new.public_mime_type is not null
    or new.publication_permission_confirmed_at is not null
    or new.public_revert_claimed_at is not null
  ) then
    raise exception 'published_asset_may_only_be_compensated' using errcode = '55000';
  end if;

  if old.processing_state = 'ready'
    and old.public_revert_claimed_at is not null
    and new.processing_state = 'published'
  then
    raise exception 'asset_public_revert_claim_is_locked' using errcode = '55000';
  end if;

  if exists (
    select 1 from public.cv_versions where asset_id = old.id
  ) and (
    new.processing_state <> 'ready'
    or new.visibility <> 'private'
    or new.public_object_key is not null
    or new.public_mime_type is not null
  ) then
    raise exception 'cv_version_asset_must_remain_private' using errcode = '55000';
  end if;

  return new;
end;
$$;

drop function public.claim_pending_assets_for_cleanup(integer, bigint, text, uuid);
drop function public.finish_pending_asset_cleanup(uuid[], bigint, text, uuid);
drop function public.release_pending_asset_cleanup(uuid[], bigint, text, uuid);

create function public.claim_pending_assets_for_cleanup(
  p_limit integer,
  p_attestation_timestamp bigint,
  p_attestation_signature text,
  p_administrator_id uuid default auth.uid()
)
returns table (
  asset_id uuid,
  object_key text,
  private_derivative_key text,
  claim_token uuid
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_administrator_id is null or not exists (
    select 1 from private.admin_users where user_id = p_administrator_id
  ) then
    raise exception 'admin_not_allowed' using errcode = '42501';
  end if;
  if not private.asset_mutation_attested(
    p_administrator_id,
    'cleanup_claim',
    p_attestation_timestamp,
    array[coalesce(p_limit::text, '')],
    p_attestation_signature
  ) then
    raise exception 'invalid_asset_attestation' using errcode = '42501';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'cleanup_batch_too_large' using errcode = '22023';
  end if;

  return query
  with candidates as (
    select asset.id
    from public.assets asset
    where (
      (
        asset.processing_state = 'pending'
        and asset.created_at < now() - interval '24 hours'
      )
      or (
        asset.processing_state = 'deleting'
        and asset.cleanup_claimed_at < now() - interval '15 minutes'
      )
    )
      and not exists (
        select 1 from public.project_drafts draft
        where draft.cover_asset_id = asset.id
      )
      and not exists (
        select 1 from public.credentials credential
        where credential.evidence_asset_id = asset.id
      )
    order by coalesce(asset.cleanup_claimed_at, asset.created_at), asset.id
    for update of asset skip locked
    limit p_limit
  )
  update public.assets asset
  set processing_state = 'deleting',
      cleanup_claimed_at = now(),
      cleanup_claim_token = pg_catalog.gen_random_uuid()
  from candidates
  where asset.id = candidates.id
  returning asset.id, asset.object_key, asset.private_derivative_key,
    asset.cleanup_claim_token;
end;
$$;

create function public.finish_pending_asset_cleanup(
  p_ids uuid[],
  p_claim_tokens uuid[],
  p_attestation_timestamp bigint,
  p_attestation_signature text,
  p_administrator_id uuid default auth.uid()
)
returns table (asset_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := p_administrator_id;
begin
  if p_administrator_id is null or not exists (
    select 1 from private.admin_users where user_id = p_administrator_id
  ) then
    raise exception 'admin_not_allowed' using errcode = '42501';
  end if;
  if not private.asset_mutation_attested(
    p_administrator_id,
    'cleanup_finish',
    p_attestation_timestamp,
    array[
      coalesce(pg_catalog.array_to_string(p_ids, ','), ''),
      coalesce(pg_catalog.array_to_string(p_claim_tokens, ','), '')
    ],
    p_attestation_signature
  ) then
    raise exception 'invalid_asset_attestation' using errcode = '42501';
  end if;
  if coalesce(pg_catalog.cardinality(p_ids), 0) = 0 then
    return;
  end if;
  if pg_catalog.cardinality(p_ids) > 100
    or pg_catalog.cardinality(p_ids) is distinct from pg_catalog.cardinality(p_claim_tokens)
    or pg_catalog.array_position(p_claim_tokens, null) is not null
  then
    raise exception 'cleanup_batch_too_large' using errcode = '22023';
  end if;

  return query
  delete from public.assets asset
  where exists (
      select 1
      from pg_catalog.generate_subscripts(p_ids, 1) claim(position)
      where p_ids[claim.position] = asset.id
        and p_claim_tokens[claim.position] = asset.cleanup_claim_token
    )
    and asset.processing_state = 'deleting'
    and asset.cleanup_claimed_at is not null
  returning asset.id;

  if found then
    perform private.record_audit(
      v_actor,
      'asset',
      null,
      'pending_cleanup',
      array['processing_state', 'cleanup_claimed_at', 'created_at']
    );
  end if;
end;
$$;

create function public.release_pending_asset_cleanup(
  p_ids uuid[],
  p_claim_tokens uuid[],
  p_attestation_timestamp bigint,
  p_attestation_signature text,
  p_administrator_id uuid default auth.uid()
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows integer;
begin
  if p_administrator_id is null or not exists (
    select 1 from private.admin_users where user_id = p_administrator_id
  ) then
    raise exception 'admin_not_allowed' using errcode = '42501';
  end if;
  if not private.asset_mutation_attested(
    p_administrator_id,
    'cleanup_release',
    p_attestation_timestamp,
    array[
      coalesce(pg_catalog.array_to_string(p_ids, ','), ''),
      coalesce(pg_catalog.array_to_string(p_claim_tokens, ','), '')
    ],
    p_attestation_signature
  ) then
    raise exception 'invalid_asset_attestation' using errcode = '42501';
  end if;
  if coalesce(pg_catalog.cardinality(p_ids), 0) = 0 then
    return 0;
  end if;
  if pg_catalog.cardinality(p_ids) > 100
    or pg_catalog.cardinality(p_ids) is distinct from pg_catalog.cardinality(p_claim_tokens)
    or pg_catalog.array_position(p_claim_tokens, null) is not null
  then
    raise exception 'cleanup_batch_too_large' using errcode = '22023';
  end if;

  update public.assets asset
  set processing_state = 'pending',
      cleanup_claimed_at = null,
      cleanup_claim_token = null
  where exists (
      select 1
      from pg_catalog.generate_subscripts(p_ids, 1) claim(position)
      where p_ids[claim.position] = asset.id
        and p_claim_tokens[claim.position] = asset.cleanup_claim_token
    )
    and asset.processing_state = 'deleting';
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

drop function public.publish_asset(uuid, text, text, bigint, text);

create function public.claim_asset_publication(
  p_asset_id uuid,
  p_public_object_key text,
  p_public_mime_type text,
  p_attestation_timestamp bigint,
  p_attestation_signature text,
  p_administrator_id uuid default auth.uid()
)
returns table (
  claim_token uuid,
  source_object_key text,
  source_size_bytes bigint,
  source_checksum_sha256 text,
  source_purpose text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_asset public.assets%rowtype;
  v_expected_mime text;
  v_expected_extension text;
  v_token uuid;
begin
  if p_administrator_id is null or not exists (
    select 1 from private.admin_users where user_id = p_administrator_id
  ) then
    raise exception 'admin_not_allowed' using errcode = '42501';
  end if;
  if not private.asset_mutation_attested(
    p_administrator_id,
    'publish_claim',
    p_attestation_timestamp,
    array[
      p_asset_id::text,
      coalesce(p_public_object_key, ''),
      coalesce(p_public_mime_type, '')
    ],
    p_attestation_signature
  ) then
    raise exception 'invalid_asset_attestation' using errcode = '42501';
  end if;

  select * into v_asset
  from public.assets
  where id = p_asset_id
  for update;
  if not found then
    raise exception 'asset_not_found' using errcode = 'P0002';
  end if;
  if v_asset.purpose = 'cv_pdf' then
    raise exception 'cv_asset_cannot_be_public' using errcode = '23514';
  end if;

  v_expected_mime := case
    when v_asset.purpose in ('project_image', 'credential_image') then 'image/webp'
    else 'application/pdf'
  end;
  v_expected_extension := case
    when v_expected_mime = 'image/webp' then '[.]webp'
    else '[.]pdf'
  end;
  if p_public_object_key !~ (
      '^assets/' || v_asset.id::text
      || '/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}'
      || v_expected_extension || '$'
    )
    or p_public_mime_type is distinct from v_expected_mime
  then
    raise exception 'invalid_public_asset_metadata' using errcode = '22023';
  end if;
  if v_asset.processing_state = 'published' then
    if v_asset.public_object_key is distinct from p_public_object_key
      or v_asset.public_mime_type is distinct from p_public_mime_type
    then
      raise exception 'published_asset_metadata_mismatch' using errcode = '55000';
    end if;
    return;
  end if;
  if v_asset.processing_state <> 'ready'
    or v_asset.public_revert_claimed_at is not null
    or v_asset.publication_claimed_at is not null
  then
    raise exception 'asset_publication_busy' using errcode = '40001';
  end if;

  v_token := pg_catalog.gen_random_uuid();
  update public.assets
  set publication_claimed_at = now(),
      publication_claim_token = v_token,
      publication_target_object_key = p_public_object_key,
      publication_target_mime_type = p_public_mime_type
  where id = p_asset_id;
  return query select
    v_token,
    case
      when v_asset.purpose in ('project_image', 'credential_image')
        then v_asset.private_derivative_key
      else v_asset.object_key
    end,
    case
      when v_asset.purpose in ('project_image', 'credential_image')
        then v_asset.private_derivative_size_bytes
      else v_asset.size_bytes
    end,
    case
      when v_asset.purpose = 'credential_pdf' then v_asset.checksum_sha256
      else null
    end,
    v_asset.purpose::text;
end;
$$;

create function public.finish_asset_publication(
  p_asset_id uuid,
  p_public_object_key text,
  p_public_mime_type text,
  p_claim_token uuid,
  p_attestation_timestamp bigint,
  p_attestation_signature text,
  p_administrator_id uuid default auth.uid()
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows integer;
begin
  if p_administrator_id is null or not exists (
    select 1 from private.admin_users where user_id = p_administrator_id
  ) then
    raise exception 'admin_not_allowed' using errcode = '42501';
  end if;
  if not private.asset_mutation_attested(
    p_administrator_id,
    'publish_finish',
    p_attestation_timestamp,
    array[
      p_asset_id::text,
      coalesce(p_public_object_key, ''),
      coalesce(p_public_mime_type, ''),
      coalesce(p_claim_token::text, '')
    ],
    p_attestation_signature
  ) then
    raise exception 'invalid_asset_attestation' using errcode = '42501';
  end if;

  update public.assets
  set processing_state = 'published',
      visibility = 'public',
      public_object_key = p_public_object_key,
      public_mime_type = p_public_mime_type,
      publication_permission_confirmed_at = now(),
      publication_claimed_at = null,
      publication_claim_token = null,
      publication_target_object_key = null,
      publication_target_mime_type = null
  where id = p_asset_id
    and processing_state = 'ready'
    and publication_claim_token = p_claim_token
    and publication_target_object_key = p_public_object_key
    and publication_target_mime_type = p_public_mime_type;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'asset_publication_claim_lost' using errcode = '40001';
  end if;
  return true;
end;
$$;

create function public.release_asset_publication(
  p_asset_id uuid,
  p_claim_token uuid,
  p_attestation_timestamp bigint,
  p_attestation_signature text,
  p_administrator_id uuid default auth.uid()
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows integer;
begin
  if p_administrator_id is null or not exists (
    select 1 from private.admin_users where user_id = p_administrator_id
  ) then
    raise exception 'admin_not_allowed' using errcode = '42501';
  end if;
  if not private.asset_mutation_attested(
    p_administrator_id,
    'publish_release',
    p_attestation_timestamp,
    array[p_asset_id::text, coalesce(p_claim_token::text, '')],
    p_attestation_signature
  ) then
    raise exception 'invalid_asset_attestation' using errcode = '42501';
  end if;

  update public.assets
  set publication_claimed_at = null,
      publication_claim_token = null,
      publication_target_object_key = null,
      publication_target_mime_type = null
  where id = p_asset_id
    and processing_state = 'ready'
    and publication_claim_token = p_claim_token;
  get diagnostics v_rows = row_count;
  return v_rows = 1;
end;
$$;

create function public.claim_stale_asset_publications(
  p_limit integer,
  p_attestation_timestamp bigint,
  p_attestation_signature text,
  p_administrator_id uuid default auth.uid()
)
returns table (
  asset_id uuid,
  source_object_key text,
  source_size_bytes bigint,
  source_checksum_sha256 text,
  source_purpose text,
  public_object_key text,
  public_mime_type text,
  claim_token uuid
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_administrator_id is null or not exists (
    select 1 from private.admin_users where user_id = p_administrator_id
  ) then
    raise exception 'admin_not_allowed' using errcode = '42501';
  end if;
  if not private.asset_mutation_attested(
    p_administrator_id,
    'publish_recover',
    p_attestation_timestamp,
    array[coalesce(p_limit::text, '')],
    p_attestation_signature
  ) then
    raise exception 'invalid_asset_attestation' using errcode = '42501';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'cleanup_batch_too_large' using errcode = '22023';
  end if;

  return query
  with candidates as (
    select asset.id
    from public.assets asset
    where asset.processing_state = 'ready'
      and asset.publication_claimed_at < now() - interval '15 minutes'
    order by asset.publication_claimed_at, asset.id
    for update of asset skip locked
    limit p_limit
  )
  update public.assets asset
  set publication_claimed_at = now(),
      publication_claim_token = pg_catalog.gen_random_uuid()
  from candidates
  where asset.id = candidates.id
  returning asset.id,
    case
      when asset.purpose in ('project_image', 'credential_image')
        then asset.private_derivative_key
      else asset.object_key
    end,
    case
      when asset.purpose in ('project_image', 'credential_image')
        then asset.private_derivative_size_bytes
      else asset.size_bytes
    end,
    case
      when asset.purpose = 'credential_pdf' then asset.checksum_sha256
      else null
    end,
    asset.purpose::text,
    asset.publication_target_object_key,
    asset.publication_target_mime_type,
    asset.publication_claim_token;
end;
$$;

drop function public.revert_asset_publication(uuid, text, bigint, text);

create function public.claim_asset_public_revert(
  p_asset_id uuid,
  p_public_object_key text,
  p_attestation_timestamp bigint,
  p_attestation_signature text,
  p_administrator_id uuid default auth.uid()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_asset public.assets%rowtype;
  v_token uuid;
begin
  if p_administrator_id is null or not exists (
    select 1 from private.admin_users where user_id = p_administrator_id
  ) then
    raise exception 'admin_not_allowed' using errcode = '42501';
  end if;
  if not private.asset_mutation_attested(
    p_administrator_id,
    'revert_claim',
    p_attestation_timestamp,
    array[p_asset_id::text, coalesce(p_public_object_key, '')],
    p_attestation_signature
  ) then
    raise exception 'invalid_asset_attestation' using errcode = '42501';
  end if;

  select * into v_asset
  from public.assets
  where id = p_asset_id
  for update;
  if not found then
    raise exception 'asset_not_found' using errcode = 'P0002';
  end if;
  if v_asset.purpose = 'cv_pdf'
    or v_asset.processing_state <> 'published'
    or v_asset.publication_claimed_at is not null
  then
    raise exception 'asset_publication_cannot_be_reverted' using errcode = '55000';
  end if;

  if p_public_object_key is distinct from v_asset.public_object_key then
    raise exception 'asset_publication_cannot_be_reverted' using errcode = '55000';
  end if;
  if v_asset.public_revert_claimed_at is not null
    and v_asset.public_revert_claimed_at >= now() - interval '15 minutes'
  then
    return null;
  end if;
  if exists (
    select 1
    from public.projects project
    join public.project_publications publication
      on publication.id = project.current_publication_id
    where project.lifecycle_state = 'published'
      and publication.asset_manifest ? p_asset_id::text
  ) or exists (
    select 1
    from public.credentials credential
    join public.credential_publications publication
      on publication.id = credential.current_publication_id
    where credential.lifecycle_state = 'published'
      and publication.evidence ->> 'assetId' = p_asset_id::text
  ) then
    return null;
  end if;

  v_token := pg_catalog.gen_random_uuid();
  update public.assets
  set public_revert_claimed_at = now(),
      public_revert_claim_token = v_token
  where id = p_asset_id;
  return v_token;
end;
$$;

create function public.finish_asset_public_revert(
  p_asset_id uuid,
  p_public_object_key text,
  p_claim_token uuid,
  p_attestation_timestamp bigint,
  p_attestation_signature text,
  p_administrator_id uuid default auth.uid()
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_asset public.assets%rowtype;
begin
  if p_administrator_id is null or not exists (
    select 1 from private.admin_users where user_id = p_administrator_id
  ) then
    raise exception 'admin_not_allowed' using errcode = '42501';
  end if;
  if not private.asset_mutation_attested(
    p_administrator_id,
    'revert_finish',
    p_attestation_timestamp,
    array[
      p_asset_id::text,
      coalesce(p_public_object_key, ''),
      coalesce(p_claim_token::text, '')
    ],
    p_attestation_signature
  ) then
    raise exception 'invalid_asset_attestation' using errcode = '42501';
  end if;

  select * into v_asset
  from public.assets
  where id = p_asset_id
  for update;
  if not found then
    raise exception 'asset_not_found' using errcode = 'P0002';
  end if;
  if v_asset.public_revert_claimed_at is null
    or v_asset.public_revert_claim_token is distinct from p_claim_token
    or p_public_object_key is distinct from v_asset.public_object_key
  then
    raise exception 'asset_public_revert_not_claimed' using errcode = '55000';
  end if;

  update public.assets
  set processing_state = 'ready',
      visibility = 'private',
      public_object_key = null,
      public_mime_type = null,
      publication_permission_confirmed_at = null,
      public_revert_claimed_at = null,
      public_revert_claim_token = null
  where id = p_asset_id
    and public_revert_claim_token = p_claim_token;

  perform private.record_audit(
    p_administrator_id,
    'asset',
    p_asset_id,
    'publication_reverted',
    array['processing_state', 'visibility', 'public_object_key']
  );
  return true;
end;
$$;

create function public.release_asset_public_revert(
  p_asset_id uuid,
  p_public_object_key text,
  p_claim_token uuid,
  p_attestation_timestamp bigint,
  p_attestation_signature text,
  p_administrator_id uuid default auth.uid()
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows integer;
begin
  if p_administrator_id is null or not exists (
    select 1 from private.admin_users where user_id = p_administrator_id
  ) then
    raise exception 'admin_not_allowed' using errcode = '42501';
  end if;
  if not private.asset_mutation_attested(
    p_administrator_id,
    'revert_release',
    p_attestation_timestamp,
    array[
      p_asset_id::text,
      coalesce(p_public_object_key, ''),
      coalesce(p_claim_token::text, '')
    ],
    p_attestation_signature
  ) then
    raise exception 'invalid_asset_attestation' using errcode = '42501';
  end if;

  update public.assets
  set public_revert_claimed_at = null,
      public_revert_claim_token = null
  where id = p_asset_id
    and public_revert_claimed_at is not null
    and public_revert_claim_token = p_claim_token
    and p_public_object_key is not distinct from public_object_key;
  get diagnostics v_rows = row_count;
  return v_rows = 1;
end;
$$;

create function public.claim_stale_asset_public_reverts(
  p_limit integer,
  p_attestation_timestamp bigint,
  p_attestation_signature text,
  p_administrator_id uuid default auth.uid()
)
returns table (asset_id uuid, public_object_key text, claim_token uuid)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_administrator_id is null or not exists (
    select 1 from private.admin_users where user_id = p_administrator_id
  ) then
    raise exception 'admin_not_allowed' using errcode = '42501';
  end if;
  if not private.asset_mutation_attested(
    p_administrator_id,
    'revert_claim',
    p_attestation_timestamp,
    array[coalesce(p_limit::text, '')],
    p_attestation_signature
  ) then
    raise exception 'invalid_asset_attestation' using errcode = '42501';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'cleanup_batch_too_large' using errcode = '22023';
  end if;

  return query
  with candidates as (
    select asset.id
    from public.assets asset
    where asset.processing_state = 'published'
      and asset.public_revert_claimed_at < now() - interval '15 minutes'
      and not exists (
        select 1
        from public.projects project
        join public.project_publications publication
          on publication.id = project.current_publication_id
        where project.lifecycle_state = 'published'
          and publication.asset_manifest ? asset.id::text
      )
      and not exists (
        select 1
        from public.credentials credential
        join public.credential_publications publication
          on publication.id = credential.current_publication_id
        where credential.lifecycle_state = 'published'
          and publication.evidence ->> 'assetId' = asset.id::text
      )
    order by asset.public_revert_claimed_at, asset.id
    for update of asset skip locked
    limit p_limit
  )
  update public.assets asset
  set public_revert_claimed_at = now(),
      public_revert_claim_token = pg_catalog.gen_random_uuid()
  from candidates
  where asset.id = candidates.id
  returning asset.id, asset.public_object_key, asset.public_revert_claim_token;
end;
$$;

create function private.prevent_claimed_asset_publication()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_manifest jsonb;
  v_evidence jsonb;
begin
  if tg_table_name = 'projects' then
    select publication.asset_manifest into v_manifest
    from public.project_publications publication
    where publication.id = new.current_publication_id;

    perform 1
    from public.assets asset
    where asset.id in (
      select keys.key::uuid
      from pg_catalog.jsonb_object_keys(coalesce(v_manifest, '{}'::jsonb)) as keys(key)
    )
    for share;
    if exists (
      select 1
      from public.assets asset
      where asset.id in (
        select keys.key::uuid
        from pg_catalog.jsonb_object_keys(coalesce(v_manifest, '{}'::jsonb)) as keys(key)
      )
        and asset.public_revert_claimed_at is not null
    ) then
      raise exception 'project_asset_revert_in_progress' using errcode = '40001';
    end if;
  elsif tg_table_name = 'credentials' then
    select publication.evidence into v_evidence
    from public.credential_publications publication
    where publication.id = new.current_publication_id;

    if v_evidence ->> 'assetId' is not null then
      perform 1
      from public.assets asset
      where asset.id = (v_evidence ->> 'assetId')::uuid
      for share;
      if exists (
        select 1 from public.assets asset
        where asset.id = (v_evidence ->> 'assetId')::uuid
          and asset.public_revert_claimed_at is not null
      ) then
        raise exception 'credential_asset_revert_in_progress' using errcode = '40001';
      end if;
    end if;
  end if;
  return new;
end;
$$;

create trigger projects_block_claimed_asset_publication
before update of lifecycle_state, current_publication_id on public.projects
for each row
when (new.lifecycle_state = 'published')
execute function private.prevent_claimed_asset_publication();

create trigger credentials_block_claimed_asset_publication
before update of lifecycle_state, current_publication_id on public.credentials
for each row
when (new.lifecycle_state = 'published')
execute function private.prevent_claimed_asset_publication();

-- Coordinated no-rollback cutover: v1 is not deployed and external R2 is
-- inactive, so the old anonymous CV metadata RPC is intentionally removed.
drop function public.current_cv_download();
drop function public.set_current_cv(uuid);

alter table public.site_settings
  add constraint site_settings_current_cv_pointer_is_complete check (
    (current_cv_version_id is null) = (current_cv_generation is null)
    and current_cv_public_object_key = 'resume.pdf'
  );

create function public.claim_current_cv_transition(
  p_cv_version_id uuid,
  p_expected_cv_version_id uuid,
  p_generation uuid,
  p_checksum_sha256 text,
  p_expected_pointer_etag text,
  p_expected_pointer_absent boolean,
  p_attestation_timestamp bigint,
  p_attestation_signature text
)
returns table (
  claim_token uuid,
  cv_version_id uuid,
  object_key text,
  size_bytes bigint,
  checksum_sha256 text,
  generation uuid,
  expected_pointer_etag text,
  expected_pointer_absent boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_settings public.site_settings%rowtype;
  v_asset public.assets%rowtype;
  v_token uuid;
begin
  if not coalesce(private.is_admin(), false) then
    raise exception 'admin_not_allowed' using errcode = '42501';
  end if;
  if not private.asset_mutation_attested(
    v_actor,
    'cv_claim',
    p_attestation_timestamp,
    array[
      p_cv_version_id::text,
      coalesce(p_expected_cv_version_id::text, ''),
      coalesce(p_generation::text, ''),
      coalesce(p_checksum_sha256, ''),
      coalesce(p_expected_pointer_etag, ''),
      coalesce(p_expected_pointer_absent::text, '')
    ],
    p_attestation_signature
  ) then
    raise exception 'invalid_asset_attestation' using errcode = '42501';
  end if;
  if p_checksum_sha256 !~ '^[0-9a-f]{64}$'
    or p_generation is null
    or p_expected_pointer_absent is null
    or (
      p_expected_pointer_absent
      and p_expected_pointer_etag is not null
    )
    or (
      not p_expected_pointer_absent
      and (
        p_expected_pointer_etag is null
        or pg_catalog.length(p_expected_pointer_etag) not between 1 and 200
      )
    )
  then
    raise exception 'invalid_current_cv_metadata' using errcode = '22023';
  end if;
  select asset.* into v_asset
    from public.cv_versions cv
    join public.assets asset on asset.id = cv.asset_id
    where cv.id = p_cv_version_id
      and asset.purpose = 'cv_pdf'
      and asset.mime_type = 'application/pdf'
      and asset.processing_state = 'ready'
      and asset.visibility = 'private'
      and asset.checksum_sha256 = p_checksum_sha256;
  if not found then
    raise exception 'cv_version_not_ready' using errcode = '23514';
  end if;

  select * into v_settings
  from public.site_settings
  where singleton
  for update;
  if v_settings.current_cv_version_id is distinct from p_expected_cv_version_id then
    raise exception 'stale_current_cv' using errcode = '40001';
  end if;
  if v_settings.current_cv_transition_claimed_at is not null then
    raise exception 'current_cv_transition_busy' using errcode = '40001';
  end if;

  v_token := pg_catalog.gen_random_uuid();
  update public.site_settings
  set current_cv_transition_claimed_at = now(),
      current_cv_transition_token = v_token,
      current_cv_transition_version_id = p_cv_version_id,
      current_cv_transition_checksum = p_checksum_sha256,
      current_cv_transition_generation = p_generation,
      current_cv_transition_expected_pointer_etag = p_expected_pointer_etag,
      current_cv_transition_expected_pointer_absent = p_expected_pointer_absent,
      updated_by = v_actor,
      updated_at = now()
  where singleton;

  return query select
    v_token,
    p_cv_version_id,
    v_asset.object_key,
    v_asset.size_bytes,
    p_checksum_sha256,
    p_generation,
    p_expected_pointer_etag,
    p_expected_pointer_absent;
end;
$$;

create function public.confirm_current_cv_transition(
  p_claim_token uuid,
  p_attestation_timestamp bigint,
  p_attestation_signature text,
  p_administrator_id uuid default auth.uid()
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_administrator_id is null or not exists (
    select 1 from private.admin_users where user_id = p_administrator_id
  ) then
    raise exception 'admin_not_allowed' using errcode = '42501';
  end if;
  if not private.asset_mutation_attested(
    p_administrator_id,
    'cv_confirm',
    p_attestation_timestamp,
    array[coalesce(p_claim_token::text, '')],
    p_attestation_signature
  ) then
    raise exception 'invalid_asset_attestation' using errcode = '42501';
  end if;

  return exists (
    select 1
    from public.site_settings settings
    where settings.singleton
      and settings.current_cv_transition_token = p_claim_token
  );
end;
$$;

create function public.finish_current_cv_transition(
  p_cv_version_id uuid,
  p_generation uuid,
  p_checksum_sha256 text,
  p_claim_token uuid,
  p_attestation_timestamp bigint,
  p_attestation_signature text,
  p_administrator_id uuid default auth.uid()
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows integer;
begin
  if p_administrator_id is null or not exists (
    select 1 from private.admin_users where user_id = p_administrator_id
  ) then
    raise exception 'admin_not_allowed' using errcode = '42501';
  end if;
  if not private.asset_mutation_attested(
    p_administrator_id,
    'cv_finish',
    p_attestation_timestamp,
    array[
      p_cv_version_id::text,
      coalesce(p_generation::text, ''),
      coalesce(p_checksum_sha256, ''),
      coalesce(p_claim_token::text, '')
    ],
    p_attestation_signature
  ) then
    raise exception 'invalid_asset_attestation' using errcode = '42501';
  end if;

  update public.site_settings
  set current_cv_version_id = p_cv_version_id,
      current_cv_public_object_key = 'resume.pdf',
      current_cv_generation = p_generation,
      current_cv_transition_claimed_at = null,
      current_cv_transition_token = null,
      current_cv_transition_version_id = null,
      current_cv_transition_checksum = null,
      current_cv_transition_generation = null,
      current_cv_transition_expected_pointer_etag = null,
      current_cv_transition_expected_pointer_absent = null,
      updated_by = p_administrator_id,
      updated_at = now()
  where singleton
    and current_cv_transition_token = p_claim_token
    and current_cv_transition_version_id = p_cv_version_id
    and current_cv_transition_checksum = p_checksum_sha256
    and current_cv_transition_generation = p_generation;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'current_cv_transition_lost' using errcode = '40001';
  end if;

  perform private.record_audit(
    p_administrator_id,
    'cv',
    p_cv_version_id,
    'set_current',
    array['current_cv_version_id', 'current_cv_public_object_key', 'current_cv_generation']
  );
  return true;
end;
$$;

create function public.release_current_cv_transition(
  p_claim_token uuid,
  p_attestation_timestamp bigint,
  p_attestation_signature text,
  p_administrator_id uuid default auth.uid()
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows integer;
begin
  if p_administrator_id is null or not exists (
    select 1 from private.admin_users where user_id = p_administrator_id
  ) then
    raise exception 'admin_not_allowed' using errcode = '42501';
  end if;
  if not private.asset_mutation_attested(
    p_administrator_id,
    'cv_release',
    p_attestation_timestamp,
    array[coalesce(p_claim_token::text, '')],
    p_attestation_signature
  ) then
    raise exception 'invalid_asset_attestation' using errcode = '42501';
  end if;

  update public.site_settings
  set current_cv_transition_claimed_at = null,
      current_cv_transition_token = null,
      current_cv_transition_version_id = null,
      current_cv_transition_checksum = null,
      current_cv_transition_generation = null,
      current_cv_transition_expected_pointer_etag = null,
      current_cv_transition_expected_pointer_absent = null,
      updated_by = p_administrator_id,
      updated_at = now()
  where singleton
    and current_cv_transition_token = p_claim_token;
  get diagnostics v_rows = row_count;
  return v_rows = 1;
end;
$$;

create function public.claim_stale_current_cv_transition(
  p_attestation_timestamp bigint,
  p_attestation_signature text,
  p_administrator_id uuid default auth.uid()
)
returns table (
  claim_token uuid,
  cv_version_id uuid,
  object_key text,
  size_bytes bigint,
  checksum_sha256 text,
  generation uuid,
  expected_pointer_etag text,
  expected_pointer_absent boolean
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_administrator_id is null or not exists (
    select 1 from private.admin_users where user_id = p_administrator_id
  ) then
    raise exception 'admin_not_allowed' using errcode = '42501';
  end if;
  if not private.asset_mutation_attested(
    p_administrator_id,
    'cv_recover',
    p_attestation_timestamp,
    array['current-cv.json'],
    p_attestation_signature
  ) then
    raise exception 'invalid_asset_attestation' using errcode = '42501';
  end if;

  return query
  with claimed as (
    update public.site_settings settings
    set current_cv_transition_claimed_at = now(),
        current_cv_transition_token = pg_catalog.gen_random_uuid(),
        updated_by = p_administrator_id,
        updated_at = now()
    where settings.singleton
      and settings.current_cv_transition_claimed_at < now() - interval '15 minutes'
    returning settings.current_cv_transition_token,
      settings.current_cv_transition_version_id,
      settings.current_cv_transition_checksum,
      settings.current_cv_transition_generation,
      settings.current_cv_transition_expected_pointer_etag,
      settings.current_cv_transition_expected_pointer_absent
  )
  select claimed.current_cv_transition_token,
    claimed.current_cv_transition_version_id,
    asset.object_key,
    asset.size_bytes,
    claimed.current_cv_transition_checksum,
    claimed.current_cv_transition_generation,
    claimed.current_cv_transition_expected_pointer_etag,
    claimed.current_cv_transition_expected_pointer_absent
  from claimed
  join public.cv_versions cv on cv.id = claimed.current_cv_transition_version_id
  join public.assets asset on asset.id = cv.asset_id
  where asset.purpose = 'cv_pdf'
    and asset.mime_type = 'application/pdf'
    and asset.processing_state = 'ready'
    and asset.visibility = 'private'
    and asset.checksum_sha256 = claimed.current_cv_transition_checksum;
end;
$$;

revoke execute on function public.claim_pending_assets_for_cleanup(integer, bigint, text, uuid)
from public, anon, authenticated, service_role;
revoke execute on function public.finish_pending_asset_cleanup(uuid[], uuid[], bigint, text, uuid)
from public, anon, authenticated, service_role;
revoke execute on function public.release_pending_asset_cleanup(uuid[], uuid[], bigint, text, uuid)
from public, anon, authenticated, service_role;
revoke execute on function public.claim_asset_publication(uuid, text, text, bigint, text, uuid)
from public, anon, authenticated, service_role;
revoke execute on function public.finish_asset_publication(uuid, text, text, uuid, bigint, text, uuid)
from public, anon, authenticated, service_role;
revoke execute on function public.release_asset_publication(uuid, uuid, bigint, text, uuid)
from public, anon, authenticated, service_role;
revoke execute on function public.claim_stale_asset_publications(integer, bigint, text, uuid)
from public, anon, authenticated, service_role;
revoke execute on function public.claim_asset_public_revert(uuid, text, bigint, text, uuid)
from public, anon, authenticated, service_role;
revoke execute on function public.finish_asset_public_revert(uuid, text, uuid, bigint, text, uuid)
from public, anon, authenticated, service_role;
revoke execute on function public.release_asset_public_revert(uuid, text, uuid, bigint, text, uuid)
from public, anon, authenticated, service_role;
revoke execute on function public.claim_stale_asset_public_reverts(integer, bigint, text, uuid)
from public, anon, authenticated, service_role;
revoke execute on function public.claim_current_cv_transition(uuid, uuid, uuid, text, text, boolean, bigint, text)
from public, anon, authenticated, service_role;
revoke execute on function public.confirm_current_cv_transition(uuid, bigint, text, uuid)
from public, anon, authenticated, service_role;
revoke execute on function public.finish_current_cv_transition(uuid, uuid, text, uuid, bigint, text, uuid)
from public, anon, authenticated, service_role;
revoke execute on function public.release_current_cv_transition(uuid, bigint, text, uuid)
from public, anon, authenticated, service_role;
revoke execute on function public.claim_stale_current_cv_transition(bigint, text, uuid)
from public, anon, authenticated, service_role;
revoke execute on function private.prevent_claimed_asset_publication() from public;

grant execute on function public.claim_pending_assets_for_cleanup(integer, bigint, text, uuid)
to anon, authenticated;
grant execute on function public.finish_pending_asset_cleanup(uuid[], uuid[], bigint, text, uuid)
to anon, authenticated;
grant execute on function public.release_pending_asset_cleanup(uuid[], uuid[], bigint, text, uuid)
to anon, authenticated;
grant execute on function public.claim_asset_publication(uuid, text, text, bigint, text, uuid)
to authenticated;
grant execute on function public.finish_asset_publication(uuid, text, text, uuid, bigint, text, uuid)
to anon, authenticated;
grant execute on function public.release_asset_publication(uuid, uuid, bigint, text, uuid)
to authenticated;
grant execute on function public.claim_stale_asset_publications(integer, bigint, text, uuid)
to anon, authenticated;
grant execute on function public.claim_asset_public_revert(uuid, text, bigint, text, uuid)
to authenticated;
grant execute on function public.finish_asset_public_revert(uuid, text, uuid, bigint, text, uuid)
to anon, authenticated;
grant execute on function public.release_asset_public_revert(uuid, text, uuid, bigint, text, uuid)
to anon, authenticated;
grant execute on function public.claim_stale_asset_public_reverts(integer, bigint, text, uuid)
to anon, authenticated;
grant execute on function public.claim_current_cv_transition(uuid, uuid, uuid, text, text, boolean, bigint, text)
to authenticated;
grant execute on function public.confirm_current_cv_transition(uuid, bigint, text, uuid)
to anon, authenticated;
grant execute on function public.finish_current_cv_transition(uuid, uuid, text, uuid, bigint, text, uuid)
to anon, authenticated;
grant execute on function public.release_current_cv_transition(uuid, bigint, text, uuid)
to authenticated;
grant execute on function public.claim_stale_current_cv_transition(bigint, text, uuid)
to anon, authenticated;

commit;
