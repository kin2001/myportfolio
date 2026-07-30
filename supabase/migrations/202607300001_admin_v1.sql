begin;

create schema if not exists private;
revoke all on schema private from public;

create function private.valid_project_document(
  p_document jsonb,
  p_require_publishable boolean
)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  with blocks as (
    select value as block
    from pg_catalog.jsonb_array_elements(
      case
        when pg_catalog.jsonb_typeof(p_document) = 'array' then p_document
        else '[]'::jsonb
      end
    )
  )
  select coalesce(
    pg_catalog.jsonb_typeof(p_document) = 'array'
    and not exists (
      select 1
      from blocks
      where pg_catalog.jsonb_typeof(block) <> 'object'
        or pg_catalog.jsonb_typeof(block -> 'id') is distinct from 'string'
        or pg_catalog.btrim(block ->> 'id') = ''
        or coalesce(block ->> 'type', '') not in ('text', 'image')
        or (
          block ->> 'type' = 'text'
          and (
            pg_catalog.jsonb_typeof(block -> 'body') is distinct from 'string'
            or coalesce(block ->> 'format', '') not in ('paragraph', 'bullets', 'numbered', 'code')
            or (
              block ? 'heading'
              and pg_catalog.jsonb_typeof(block -> 'heading') is distinct from 'string'
            )
            or (
              block ? 'language'
              and pg_catalog.jsonb_typeof(block -> 'language') is distinct from 'string'
            )
          )
        )
        or (
          block ->> 'type' = 'image'
          and (
            pg_catalog.jsonb_typeof(block -> 'assetId') is distinct from 'string'
            or (block ->> 'assetId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
            or pg_catalog.jsonb_typeof(block -> 'alt') is distinct from 'string'
            or (
              block ? 'caption'
              and pg_catalog.jsonb_typeof(block -> 'caption') is distinct from 'string'
            )
          )
        )
    )
    and (
      select pg_catalog.count(*) = pg_catalog.count(distinct block ->> 'id')
      from blocks
    )
    and (
      not p_require_publishable
      or exists (
        select 1
        from blocks
        where block ->> 'type' = 'text'
          and pg_catalog.btrim(block ->> 'body') <> ''
      )
    )
    and (
      not p_require_publishable
      or not exists (
        select 1
        from blocks
        where block ->> 'type' = 'image'
          and pg_catalog.btrim(block ->> 'alt') = ''
      )
    ),
    false
  );
$$;

create function private.valid_project_links(p_links jsonb)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  with links as (
    select value as link
    from pg_catalog.jsonb_array_elements(
      case
        when pg_catalog.jsonb_typeof(p_links) = 'array' then p_links
        else '[]'::jsonb
      end
    )
  )
  select coalesce(
    pg_catalog.jsonb_typeof(p_links) = 'array'
    and not exists (
      select 1
      from links
      where pg_catalog.jsonb_typeof(link) <> 'object'
        or pg_catalog.jsonb_typeof(link -> 'id') is distinct from 'string'
        or pg_catalog.btrim(link ->> 'id') = ''
        or pg_catalog.jsonb_typeof(link -> 'label') is distinct from 'string'
        or pg_catalog.btrim(link ->> 'label') = ''
        or pg_catalog.jsonb_typeof(link -> 'url') is distinct from 'string'
        or (link ->> 'url') !~ '^https://[^[:space:]]+$'
        or coalesce(link ->> 'kind', '') not in (
          'github',
          'demo',
          'video',
          'file',
          'documentation',
          'other'
        )
    )
    and (
      select pg_catalog.count(*) = pg_catalog.count(distinct link ->> 'id')
      from links
    ),
    false
  );
$$;

create function private.project_excerpt(p_document jsonb)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select pg_catalog.left(
    pg_catalog.btrim(
      pg_catalog.regexp_replace(
        pg_catalog.regexp_replace(
          pg_catalog.regexp_replace(block ->> 'body', '<[^>]*>', ' ', 'g'),
          '[#*_`>\[\]()]',
          ' ',
          'g'
        ),
        '[[:space:]]+',
        ' ',
        'g'
      )
    ),
    180
  )
  from pg_catalog.jsonb_array_elements(p_document) with ordinality as blocks(block, position)
  where block ->> 'type' = 'text'
    and pg_catalog.btrim(block ->> 'body') <> ''
  order by position
  limit 1;
$$;

create function private.slug_base(p_value text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(
    nullif(
      pg_catalog.btrim(
        pg_catalog.regexp_replace(pg_catalog.lower(p_value), '[^a-z0-9]+', '-', 'g'),
        '-'
      ),
      ''
    ),
    'project'
  );
$$;

create table private.admin_users (
  slot smallint primary key check (slot in (1, 2)),
  user_id uuid not null unique references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

comment on table private.admin_users is
  'Exactly two immutable Supabase user UUID slots. Populate only after both approved Google accounts sign in.';

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  object_key text not null unique check (pg_catalog.btrim(object_key) <> ''),
  public_object_key text unique,
  mime_type text not null check (
    mime_type in (
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/avif',
      'application/pdf'
    )
  ),
  width integer,
  height integer,
  size_bytes bigint not null check (size_bytes > 0),
  checksum_sha256 text check (checksum_sha256 ~ '^[0-9a-f]{64}$'),
  processing_state text not null default 'pending' check (
    processing_state in ('pending', 'ready', 'published')
  ),
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  owner_id uuid not null references auth.users(id) on delete restrict,
  publication_permission_confirmed_at timestamptz,
  validated_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    size_bytes <= case
      when mime_type = 'application/pdf' then 10485760
      else 8388608
    end
  ),
  check (
    processing_state = 'pending'
    or (
      validated_at is not null
      and checksum_sha256 is not null
      and (
        (
          mime_type = 'application/pdf'
          and width is null
          and height is null
        )
        or (
          mime_type like 'image/%'
          and width > 0
          and height > 0
          and pg_catalog.greatest(width, height) <= 2400
        )
      )
    )
  ),
  check (
    processing_state <> 'pending'
    or (visibility = 'private' and public_object_key is null)
  ),
  check (
    processing_state <> 'published'
    or (
      visibility = 'public'
      and public_object_key is not null
      and pg_catalog.btrim(public_object_key) <> ''
    )
  )
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  lifecycle_state text not null default 'draft' check (
    lifecycle_state in ('draft', 'published', 'archived')
  ),
  display_order integer not null default 0 check (display_order >= 0),
  current_publication_id uuid unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  first_published_at timestamptz
);

comment on table public.projects is
  'Public-safe identity/order index only; mutable project content belongs in project_drafts.';

create table public.project_drafts (
  project_id uuid primary key references public.projects(id) on delete restrict,
  title text not null check (pg_catalog.btrim(title) <> ''),
  document jsonb not null default '[]'::jsonb check (
    private.valid_project_document(document, false)
  ),
  cover_asset_id uuid references public.assets(id) on delete restrict,
  links jsonb not null default '[]'::jsonb check (private.valid_project_links(links)),
  lock_version bigint not null default 1 check (lock_version > 0),
  updated_by uuid not null references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now()
);

create table public.project_publications (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  version bigint not null check (version > 0),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (pg_catalog.btrim(title) <> ''),
  excerpt text not null check (pg_catalog.btrim(excerpt) <> ''),
  document jsonb not null check (private.valid_project_document(document, true)),
  cover jsonb check (cover is null or pg_catalog.jsonb_typeof(cover) = 'object'),
  links jsonb not null default '[]'::jsonb check (private.valid_project_links(links)),
  asset_manifest jsonb not null default '{}'::jsonb check (
    pg_catalog.jsonb_typeof(asset_manifest) = 'object'
  ),
  published_at timestamptz not null default now(),
  unique (project_id, version)
);

comment on column public.project_publications.asset_manifest is
  'Immutable public derivative metadata; the assets table itself is never anonymously readable.';

alter table public.projects
  add constraint projects_current_publication_fk
  foreign key (current_publication_id)
  references public.project_publications(id)
  on delete restrict;

create table public.credentials (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (pg_catalog.btrim(name) <> ''),
  issuer text not null default '',
  issue_date date,
  expiry_date date,
  skills text[] not null default '{}',
  related_project_id uuid references public.projects(id) on delete restrict,
  verification_url text check (
    verification_url is null or verification_url ~ '^https://[^[:space:]]+$'
  ),
  evidence_asset_id uuid references public.assets(id) on delete restrict,
  evidence_visibility text not null default 'private' check (
    evidence_visibility in ('private', 'public')
  ),
  evidence_alt text,
  redaction_confirmed boolean not null default false,
  lifecycle_state text not null default 'draft' check (
    lifecycle_state in ('draft', 'published', 'archived')
  ),
  current_publication_id uuid unique,
  lock_version bigint not null default 1 check (lock_version > 0),
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  first_published_at timestamptz,
  check (expiry_date is null or issue_date is null or expiry_date >= issue_date)
);

create table public.credential_publications (
  id uuid primary key default gen_random_uuid(),
  credential_id uuid not null references public.credentials(id) on delete restrict,
  version bigint not null check (version > 0),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (pg_catalog.btrim(name) <> ''),
  issuer text not null check (pg_catalog.btrim(issuer) <> ''),
  issue_date date not null,
  expiry_date date,
  skills text[] not null default '{}',
  related_project_id uuid references public.projects(id) on delete restrict,
  verification_url text check (
    verification_url is null or verification_url ~ '^https://[^[:space:]]+$'
  ),
  evidence_visibility text not null check (
    evidence_visibility in ('none', 'private', 'public')
  ),
  evidence jsonb check (evidence is null or pg_catalog.jsonb_typeof(evidence) = 'object'),
  published_at timestamptz not null default now(),
  unique (credential_id, version),
  check (expiry_date is null or expiry_date >= issue_date),
  check (verification_url is not null or evidence_visibility <> 'none'),
  check (
    (evidence_visibility = 'public' and evidence is not null)
    or (evidence_visibility <> 'public' and evidence is null)
  )
);

alter table public.credentials
  add constraint credentials_current_publication_fk
  foreign key (current_publication_id)
  references public.credential_publications(id)
  on delete restrict;

create table public.cv_versions (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null unique references public.assets(id) on delete restrict,
  original_filename text not null check (pg_catalog.btrim(original_filename) <> ''),
  size_bytes bigint not null check (size_bytes between 1 and 10485760),
  version_note text,
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  uploaded_at timestamptz not null default now()
);

create table public.site_settings (
  singleton boolean primary key default true check (singleton),
  current_cv_version_id uuid references public.cv_versions(id) on delete restrict,
  current_cv_public_object_key text not null default 'resume.pdf' check (
    pg_catalog.btrim(current_cv_public_object_key) <> ''
  ),
  updated_by uuid references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now()
);

insert into public.site_settings (singleton) values (true);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  administrator_id uuid not null references auth.users(id) on delete restrict,
  entity_type text not null check (pg_catalog.btrim(entity_type) <> ''),
  entity_id uuid,
  action text not null check (pg_catalog.btrim(action) <> ''),
  changed_fields text[] not null default '{}',
  occurred_at timestamptz not null default now()
);

create table public.deployment_checks (
  id uuid primary key default gen_random_uuid(),
  deployment_url text not null check (deployment_url ~ '^https://[^[:space:]]+$'),
  git_sha text not null check (git_sha ~ '^[0-9a-fA-F]{7,64}$'),
  run_id text not null unique check (pg_catalog.btrim(run_id) <> ''),
  run_number bigint not null check (run_number > 0),
  result text not null check (result in ('passed', 'failed')),
  broken_link_count integer not null default 0 check (broken_link_count >= 0),
  missing_asset_count integer not null default 0 check (missing_asset_count >= 0),
  page_error_count integer not null default 0 check (page_error_count >= 0),
  console_error_count integer not null default 0 check (console_error_count >= 0),
  run_url text not null check (run_url ~ '^https://[^[:space:]]+$'),
  checked_at timestamptz not null,
  received_at timestamptz not null default now(),
  check (
    result = 'failed'
    or (
      broken_link_count = 0
      and missing_asset_count = 0
      and page_error_count = 0
      and console_error_count = 0
    )
  )
);

create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.admin_users
    where user_id = auth.uid()
  );
$$;

create function private.is_current_credential_publication(p_publication_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.credentials
    where lifecycle_state = 'published'
      and current_publication_id = p_publication_id
  );
$$;

create function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_admin();
$$;

create function private.reject_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% is immutable', tg_table_schema || '.' || tg_table_name
    using errcode = '55000';
end;
$$;

create function private.protect_asset_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.processing_state = 'published' then
    raise exception 'published_asset_is_immutable' using errcode = '55000';
  end if;

  if old.processing_state = 'ready' then
    if new.processing_state not in ('ready', 'published') then
      raise exception 'asset_state_cannot_regress' using errcode = '55000';
    end if;
    if new.object_key is distinct from old.object_key
      or new.mime_type is distinct from old.mime_type
      or new.width is distinct from old.width
      or new.height is distinct from old.height
      or new.size_bytes is distinct from old.size_bytes
      or new.checksum_sha256 is distinct from old.checksum_sha256
      or new.owner_id is distinct from old.owner_id
      or new.validated_at is distinct from old.validated_at
    then
      raise exception 'validated_asset_metadata_is_immutable' using errcode = '55000';
    end if;
  end if;

  if exists (
    select 1 from public.cv_versions where asset_id = old.id
  ) and (
    new.processing_state <> 'ready'
    or new.visibility <> 'private'
    or new.public_object_key is not null
  ) then
    raise exception 'cv_version_asset_must_remain_private' using errcode = '55000';
  end if;

  return new;
end;
$$;

create function private.lock_published_slug()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.current_publication_id is not null and new.slug is distinct from old.slug then
    raise exception 'slug_locked_after_publication' using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger project_publications_are_immutable
before update or delete on public.project_publications
for each row execute function private.reject_mutation();

create trigger credential_publications_are_immutable
before update or delete on public.credential_publications
for each row execute function private.reject_mutation();

create trigger cv_versions_are_immutable
before update or delete on public.cv_versions
for each row execute function private.reject_mutation();

create trigger audit_events_are_append_only
before update or delete on public.audit_events
for each row execute function private.reject_mutation();

create trigger deployment_checks_are_append_only
before update or delete on public.deployment_checks
for each row execute function private.reject_mutation();

create trigger assets_follow_forward_only_state
before update on public.assets
for each row execute function private.protect_asset_update();

create trigger project_slugs_lock_after_publication
before update of slug on public.projects
for each row execute function private.lock_published_slug();

create trigger credential_slugs_lock_after_publication
before update of slug on public.credentials
for each row execute function private.lock_published_slug();

create function private.record_audit(
  p_actor uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_action text,
  p_changed_fields text[]
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_events (
    administrator_id,
    entity_type,
    entity_id,
    action,
    changed_fields
  )
  values (
    p_actor,
    p_entity_type,
    p_entity_id,
    p_action,
    coalesce(p_changed_fields, '{}'::text[])
  );
$$;

create function public.create_project(p_title text)
returns public.project_drafts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_project_id uuid := pg_catalog.gen_random_uuid();
  v_base text;
  v_slug text;
  v_suffix integer := 1;
  v_draft public.project_drafts%rowtype;
begin
  if not coalesce(private.is_admin(), false) then
    raise exception 'admin_not_allowed' using errcode = '42501';
  end if;
  if pg_catalog.btrim(coalesce(p_title, '')) = '' then
    raise exception 'title_required' using errcode = '22023';
  end if;

  v_base := private.slug_base(p_title);
  loop
    v_slug := case when v_suffix = 1 then v_base else v_base || '-' || v_suffix end;
    begin
      insert into public.projects (id, slug)
      values (v_project_id, v_slug);
      exit;
    exception when unique_violation then
      v_suffix := v_suffix + 1;
    end;
  end loop;

  insert into public.project_drafts (project_id, title, updated_by)
  values (v_project_id, pg_catalog.btrim(p_title), v_actor)
  returning * into v_draft;

  perform private.record_audit(v_actor, 'project', v_project_id, 'created', array['title']);
  return v_draft;
end;
$$;

create function public.save_project_draft(
  p_project_id uuid,
  p_expected_lock_version bigint,
  p_title text,
  p_document jsonb,
  p_cover_asset_id uuid,
  p_links jsonb
)
returns public.project_drafts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_project public.projects%rowtype;
  v_old public.project_drafts%rowtype;
  v_saved public.project_drafts%rowtype;
  v_changed text[];
  v_base text;
  v_slug text;
  v_suffix integer := 1;
begin
  if not coalesce(private.is_admin(), false) then
    raise exception 'admin_not_allowed' using errcode = '42501';
  end if;
  if pg_catalog.btrim(coalesce(p_title, '')) = '' then
    raise exception 'title_required' using errcode = '22023';
  end if;
  if not private.valid_project_document(p_document, false) then
    raise exception 'invalid_document' using errcode = '22023';
  end if;
  if not private.valid_project_links(p_links) then
    raise exception 'invalid_links' using errcode = '22023';
  end if;

  select * into v_project
  from public.projects
  where id = p_project_id
  for update;
  if not found then
    raise exception 'project_not_found' using errcode = 'P0002';
  end if;

  select * into v_old
  from public.project_drafts
  where project_id = p_project_id
  for update;
  if not found then
    raise exception 'project_draft_not_found' using errcode = 'P0002';
  end if;
  if v_old.lock_version is distinct from p_expected_lock_version then
    raise exception 'stale_lock_version' using errcode = '40001';
  end if;

  if p_cover_asset_id is not null and not exists (
    select 1 from public.assets where id = p_cover_asset_id
  ) then
    raise exception 'cover_asset_not_found' using errcode = '23503';
  end if;

  if v_project.current_publication_id is null then
    v_base := private.slug_base(p_title);
    loop
      v_slug := case when v_suffix = 1 then v_base else v_base || '-' || v_suffix end;
      begin
        update public.projects
        set slug = v_slug, updated_at = now()
        where id = p_project_id;
        exit;
      exception when unique_violation then
        v_suffix := v_suffix + 1;
      end;
    end loop;
  end if;

  v_changed := pg_catalog.array_remove(array[
    case when v_old.title is distinct from pg_catalog.btrim(p_title) then 'title' end,
    case when v_old.document is distinct from p_document then 'document' end,
    case when v_old.cover_asset_id is distinct from p_cover_asset_id then 'cover_asset_id' end,
    case when v_old.links is distinct from p_links then 'links' end
  ]::text[], null);

  update public.project_drafts
  set title = pg_catalog.btrim(p_title),
      document = p_document,
      cover_asset_id = p_cover_asset_id,
      links = p_links,
      lock_version = lock_version + 1,
      updated_by = v_actor,
      updated_at = now()
  where project_id = p_project_id
  returning * into v_saved;

  perform private.record_audit(v_actor, 'project', p_project_id, 'draft_saved', v_changed);
  return v_saved;
end;
$$;

create function public.publish_project(
  p_project_id uuid,
  p_expected_lock_version bigint
)
returns public.project_publications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_project public.projects%rowtype;
  v_draft public.project_drafts%rowtype;
  v_publication public.project_publications%rowtype;
  v_version bigint;
  v_manifest jsonb;
  v_cover jsonb;
begin
  if not coalesce(private.is_admin(), false) then
    raise exception 'admin_not_allowed' using errcode = '42501';
  end if;

  select * into v_project
  from public.projects
  where id = p_project_id
  for update;
  if not found then
    raise exception 'project_not_found' using errcode = 'P0002';
  end if;

  select * into v_draft
  from public.project_drafts
  where project_id = p_project_id;
  if not found then
    raise exception 'project_draft_not_found' using errcode = 'P0002';
  end if;
  if v_draft.lock_version is distinct from p_expected_lock_version then
    raise exception 'stale_lock_version' using errcode = '40001';
  end if;
  if pg_catalog.btrim(v_draft.title) = ''
    or not private.valid_project_document(v_draft.document, true)
    or not private.valid_project_links(v_draft.links)
  then
    raise exception 'project_not_publishable' using errcode = '23514';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(v_draft.document) as blocks(block)
    left join public.assets asset
      on asset.id = case
        when block ->> 'type' = 'image' then (block ->> 'assetId')::uuid
        else null
      end
    where block ->> 'type' = 'image'
      and (
        asset.id is null
        or asset.mime_type not like 'image/%'
        or asset.processing_state <> 'published'
        or asset.visibility <> 'public'
        or asset.public_object_key is null
        or asset.publication_permission_confirmed_at is null
      )
  ) then
    raise exception 'document_asset_not_publishable' using errcode = '23514';
  end if;

  if v_draft.cover_asset_id is not null and not exists (
    select 1
    from public.assets
    where id = v_draft.cover_asset_id
      and mime_type like 'image/%'
      and processing_state = 'published'
      and visibility = 'public'
      and public_object_key is not null
      and publication_permission_confirmed_at is not null
  ) then
    raise exception 'cover_asset_not_publishable' using errcode = '23514';
  end if;

  select coalesce(
    pg_catalog.jsonb_object_agg(
      asset.id::text,
      pg_catalog.jsonb_strip_nulls(
        pg_catalog.jsonb_build_object(
          'assetId', asset.id,
          'objectKey', asset.public_object_key,
          'mimeType', asset.mime_type,
          'width', asset.width,
          'height', asset.height,
          'sizeBytes', asset.size_bytes,
          'checksumSha256', asset.checksum_sha256
        )
      )
      order by asset.id
    ),
    '{}'::jsonb
  )
  into v_manifest
  from public.assets asset
  where asset.id in (
    select case
      when block ->> 'type' = 'image' then (block ->> 'assetId')::uuid
      else null
    end
    from pg_catalog.jsonb_array_elements(v_draft.document) as blocks(block)
    where block ->> 'type' = 'image'
    union
    select v_draft.cover_asset_id
    where v_draft.cover_asset_id is not null
  );

  v_cover := case
    when v_draft.cover_asset_id is null then null
    else v_manifest -> v_draft.cover_asset_id::text
  end;

  select coalesce(pg_catalog.max(version), 0) + 1
  into v_version
  from public.project_publications
  where project_id = p_project_id;

  insert into public.project_publications (
    project_id,
    version,
    slug,
    title,
    excerpt,
    document,
    cover,
    links,
    asset_manifest
  )
  values (
    p_project_id,
    v_version,
    v_project.slug,
    v_draft.title,
    private.project_excerpt(v_draft.document),
    v_draft.document,
    v_cover,
    v_draft.links,
    v_manifest
  )
  returning * into v_publication;

  update public.projects
  set lifecycle_state = 'published',
      current_publication_id = v_publication.id,
      first_published_at = coalesce(first_published_at, v_publication.published_at),
      updated_at = now()
  where id = p_project_id;

  perform private.record_audit(
    v_actor,
    'project',
    p_project_id,
    'published',
    array['current_publication_id', 'lifecycle_state']
  );
  return v_publication;
end;
$$;

create function public.archive_project(p_project_id uuid)
returns public.projects
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_project public.projects%rowtype;
begin
  if not coalesce(private.is_admin(), false) then
    raise exception 'admin_not_allowed' using errcode = '42501';
  end if;

  update public.projects
  set lifecycle_state = 'archived',
      updated_at = now()
  where id = p_project_id
  returning * into v_project;
  if not found then
    raise exception 'project_not_found' using errcode = 'P0002';
  end if;

  perform private.record_audit(
    v_actor,
    'project',
    p_project_id,
    'archived',
    array['lifecycle_state']
  );
  return v_project;
end;
$$;

create function public.set_project_order(p_project_id uuid, p_display_order integer)
returns public.projects
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_project public.projects%rowtype;
begin
  if not coalesce(private.is_admin(), false) then
    raise exception 'admin_not_allowed' using errcode = '42501';
  end if;
  if p_display_order is null or p_display_order < 0 then
    raise exception 'invalid_display_order' using errcode = '22023';
  end if;

  update public.projects
  set display_order = p_display_order,
      updated_at = now()
  where id = p_project_id
  returning * into v_project;
  if not found then
    raise exception 'project_not_found' using errcode = 'P0002';
  end if;

  perform private.record_audit(
    v_actor,
    'project',
    p_project_id,
    'reordered',
    array['display_order']
  );
  return v_project;
end;
$$;

create function public.create_credential(p_name text)
returns public.credentials
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_id uuid := pg_catalog.gen_random_uuid();
  v_base text;
  v_slug text;
  v_suffix integer := 1;
  v_credential public.credentials%rowtype;
begin
  if not coalesce(private.is_admin(), false) then
    raise exception 'admin_not_allowed' using errcode = '42501';
  end if;
  if pg_catalog.btrim(coalesce(p_name, '')) = '' then
    raise exception 'credential_name_required' using errcode = '22023';
  end if;

  v_base := private.slug_base(p_name);
  loop
    v_slug := case when v_suffix = 1 then v_base else v_base || '-' || v_suffix end;
    begin
      insert into public.credentials (
        id,
        slug,
        name,
        created_by,
        updated_by
      )
      values (
        v_id,
        v_slug,
        pg_catalog.btrim(p_name),
        v_actor,
        v_actor
      )
      returning * into v_credential;
      exit;
    exception when unique_violation then
      v_suffix := v_suffix + 1;
    end;
  end loop;

  perform private.record_audit(v_actor, 'credential', v_id, 'created', array['name']);
  return v_credential;
end;
$$;

create function public.save_credential(
  p_credential_id uuid,
  p_expected_lock_version bigint,
  p_name text,
  p_issuer text,
  p_issue_date date,
  p_expiry_date date,
  p_skills text[],
  p_related_project_id uuid,
  p_verification_url text,
  p_evidence_asset_id uuid,
  p_evidence_visibility text,
  p_evidence_alt text,
  p_redaction_confirmed boolean
)
returns public.credentials
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_old public.credentials%rowtype;
  v_saved public.credentials%rowtype;
  v_changed text[];
  v_base text;
  v_slug text;
  v_suffix integer := 1;
begin
  if not coalesce(private.is_admin(), false) then
    raise exception 'admin_not_allowed' using errcode = '42501';
  end if;
  if pg_catalog.btrim(coalesce(p_name, '')) = '' then
    raise exception 'credential_name_required' using errcode = '22023';
  end if;
  if p_verification_url is not null and p_verification_url !~ '^https://[^[:space:]]+$' then
    raise exception 'verification_url_must_be_https' using errcode = '22023';
  end if;
  if coalesce(p_evidence_visibility, '') not in ('private', 'public') then
    raise exception 'invalid_evidence_visibility' using errcode = '22023';
  end if;
  if p_expiry_date is not null and p_issue_date is not null and p_expiry_date < p_issue_date then
    raise exception 'expiry_before_issue_date' using errcode = '22023';
  end if;

  select * into v_old
  from public.credentials
  where id = p_credential_id
  for update;
  if not found then
    raise exception 'credential_not_found' using errcode = 'P0002';
  end if;
  if v_old.lock_version is distinct from p_expected_lock_version then
    raise exception 'stale_lock_version' using errcode = '40001';
  end if;
  if p_related_project_id is not null and not exists (
    select 1 from public.projects where id = p_related_project_id
  ) then
    raise exception 'related_project_not_found' using errcode = '23503';
  end if;
  if p_evidence_asset_id is not null and not exists (
    select 1 from public.assets where id = p_evidence_asset_id
  ) then
    raise exception 'evidence_asset_not_found' using errcode = '23503';
  end if;

  if v_old.current_publication_id is null then
    v_base := private.slug_base(p_name);
    loop
      v_slug := case when v_suffix = 1 then v_base else v_base || '-' || v_suffix end;
      begin
        update public.credentials set slug = v_slug where id = p_credential_id;
        exit;
      exception when unique_violation then
        v_suffix := v_suffix + 1;
      end;
    end loop;
  end if;

  v_changed := pg_catalog.array_remove(array[
    case when v_old.name is distinct from pg_catalog.btrim(p_name) then 'name' end,
    case when v_old.issuer is distinct from coalesce(pg_catalog.btrim(p_issuer), '') then 'issuer' end,
    case when v_old.issue_date is distinct from p_issue_date then 'issue_date' end,
    case when v_old.expiry_date is distinct from p_expiry_date then 'expiry_date' end,
    case when v_old.skills is distinct from coalesce(p_skills, '{}'::text[]) then 'skills' end,
    case when v_old.related_project_id is distinct from p_related_project_id then 'related_project_id' end,
    case when v_old.verification_url is distinct from p_verification_url then 'verification_url' end,
    case when v_old.evidence_asset_id is distinct from p_evidence_asset_id then 'evidence_asset_id' end,
    case when v_old.evidence_visibility is distinct from p_evidence_visibility then 'evidence_visibility' end,
    case when v_old.evidence_alt is distinct from p_evidence_alt then 'evidence_alt' end,
    case when v_old.redaction_confirmed is distinct from coalesce(p_redaction_confirmed, false) then 'redaction_confirmed' end
  ]::text[], null);

  update public.credentials
  set name = pg_catalog.btrim(p_name),
      issuer = coalesce(pg_catalog.btrim(p_issuer), ''),
      issue_date = p_issue_date,
      expiry_date = p_expiry_date,
      skills = coalesce(p_skills, '{}'::text[]),
      related_project_id = p_related_project_id,
      verification_url = p_verification_url,
      evidence_asset_id = p_evidence_asset_id,
      evidence_visibility = p_evidence_visibility,
      evidence_alt = p_evidence_alt,
      redaction_confirmed = coalesce(p_redaction_confirmed, false),
      lock_version = lock_version + 1,
      updated_by = v_actor,
      updated_at = now()
  where id = p_credential_id
  returning * into v_saved;

  perform private.record_audit(
    v_actor,
    'credential',
    p_credential_id,
    'draft_saved',
    v_changed
  );
  return v_saved;
end;
$$;

create function public.publish_credential(
  p_credential_id uuid,
  p_expected_lock_version bigint
)
returns public.credential_publications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_credential public.credentials%rowtype;
  v_asset public.assets%rowtype;
  v_publication public.credential_publications%rowtype;
  v_version bigint;
  v_evidence jsonb;
  v_visibility text;
begin
  if not coalesce(private.is_admin(), false) then
    raise exception 'admin_not_allowed' using errcode = '42501';
  end if;

  select * into v_credential
  from public.credentials
  where id = p_credential_id
  for update;
  if not found then
    raise exception 'credential_not_found' using errcode = 'P0002';
  end if;
  if v_credential.lock_version is distinct from p_expected_lock_version then
    raise exception 'stale_lock_version' using errcode = '40001';
  end if;
  if pg_catalog.btrim(v_credential.name) = ''
    or pg_catalog.btrim(v_credential.issuer) = ''
    or v_credential.issue_date is null
  then
    raise exception 'credential_required_fields_missing' using errcode = '23514';
  end if;
  if v_credential.verification_url is null and v_credential.evidence_asset_id is null then
    raise exception 'credential_verification_required' using errcode = '23514';
  end if;
  if v_credential.related_project_id is not null and not exists (
    select 1
    from public.projects
    where id = v_credential.related_project_id
      and lifecycle_state = 'published'
  ) then
    raise exception 'related_project_not_published' using errcode = '23514';
  end if;

  if v_credential.evidence_asset_id is not null then
    select * into v_asset
    from public.assets
    where id = v_credential.evidence_asset_id;
    if not found
      or v_asset.processing_state not in ('ready', 'published')
      or v_asset.mime_type not in (
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/avif',
        'application/pdf'
      )
    then
      raise exception 'credential_evidence_not_ready' using errcode = '23514';
    end if;
    if not v_credential.redaction_confirmed then
      raise exception 'credential_redaction_review_required' using errcode = '23514';
    end if;

    if v_credential.evidence_visibility = 'public' then
      if v_asset.processing_state <> 'published'
        or v_asset.visibility <> 'public'
        or v_asset.public_object_key is null
        or v_asset.publication_permission_confirmed_at is null
      then
        raise exception 'credential_evidence_not_public' using errcode = '23514';
      end if;
      if v_asset.mime_type like 'image/%'
        and pg_catalog.btrim(coalesce(v_credential.evidence_alt, '')) = ''
      then
        raise exception 'credential_evidence_alt_required' using errcode = '23514';
      end if;

      v_visibility := 'public';
      v_evidence := pg_catalog.jsonb_strip_nulls(
        pg_catalog.jsonb_build_object(
          'assetId', v_asset.id,
          'objectKey', v_asset.public_object_key,
          'mimeType', v_asset.mime_type,
          'width', v_asset.width,
          'height', v_asset.height,
          'sizeBytes', v_asset.size_bytes,
          'checksumSha256', v_asset.checksum_sha256,
          'alt', nullif(pg_catalog.btrim(coalesce(v_credential.evidence_alt, '')), '')
        )
      );
    else
      if v_asset.processing_state <> 'ready' or v_asset.visibility <> 'private' then
        raise exception 'credential_private_evidence_not_private' using errcode = '23514';
      end if;
      v_visibility := 'private';
      v_evidence := null;
    end if;
  else
    v_visibility := 'none';
    v_evidence := null;
  end if;

  select coalesce(pg_catalog.max(version), 0) + 1
  into v_version
  from public.credential_publications
  where credential_id = p_credential_id;

  insert into public.credential_publications (
    credential_id,
    version,
    slug,
    name,
    issuer,
    issue_date,
    expiry_date,
    skills,
    related_project_id,
    verification_url,
    evidence_visibility,
    evidence
  )
  values (
    p_credential_id,
    v_version,
    v_credential.slug,
    v_credential.name,
    v_credential.issuer,
    v_credential.issue_date,
    v_credential.expiry_date,
    v_credential.skills,
    v_credential.related_project_id,
    v_credential.verification_url,
    v_visibility,
    v_evidence
  )
  returning * into v_publication;

  update public.credentials
  set lifecycle_state = 'published',
      current_publication_id = v_publication.id,
      first_published_at = coalesce(first_published_at, v_publication.published_at),
      updated_at = now()
  where id = p_credential_id;

  perform private.record_audit(
    v_actor,
    'credential',
    p_credential_id,
    'published',
    array['current_publication_id', 'lifecycle_state']
  );
  return v_publication;
end;
$$;

create function public.archive_credential(p_credential_id uuid)
returns public.credentials
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_credential public.credentials%rowtype;
begin
  if not coalesce(private.is_admin(), false) then
    raise exception 'admin_not_allowed' using errcode = '42501';
  end if;

  update public.credentials
  set lifecycle_state = 'archived',
      updated_at = now()
  where id = p_credential_id
  returning * into v_credential;
  if not found then
    raise exception 'credential_not_found' using errcode = 'P0002';
  end if;

  perform private.record_audit(
    v_actor,
    'credential',
    p_credential_id,
    'archived',
    array['lifecycle_state']
  );
  return v_credential;
end;
$$;

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
      and asset.mime_type = 'application/pdf'
      and asset.processing_state = 'ready'
      and asset.visibility = 'private'
  ) then
    raise exception 'cv_version_not_ready' using errcode = '23514';
  end if;

  -- The caller copies the retained private version to resume.pdf before changing this pointer.
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

alter table private.admin_users enable row level security;
alter table public.assets enable row level security;
alter table public.projects enable row level security;
alter table public.project_drafts enable row level security;
alter table public.project_publications enable row level security;
alter table public.credentials enable row level security;
alter table public.credential_publications enable row level security;
alter table public.cv_versions enable row level security;
alter table public.site_settings enable row level security;
alter table public.audit_events enable row level security;
alter table public.deployment_checks enable row level security;

create policy assets_admin_select
on public.assets for select to authenticated
using (private.is_admin());

create policy assets_admin_insert
on public.assets for insert to authenticated
with check (private.is_admin() and owner_id = auth.uid());

create policy assets_admin_update
on public.assets for update to authenticated
using (private.is_admin())
with check (private.is_admin());

create policy projects_public_index
on public.projects for select to anon, authenticated
using (lifecycle_state = 'published' and current_publication_id is not null);

create policy projects_admin_select
on public.projects for select to authenticated
using (private.is_admin());

create policy project_drafts_admin_select
on public.project_drafts for select to authenticated
using (private.is_admin());

create policy project_publications_current_public
on public.project_publications for select to anon, authenticated
using (
  exists (
    select 1
    from public.projects project
    where project.current_publication_id = project_publications.id
      and project.lifecycle_state = 'published'
  )
);

create policy project_publications_admin_select
on public.project_publications for select to authenticated
using (private.is_admin());

create policy credentials_admin_select
on public.credentials for select to authenticated
using (private.is_admin());

create policy credential_publications_current_public
on public.credential_publications for select to anon, authenticated
using (private.is_current_credential_publication(id));

create policy credential_publications_admin_select
on public.credential_publications for select to authenticated
using (private.is_admin());

create policy cv_versions_admin_select
on public.cv_versions for select to authenticated
using (private.is_admin());

create policy cv_versions_admin_insert
on public.cv_versions for insert to authenticated
with check (
  private.is_admin()
  and uploaded_by = auth.uid()
  and exists (
    select 1
    from public.assets asset
    where asset.id = cv_versions.asset_id
      and asset.mime_type = 'application/pdf'
      and asset.processing_state = 'ready'
      and asset.visibility = 'private'
      and asset.size_bytes = cv_versions.size_bytes
  )
);

create policy site_settings_admin_select
on public.site_settings for select to authenticated
using (private.is_admin());

create policy audit_events_admin_select
on public.audit_events for select to authenticated
using (private.is_admin());

create policy audit_events_admin_insert
on public.audit_events for insert to authenticated
with check (private.is_admin() and administrator_id = auth.uid());

create policy deployment_checks_admin_select
on public.deployment_checks for select to authenticated
using (private.is_admin());

create policy deployment_checks_service_insert
on public.deployment_checks for insert to service_role
with check (true);

revoke all on table private.admin_users from public, anon, authenticated, service_role;
revoke all on table public.assets from public, anon, authenticated, service_role;
revoke all on table public.projects from public, anon, authenticated, service_role;
revoke all on table public.project_drafts from public, anon, authenticated, service_role;
revoke all on table public.project_publications from public, anon, authenticated, service_role;
revoke all on table public.credentials from public, anon, authenticated, service_role;
revoke all on table public.credential_publications from public, anon, authenticated, service_role;
revoke all on table public.cv_versions from public, anon, authenticated, service_role;
revoke all on table public.site_settings from public, anon, authenticated, service_role;
revoke all on table public.audit_events from public, anon, authenticated, service_role;
revoke all on table public.deployment_checks from public, anon, authenticated, service_role;

grant usage on schema private to anon, authenticated;
grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update on public.assets to authenticated;
grant select on public.projects to anon, authenticated;
grant select on public.project_drafts to authenticated;
grant select on public.project_publications to anon, authenticated;
grant select on public.credentials to authenticated;
grant select on public.credential_publications to anon, authenticated;
grant select, insert on public.cv_versions to authenticated;
grant select on public.site_settings to authenticated;
grant select, insert on public.audit_events to authenticated;
grant select on public.deployment_checks to authenticated;
grant insert on public.deployment_checks to service_role;

revoke execute on function private.valid_project_document(jsonb, boolean) from public;
revoke execute on function private.valid_project_links(jsonb) from public;
revoke execute on function private.project_excerpt(jsonb) from public;
revoke execute on function private.slug_base(text) from public;
revoke execute on function private.is_admin() from public;
revoke execute on function private.is_current_credential_publication(uuid) from public;
revoke execute on function private.reject_mutation() from public;
revoke execute on function private.protect_asset_update() from public;
revoke execute on function private.lock_published_slug() from public;
revoke execute on function private.record_audit(uuid, text, uuid, text, text[]) from public;
revoke execute on function public.current_user_is_admin() from public, anon, service_role;
revoke execute on function public.create_project(text) from public, anon, service_role;
revoke execute on function public.save_project_draft(uuid, bigint, text, jsonb, uuid, jsonb) from public, anon, service_role;
revoke execute on function public.publish_project(uuid, bigint) from public, anon, service_role;
revoke execute on function public.archive_project(uuid) from public, anon, service_role;
revoke execute on function public.set_project_order(uuid, integer) from public, anon, service_role;
revoke execute on function public.create_credential(text) from public, anon, service_role;
revoke execute on function public.save_credential(
  uuid,
  bigint,
  text,
  text,
  date,
  date,
  text[],
  uuid,
  text,
  uuid,
  text,
  text,
  boolean
) from public, anon, service_role;
revoke execute on function public.publish_credential(uuid, bigint) from public, anon, service_role;
revoke execute on function public.archive_credential(uuid) from public, anon, service_role;
revoke execute on function public.set_current_cv(uuid) from public, anon, service_role;

grant execute on function private.is_admin() to authenticated;
grant execute on function private.is_current_credential_publication(uuid) to anon, authenticated;
grant execute on function public.current_user_is_admin() to authenticated;
grant execute on function public.create_project(text) to authenticated;
grant execute on function public.save_project_draft(uuid, bigint, text, jsonb, uuid, jsonb) to authenticated;
grant execute on function public.publish_project(uuid, bigint) to authenticated;
grant execute on function public.archive_project(uuid) to authenticated;
grant execute on function public.set_project_order(uuid, integer) to authenticated;
grant execute on function public.create_credential(text) to authenticated;
grant execute on function public.save_credential(
  uuid,
  bigint,
  text,
  text,
  date,
  date,
  text[],
  uuid,
  text,
  uuid,
  text,
  text,
  boolean
) to authenticated;
grant execute on function public.publish_credential(uuid, bigint) to authenticated;
grant execute on function public.archive_credential(uuid) to authenticated;
grant execute on function public.set_current_cv(uuid) to authenticated;

-- After both approved accounts have signed in, bootstrap the allowlist as the
-- database owner with:
-- insert into private.admin_users (slot, user_id)
-- values (1, '<first-user-uuid>'), (2, '<second-user-uuid>');

commit;
