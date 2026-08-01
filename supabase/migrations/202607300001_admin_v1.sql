begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

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
    and case
      when pg_catalog.jsonb_typeof(p_document) = 'array'
        then pg_catalog.jsonb_array_length(p_document) <= 100
      else false
    end
    and pg_catalog.octet_length(p_document::text) <= 1000000
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
    and case
      when pg_catalog.jsonb_typeof(p_links) = 'array'
        then pg_catalog.jsonb_array_length(p_links) <= 20
      else false
    end
    and not exists (
      select 1
      from links
      where pg_catalog.jsonb_typeof(link) <> 'object'
        or pg_catalog.jsonb_typeof(link -> 'id') is distinct from 'string'
        or pg_catalog.btrim(link ->> 'id') = ''
        or pg_catalog.jsonb_typeof(link -> 'label') is distinct from 'string'
        or pg_catalog.btrim(link ->> 'label') = ''
        or pg_catalog.char_length(link ->> 'label') > 100
        or pg_catalog.jsonb_typeof(link -> 'url') is distinct from 'string'
        or (link ->> 'url') !~ '^https://[^[:space:]]+$'
        or pg_catalog.char_length(link ->> 'url') > 2048
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

create function private.valid_credential_skills(p_skills text[])
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(
    pg_catalog.cardinality(p_skills) <= 50
    and not exists (
      select 1
      from pg_catalog.unnest(p_skills) as skill(value)
      where value is null
        or pg_catalog.btrim(value) = ''
        or pg_catalog.char_length(value) > 100
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

create table private.runtime_secrets (
  name text primary key check (name = 'asset_mutation'),
  secret text not null check (
    secret = pg_catalog.btrim(secret)
    and pg_catalog.octet_length(secret) between 32 and 1024
  ),
  updated_at timestamptz not null default now()
);

comment on table private.runtime_secrets is
  'Database-owner managed runtime secrets. Never expose this table through the Data API.';

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  purpose text not null check (
    purpose in ('project_image', 'credential_image', 'credential_pdf', 'cv_pdf')
  ),
  original_filename text not null check (
    pg_catalog.btrim(original_filename) <> ''
    and pg_catalog.char_length(original_filename) <= 255
  ),
  object_key text not null unique check (pg_catalog.btrim(object_key) <> ''),
  private_derivative_key text unique,
  private_derivative_size_bytes bigint check (
    private_derivative_size_bytes between 1 and 8388608
  ),
  public_object_key text unique,
  public_mime_type text check (
    public_mime_type in ('image/webp', 'application/pdf')
  ),
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
    processing_state in ('pending', 'deleting', 'ready', 'published')
  ),
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  owner_id uuid not null references auth.users(id) on delete restrict,
  publication_permission_confirmed_at timestamptz,
  validated_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (
      purpose in ('project_image', 'credential_image')
      and mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/avif')
      and size_bytes <= 8388608
    )
    or (
      purpose in ('credential_pdf', 'cv_pdf')
      and mime_type = 'application/pdf'
      and size_bytes <= 10485760
    )
  ),
  check (
    (private_derivative_key is null) = (private_derivative_size_bytes is null)
  ),
  check (
    private_derivative_key is null
    or (
      pg_catalog.btrim(private_derivative_key) <> ''
      and private_derivative_key <> object_key
    )
  ),
  check (
    (public_object_key is null) = (public_mime_type is null)
  ),
  check (
    public_mime_type is null
    or (
      purpose in ('project_image', 'credential_image')
      and public_mime_type = 'image/webp'
    )
    or (
      purpose = 'credential_pdf'
      and public_mime_type = 'application/pdf'
    )
  ),
  check (
    processing_state in ('pending', 'deleting')
    or (
      validated_at is not null
      and checksum_sha256 is not null
      and (
        (
          purpose in ('credential_pdf', 'cv_pdf')
          and width is null
          and height is null
          and private_derivative_key is null
          and private_derivative_size_bytes is null
        )
        or (
          purpose in ('project_image', 'credential_image')
          and width > 0
          and height > 0
          and pg_catalog.greatest(width, height) <= 2400
          and private_derivative_key is not null
          and private_derivative_size_bytes is not null
        )
      )
    )
  ),
  check (
    processing_state not in ('pending', 'deleting')
    or (
      visibility = 'private'
      and private_derivative_key is null
      and private_derivative_size_bytes is null
      and public_object_key is null
      and public_mime_type is null
    )
  ),
  check (
    processing_state <> 'ready'
    or (
      visibility = 'private'
      and public_object_key is null
      and public_mime_type is null
    )
  ),
  check (
    processing_state <> 'published'
    or (
      purpose <> 'cv_pdf'
      and visibility = 'public'
      and public_object_key is not null
      and pg_catalog.btrim(public_object_key) <> ''
      and public_mime_type is not null
      and publication_permission_confirmed_at is not null
    )
  ),
  check (
    purpose <> 'cv_pdf'
    or (
      processing_state in ('pending', 'deleting', 'ready')
      and visibility = 'private'
      and public_object_key is null
      and public_mime_type is null
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
  title text not null check (
    pg_catalog.btrim(title) <> ''
    and pg_catalog.char_length(title) <= 160
  ),
  document jsonb not null default '[]'::jsonb check (
    private.valid_project_document(document, false)
  ),
  cover_asset_id uuid references public.assets(id) on delete restrict,
  cover_alt text,
  links jsonb not null default '[]'::jsonb check (private.valid_project_links(links)),
  lock_version bigint not null default 1 check (lock_version > 0),
  updated_by uuid not null references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now(),
  check (
    cover_alt is null
    or (
      pg_catalog.btrim(cover_alt) <> ''
      and pg_catalog.char_length(cover_alt) <= 500
    )
  ),
  check (cover_asset_id is not null or cover_alt is null)
);

create table public.project_publications (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  version bigint not null check (version > 0),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (
    pg_catalog.btrim(title) <> ''
    and pg_catalog.char_length(title) <= 160
  ),
  excerpt text not null check (pg_catalog.btrim(excerpt) <> ''),
  document jsonb not null check (private.valid_project_document(document, true)),
  cover jsonb check (
    cover is null
    or (
      pg_catalog.jsonb_typeof(cover) = 'object'
      and coalesce(pg_catalog.jsonb_typeof(cover -> 'alt'), '') = 'string'
      and pg_catalog.btrim(cover ->> 'alt') <> ''
    )
  ),
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
  name text not null check (
    pg_catalog.btrim(name) <> ''
    and pg_catalog.char_length(name) <= 160
  ),
  issuer text not null default '' check (pg_catalog.char_length(issuer) <= 160),
  issue_date date,
  expiry_date date,
  skills text[] not null default '{}' check (private.valid_credential_skills(skills)),
  related_project_id uuid references public.projects(id) on delete restrict,
  verification_url text check (
    verification_url is null
    or (
      pg_catalog.char_length(verification_url) <= 2048
      and verification_url ~ '^https://[^[:space:]]+$'
    )
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
  check (expiry_date is null or issue_date is null or expiry_date >= issue_date),
  check (evidence_alt is null or pg_catalog.char_length(evidence_alt) <= 500)
);

create table public.credential_publications (
  id uuid primary key default gen_random_uuid(),
  credential_id uuid not null references public.credentials(id) on delete restrict,
  version bigint not null check (version > 0),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (
    pg_catalog.btrim(name) <> ''
    and pg_catalog.char_length(name) <= 160
  ),
  issuer text not null check (
    pg_catalog.btrim(issuer) <> ''
    and pg_catalog.char_length(issuer) <= 160
  ),
  issue_date date not null,
  expiry_date date,
  skills text[] not null default '{}' check (private.valid_credential_skills(skills)),
  related_project_id uuid references public.projects(id) on delete restrict,
  verification_url text check (
    verification_url is null
    or (
      pg_catalog.char_length(verification_url) <= 2048
      and verification_url ~ '^https://[^[:space:]]+$'
    )
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
  original_filename text not null check (
    pg_catalog.btrim(original_filename) <> ''
    and pg_catalog.char_length(original_filename) <= 255
  ),
  size_bytes bigint not null check (size_bytes between 1 and 10485760),
  version_note text check (
    version_note is null or pg_catalog.char_length(version_note) <= 240
  ),
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
  deployment_id text primary key check (pg_catalog.btrim(deployment_id) <> ''),
  project_id text not null check (pg_catalog.btrim(project_id) <> ''),
  deployment_url text not null check (deployment_url ~ '^https://[^[:space:]]+$'),
  git_sha text not null check (git_sha ~ '^[0-9a-fA-F]{7,64}$'),
  run_id text not null unique check (pg_catalog.btrim(run_id) <> ''),
  run_number bigint not null check (run_number > 0),
  run_url text not null check (run_url ~ '^https://[^[:space:]]+$'),
  status text not null default 'running' check (
    status in ('running', 'success', 'failure')
  ),
  checked_at timestamptz not null,
  pages_checked integer not null default 0 check (pages_checked >= 0),
  broken_count integer not null default 0 check (broken_count >= 0),
  failures jsonb not null default '[]'::jsonb check (
    pg_catalog.jsonb_typeof(failures) = 'array'
    and pg_catalog.jsonb_array_length(failures) <= 50
  ),
  received_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (
      status = 'running'
      and pages_checked = 0
      and broken_count = 0
      and pg_catalog.jsonb_array_length(failures) = 0
    )
    or (
      status = 'success'
      and broken_count = 0
      and pg_catalog.jsonb_array_length(failures) = 0
    )
    or status = 'failure'
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

create function private.asset_mutation_attested(
  p_administrator_id uuid,
  p_operation text,
  p_attestation_timestamp bigint,
  p_fields text[],
  p_attestation_signature text
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select coalesce(
    p_administrator_id is not null
    and pg_catalog.abs(
      pg_catalog.date_part('epoch', pg_catalog.clock_timestamp())
      - p_attestation_timestamp
    ) <= 300
    and p_attestation_signature ~ '^[0-9a-f]{64}$'
    and exists (
      select 1
      from private.runtime_secrets
      where name = 'asset_mutation'
        and p_attestation_signature = pg_catalog.encode(
          extensions.hmac(
            pg_catalog.array_to_string(
              array[
                'v1',
                p_operation,
                p_administrator_id::text,
                p_attestation_timestamp::text
              ] || coalesce(p_fields, '{}'::text[]),
              '|',
              ''
            ),
            secret,
            'sha256'
          ),
          'hex'
        )
    ),
    false
  );
$$;

create function public.finalize_asset(
  p_asset_id uuid,
  p_mime_type text,
  p_size_bytes bigint,
  p_checksum_sha256 text,
  p_width integer,
  p_height integer,
  p_private_derivative_key text,
  p_private_derivative_size_bytes bigint,
  p_attestation_timestamp bigint,
  p_attestation_signature text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows integer;
begin
  if not coalesce(private.is_admin(), false) then
    raise exception 'admin_not_allowed' using errcode = '42501';
  end if;
  if not private.asset_mutation_attested(
    auth.uid(),
    'finalize',
    p_attestation_timestamp,
    array[
      p_asset_id::text,
      coalesce(p_mime_type, ''),
      coalesce(p_size_bytes::text, ''),
      coalesce(p_checksum_sha256, ''),
      coalesce(p_width::text, ''),
      coalesce(p_height::text, ''),
      coalesce(p_private_derivative_key, ''),
      coalesce(p_private_derivative_size_bytes::text, '')
    ],
    p_attestation_signature
  ) then
    raise exception 'invalid_asset_attestation' using errcode = '42501';
  end if;
  if p_checksum_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_asset_checksum' using errcode = '22023';
  end if;

  update public.assets
  set checksum_sha256 = p_checksum_sha256,
      processing_state = 'ready',
      validated_at = now(),
      width = p_width,
      height = p_height,
      private_derivative_key = p_private_derivative_key,
      private_derivative_size_bytes = p_private_derivative_size_bytes
  where id = p_asset_id
    and processing_state = 'pending'
    and mime_type = p_mime_type
    and size_bytes = p_size_bytes
    and (
      (
        purpose in ('project_image', 'credential_image')
        and p_mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/avif')
        and p_width between 1 and 2400
        and p_height between 1 and 2400
        and pg_catalog.greatest(p_width, p_height) <= 2400
        and p_private_derivative_key ~ (
          '^ready/' || p_asset_id::text
          || '/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/image[.]webp$'
        )
        and p_private_derivative_size_bytes between 1 and 8388608
      )
      or (
        purpose in ('credential_pdf', 'cv_pdf')
        and p_mime_type = 'application/pdf'
        and p_width is null
        and p_height is null
        and p_private_derivative_key is null
        and p_private_derivative_size_bytes is null
      )
    );
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'asset_finalize_conflict' using errcode = '40001';
  end if;
  return true;
end;
$$;

create function public.publish_asset(
  p_asset_id uuid,
  p_public_object_key text,
  p_public_mime_type text,
  p_attestation_timestamp bigint,
  p_attestation_signature text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_asset public.assets%rowtype;
  v_expected_key text;
  v_expected_mime text;
  v_rows integer;
begin
  if not coalesce(private.is_admin(), false) then
    raise exception 'admin_not_allowed' using errcode = '42501';
  end if;
  if not private.asset_mutation_attested(
    auth.uid(),
    'publish',
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
    when v_asset.purpose in ('project_image', 'credential_image')
      then 'image/webp'
    else 'application/pdf'
  end;
  v_expected_key := 'assets/' || v_asset.id::text || case
    when v_expected_mime = 'image/webp' then '.webp'
    else '.pdf'
  end;
  if p_public_object_key is distinct from v_expected_key
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
    return false;
  end if;
  if v_asset.processing_state <> 'ready' then
    raise exception 'asset_not_ready' using errcode = '55000';
  end if;

  update public.assets
  set processing_state = 'published',
      visibility = 'public',
      public_object_key = p_public_object_key,
      public_mime_type = p_public_mime_type,
      publication_permission_confirmed_at = now()
  where id = p_asset_id
    and processing_state = 'ready';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'asset_publish_conflict' using errcode = '40001';
  end if;
  return true;
end;
$$;

create function public.revert_asset_publication(
  p_asset_id uuid,
  p_public_object_key text,
  p_attestation_timestamp bigint,
  p_attestation_signature text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_asset public.assets%rowtype;
begin
  if not coalesce(private.is_admin(), false) then
    raise exception 'admin_not_allowed' using errcode = '42501';
  end if;
  if not private.asset_mutation_attested(
    auth.uid(),
    'revert',
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
  if v_asset.processing_state = 'ready' then
    return true;
  end if;
  if v_asset.processing_state <> 'published'
    or v_asset.public_object_key is distinct from p_public_object_key
  then
    raise exception 'asset_publication_cannot_be_reverted' using errcode = '55000';
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
    return false;
  end if;

  update public.assets
  set processing_state = 'ready',
      visibility = 'private',
      public_object_key = null,
      public_mime_type = null,
      publication_permission_confirmed_at = null
  where id = p_asset_id
    and processing_state = 'published'
    and public_object_key = p_public_object_key;
  if not found then
    raise exception 'asset_revert_conflict' using errcode = '40001';
  end if;
  return true;
end;
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

  if old.processing_state = 'published' and (
    new.processing_state <> 'ready'
    or new.visibility <> 'private'
    or new.public_object_key is not null
    or new.public_mime_type is not null
    or new.publication_permission_confirmed_at is not null
  ) then
    raise exception 'published_asset_may_only_be_compensated' using errcode = '55000';
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

create function private.protect_deployment_check_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'running' then
    raise exception 'terminal_deployment_check_is_immutable' using errcode = '55000';
  end if;
  if new.status not in ('success', 'failure') then
    raise exception 'deployment_check_must_become_terminal' using errcode = '55000';
  end if;
  if new.deployment_id is distinct from old.deployment_id
    or new.project_id is distinct from old.project_id
    or new.deployment_url is distinct from old.deployment_url
    or new.git_sha is distinct from old.git_sha
    or new.run_id is distinct from old.run_id
    or new.run_number is distinct from old.run_number
    or new.run_url is distinct from old.run_url
    or new.received_at is distinct from old.received_at
  then
    raise exception 'deployment_check_identity_is_immutable' using errcode = '55000';
  end if;
  if new.checked_at < old.checked_at then
    raise exception 'deployment_check_time_cannot_regress' using errcode = '55000';
  end if;

  new.updated_at := now();
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

create trigger deployment_checks_cannot_be_deleted
before delete on public.deployment_checks
for each row execute function private.reject_mutation();

create trigger deployment_checks_become_terminal_once
before update on public.deployment_checks
for each row execute function private.protect_deployment_check_update();

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

create function public.record_admin_login()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not coalesce(private.is_admin(), false) then
    raise exception 'admin_not_allowed' using errcode = '42501';
  end if;
  perform private.record_audit(auth.uid(), 'session', null, 'login', '{}'::text[]);
end;
$$;

create function public.record_admin_logout()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not coalesce(private.is_admin(), false) then
    raise exception 'admin_not_allowed' using errcode = '42501';
  end if;
  perform private.record_audit(auth.uid(), 'session', null, 'logout', '{}'::text[]);
end;
$$;

create function public.record_content_export()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not coalesce(private.is_admin(), false) then
    raise exception 'admin_not_allowed' using errcode = '42501';
  end if;
  perform private.record_audit(auth.uid(), 'export', null, 'content_exported', '{}'::text[]);
end;
$$;

create function public.record_assets_export()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not coalesce(private.is_admin(), false) then
    raise exception 'admin_not_allowed' using errcode = '42501';
  end if;
  perform private.record_audit(auth.uid(), 'export', null, 'assets_exported', '{}'::text[]);
end;
$$;

create function public.record_audit_export()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not coalesce(private.is_admin(), false) then
    raise exception 'admin_not_allowed' using errcode = '42501';
  end if;
  perform private.record_audit(auth.uid(), 'export', null, 'audit_exported', '{}'::text[]);
end;
$$;

create function public.record_deployment_retry()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not coalesce(private.is_admin(), false) then
    raise exception 'admin_not_allowed' using errcode = '42501';
  end if;
  perform private.record_audit(
    auth.uid(),
    'deployment',
    null,
    'retry_requested',
    '{}'::text[]
  );
end;
$$;

create function private.record_cv_upload_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.record_audit(
    new.uploaded_by,
    'cv',
    new.id,
    'uploaded',
    array['asset_id', 'original_filename', 'size_bytes']
  );
  return new;
end;
$$;

create trigger cv_versions_record_upload_audit
after insert on public.cv_versions
for each row execute function private.record_cv_upload_audit();

create function private.record_asset_upload_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.record_audit(
    auth.uid(),
    'asset',
    new.id,
    'uploaded',
    array['processing_state', 'validated_at']
  );
  return new;
end;
$$;

create trigger assets_record_completed_upload
after update on public.assets
for each row
when (old.processing_state = 'pending' and new.processing_state = 'ready')
execute function private.record_asset_upload_audit();

create function public.claim_pending_assets_for_cleanup(
  p_limit integer,
  p_attestation_timestamp bigint,
  p_attestation_signature text,
  p_administrator_id uuid default auth.uid()
)
returns table (
  asset_id uuid,
  object_key text,
  private_derivative_key text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_administrator_id is null or not exists (
    select 1
    from private.admin_users
    where user_id = p_administrator_id
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
    where asset.processing_state = 'pending'
      and asset.created_at < now() - interval '24 hours'
      and not exists (
        select 1
        from public.project_drafts draft
        where draft.cover_asset_id = asset.id
      )
      and not exists (
        select 1
        from public.credentials credential
        where credential.evidence_asset_id = asset.id
      )
    order by asset.created_at, asset.id
    for update of asset skip locked
    limit p_limit
  )
  update public.assets asset
  set processing_state = 'deleting'
  from candidates
  where asset.id = candidates.id
    and asset.processing_state = 'pending'
  returning asset.id, asset.object_key, asset.private_derivative_key;
end;
$$;

create function public.finish_pending_asset_cleanup(
  p_ids uuid[],
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
    select 1
    from private.admin_users
    where user_id = p_administrator_id
  ) then
    raise exception 'admin_not_allowed' using errcode = '42501';
  end if;
  if not private.asset_mutation_attested(
    p_administrator_id,
    'cleanup_finish',
    p_attestation_timestamp,
    array[coalesce(pg_catalog.array_to_string(p_ids, ','), '')],
    p_attestation_signature
  ) then
    raise exception 'invalid_asset_attestation' using errcode = '42501';
  end if;
  if coalesce(pg_catalog.cardinality(p_ids), 0) = 0 then
    return;
  end if;
  if pg_catalog.cardinality(p_ids) > 100 then
    raise exception 'cleanup_batch_too_large' using errcode = '22023';
  end if;

  return query
  delete from public.assets asset
  where asset.id = any (p_ids)
    and asset.processing_state = 'deleting'
  returning asset.id;

  if found then
    perform private.record_audit(
      v_actor,
      'asset',
      null,
      'pending_cleanup',
      array['processing_state', 'created_at']
    );
  end if;
end;
$$;

create function public.release_pending_asset_cleanup(
  p_ids uuid[],
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
    select 1
    from private.admin_users
    where user_id = p_administrator_id
  ) then
    raise exception 'admin_not_allowed' using errcode = '42501';
  end if;
  if not private.asset_mutation_attested(
    p_administrator_id,
    'cleanup_release',
    p_attestation_timestamp,
    array[coalesce(pg_catalog.array_to_string(p_ids, ','), '')],
    p_attestation_signature
  ) then
    raise exception 'invalid_asset_attestation' using errcode = '42501';
  end if;
  if coalesce(pg_catalog.cardinality(p_ids), 0) = 0 then
    return 0;
  end if;
  if pg_catalog.cardinality(p_ids) > 100 then
    raise exception 'cleanup_batch_too_large' using errcode = '22023';
  end if;

  update public.assets
  set processing_state = 'pending'
  where id = any (p_ids)
    and processing_state = 'deleting';
  get diagnostics v_rows = row_count;
  return v_rows;
end;
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
  if pg_catalog.char_length(pg_catalog.btrim(p_title)) > 160 then
    raise exception 'title_too_long' using errcode = '22023';
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
  p_cover_alt text,
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
  v_cover_alt text := case
    when p_cover_asset_id is null then null
    else nullif(pg_catalog.btrim(coalesce(p_cover_alt, '')), '')
  end;
begin
  if not coalesce(private.is_admin(), false) then
    raise exception 'admin_not_allowed' using errcode = '42501';
  end if;
  if pg_catalog.btrim(coalesce(p_title, '')) = '' then
    raise exception 'title_required' using errcode = '22023';
  end if;
  if pg_catalog.char_length(pg_catalog.btrim(p_title)) > 160 then
    raise exception 'title_too_long' using errcode = '22023';
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
    select 1
    from public.assets
    where id = p_cover_asset_id
      and purpose = 'project_image'
      and processing_state <> 'deleting'
  ) then
    raise exception 'cover_asset_not_found' using errcode = '23503';
  end if;
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_document) as blocks(block)
    left join public.assets asset
      on asset.id = case
        when block ->> 'type' = 'image' then (block ->> 'assetId')::uuid
        else null
      end
    where block ->> 'type' = 'image'
      and (
        asset.id is null
        or asset.purpose <> 'project_image'
        or asset.processing_state = 'deleting'
      )
  ) then
    raise exception 'document_asset_not_found' using errcode = '23503';
  end if;
  if pg_catalog.char_length(coalesce(v_cover_alt, '')) > 500 then
    raise exception 'cover_alt_too_long' using errcode = '22023';
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
    case when v_old.cover_alt is distinct from v_cover_alt then 'cover_alt' end,
    case when v_old.links is distinct from p_links then 'links' end
  ]::text[], null);

  update public.project_drafts
  set title = pg_catalog.btrim(p_title),
      document = p_document,
      cover_asset_id = p_cover_asset_id,
      cover_alt = v_cover_alt,
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
        or asset.purpose <> 'project_image'
        or asset.processing_state <> 'published'
        or asset.visibility <> 'public'
        or asset.public_object_key is null
        or asset.public_mime_type <> 'image/webp'
        or asset.publication_permission_confirmed_at is null
      )
  ) then
    raise exception 'document_asset_not_publishable' using errcode = '23514';
  end if;

  if v_draft.cover_asset_id is not null and not exists (
    select 1
    from public.assets
    where id = v_draft.cover_asset_id
      and purpose = 'project_image'
      and processing_state = 'published'
      and visibility = 'public'
      and public_object_key is not null
      and public_mime_type = 'image/webp'
      and publication_permission_confirmed_at is not null
  ) then
    raise exception 'cover_asset_not_publishable' using errcode = '23514';
  end if;

  if v_draft.cover_asset_id is not null
    and pg_catalog.btrim(coalesce(v_draft.cover_alt, '')) = ''
  then
    raise exception 'cover_alt_required' using errcode = '23514';
  end if;

  select coalesce(
    pg_catalog.jsonb_object_agg(
      asset.id::text,
      pg_catalog.jsonb_strip_nulls(
        pg_catalog.jsonb_build_object(
          'assetId', asset.id,
          'objectKey', asset.public_object_key,
          'mimeType', asset.public_mime_type,
          'width', asset.width,
          'height', asset.height,
          'sizeBytes', coalesce(asset.private_derivative_size_bytes, asset.size_bytes),
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
    else (v_manifest -> v_draft.cover_asset_id::text)
      || pg_catalog.jsonb_build_object('alt', v_draft.cover_alt)
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
  if pg_catalog.char_length(pg_catalog.btrim(p_name)) > 160 then
    raise exception 'credential_name_too_long' using errcode = '22023';
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
  v_evidence_alt text := nullif(
    pg_catalog.btrim(coalesce(p_evidence_alt, '')),
    ''
  );
  v_redaction_confirmed boolean;
begin
  if not coalesce(private.is_admin(), false) then
    raise exception 'admin_not_allowed' using errcode = '42501';
  end if;
  if pg_catalog.btrim(coalesce(p_name, '')) = '' then
    raise exception 'credential_name_required' using errcode = '22023';
  end if;
  if pg_catalog.char_length(pg_catalog.btrim(p_name)) > 160 then
    raise exception 'credential_name_too_long' using errcode = '22023';
  end if;
  if pg_catalog.char_length(coalesce(pg_catalog.btrim(p_issuer), '')) > 160 then
    raise exception 'credential_issuer_too_long' using errcode = '22023';
  end if;
  if not private.valid_credential_skills(coalesce(p_skills, '{}'::text[])) then
    raise exception 'invalid_credential_skills' using errcode = '22023';
  end if;
  if p_verification_url is not null and (
    pg_catalog.char_length(p_verification_url) > 2048
    or p_verification_url !~ '^https://[^[:space:]]+$'
  ) then
    raise exception 'verification_url_must_be_https' using errcode = '22023';
  end if;
  if pg_catalog.char_length(coalesce(v_evidence_alt, '')) > 500 then
    raise exception 'evidence_alt_too_long' using errcode = '22023';
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
  v_redaction_confirmed := case
    when v_old.evidence_asset_id is distinct from p_evidence_asset_id then false
    else coalesce(p_redaction_confirmed, false)
  end;
  if p_related_project_id is not null and not exists (
    select 1 from public.projects where id = p_related_project_id
  ) then
    raise exception 'related_project_not_found' using errcode = '23503';
  end if;
  if p_evidence_asset_id is not null and not exists (
    select 1
    from public.assets
    where id = p_evidence_asset_id
      and purpose in ('credential_image', 'credential_pdf')
      and processing_state <> 'deleting'
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
    case when v_old.evidence_alt is distinct from v_evidence_alt then 'evidence_alt' end,
    case when v_old.redaction_confirmed is distinct from v_redaction_confirmed then 'redaction_confirmed' end
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
      evidence_alt = v_evidence_alt,
      redaction_confirmed = v_redaction_confirmed,
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
      or v_asset.purpose not in ('credential_image', 'credential_pdf')
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
        or v_asset.public_mime_type is null
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
          'mimeType', v_asset.public_mime_type,
          'width', v_asset.width,
          'height', v_asset.height,
          'sizeBytes', coalesce(v_asset.private_derivative_size_bytes, v_asset.size_bytes),
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
      and asset.purpose = 'cv_pdf'
      and asset.mime_type = 'application/pdf'
      and asset.processing_state = 'ready'
      and asset.visibility = 'private'
  ) then
    raise exception 'cv_version_not_ready' using errcode = '23514';
  end if;

  -- /resume.pdf resolves this pointer and reads the retained private object on each request.
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

create function public.current_cv_download()
returns table (
  object_key text,
  size_bytes bigint,
  checksum_sha256 text
)
language sql
stable
security definer
set search_path = ''
as $$
  select asset.object_key, asset.size_bytes, asset.checksum_sha256
  from public.site_settings settings
  join public.cv_versions version
    on version.id = settings.current_cv_version_id
  join public.assets asset
    on asset.id = version.asset_id
  where settings.singleton
    and asset.purpose = 'cv_pdf'
    and asset.mime_type = 'application/pdf'
    and asset.processing_state = 'ready'
    and asset.visibility = 'private';
$$;

alter table private.admin_users enable row level security;
alter table private.runtime_secrets enable row level security;
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
      and asset.purpose = 'cv_pdf'
      and asset.mime_type = 'application/pdf'
      and asset.processing_state = 'ready'
      and asset.visibility = 'private'
      and asset.size_bytes = cv_versions.size_bytes
      and asset.original_filename = cv_versions.original_filename
  )
);

create policy site_settings_admin_select
on public.site_settings for select to authenticated
using (private.is_admin());

create policy audit_events_admin_select
on public.audit_events for select to authenticated
using (private.is_admin());

create policy deployment_checks_admin_select
on public.deployment_checks for select to authenticated
using (private.is_admin());

create policy deployment_checks_service_insert
on public.deployment_checks for insert to service_role
with check (true);

create policy deployment_checks_service_update
on public.deployment_checks for update to service_role
using (true)
with check (true);

revoke all on table private.admin_users from public, anon, authenticated, service_role;
revoke all on table private.runtime_secrets from public, anon, authenticated, service_role;
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

grant select, insert on public.assets to authenticated;
grant select on public.projects to anon, authenticated;
grant select on public.project_drafts to authenticated;
grant select on public.project_publications to anon, authenticated;
grant select on public.credentials to authenticated;
grant select on public.credential_publications to anon, authenticated;
grant select, insert on public.cv_versions to authenticated;
grant select on public.site_settings to authenticated;
grant select on public.audit_events to authenticated;
grant select on public.deployment_checks to authenticated;
grant insert, update on public.deployment_checks to service_role;
grant select (deployment_id, project_id, git_sha, run_id, status)
on public.deployment_checks to service_role;

revoke execute on function private.valid_project_document(jsonb, boolean) from public;
revoke execute on function private.valid_project_links(jsonb) from public;
revoke execute on function private.valid_credential_skills(text[]) from public;
revoke execute on function private.project_excerpt(jsonb) from public;
revoke execute on function private.slug_base(text) from public;
revoke execute on function private.is_admin() from public;
revoke execute on function private.is_current_credential_publication(uuid) from public;
revoke execute on function private.asset_mutation_attested(uuid, text, bigint, text[], text)
from public;
revoke execute on function private.reject_mutation() from public;
revoke execute on function private.protect_asset_update() from public;
revoke execute on function private.protect_deployment_check_update() from public;
revoke execute on function private.lock_published_slug() from public;
revoke execute on function private.record_audit(uuid, text, uuid, text, text[]) from public;
revoke execute on function private.record_cv_upload_audit() from public;
revoke execute on function private.record_asset_upload_audit() from public;
revoke execute on function public.current_user_is_admin() from public, anon, service_role;
revoke execute on function public.finalize_asset(
  uuid,
  text,
  bigint,
  text,
  integer,
  integer,
  text,
  bigint,
  bigint,
  text
) from public, anon, service_role;
revoke execute on function public.publish_asset(uuid, text, text, bigint, text)
from public, anon, service_role;
revoke execute on function public.revert_asset_publication(uuid, text, bigint, text)
from public, anon, service_role;
revoke execute on function public.claim_pending_assets_for_cleanup(integer, bigint, text, uuid)
from public, service_role;
revoke execute on function public.finish_pending_asset_cleanup(uuid[], bigint, text, uuid)
from public, service_role;
revoke execute on function public.release_pending_asset_cleanup(uuid[], bigint, text, uuid)
from public, service_role;
revoke execute on function public.record_admin_login() from public, anon, service_role;
revoke execute on function public.record_admin_logout() from public, anon, service_role;
revoke execute on function public.record_content_export() from public, anon, service_role;
revoke execute on function public.record_assets_export() from public, anon, service_role;
revoke execute on function public.record_audit_export() from public, anon, service_role;
revoke execute on function public.record_deployment_retry() from public, anon, service_role;
revoke execute on function public.current_cv_download() from public, service_role;
revoke execute on function public.create_project(text) from public, anon, service_role;
revoke execute on function public.save_project_draft(uuid, bigint, text, jsonb, uuid, text, jsonb) from public, anon, service_role;
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
grant execute on function public.finalize_asset(
  uuid,
  text,
  bigint,
  text,
  integer,
  integer,
  text,
  bigint,
  bigint,
  text
) to authenticated;
grant execute on function public.publish_asset(uuid, text, text, bigint, text)
to authenticated;
grant execute on function public.revert_asset_publication(uuid, text, bigint, text)
to authenticated;
grant execute on function public.claim_pending_assets_for_cleanup(integer, bigint, text, uuid)
to anon, authenticated;
grant execute on function public.finish_pending_asset_cleanup(uuid[], bigint, text, uuid)
to anon, authenticated;
grant execute on function public.release_pending_asset_cleanup(uuid[], bigint, text, uuid)
to anon, authenticated;
grant execute on function public.record_admin_login() to authenticated;
grant execute on function public.record_admin_logout() to authenticated;
grant execute on function public.record_content_export() to authenticated;
grant execute on function public.record_assets_export() to authenticated;
grant execute on function public.record_audit_export() to authenticated;
grant execute on function public.record_deployment_retry() to authenticated;
grant execute on function public.current_cv_download() to anon, authenticated;
grant execute on function public.create_project(text) to authenticated;
grant execute on function public.save_project_draft(uuid, bigint, text, jsonb, uuid, text, jsonb) to authenticated;
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
--
-- Configure the shared HMAC secret separately as the database owner, using the
-- same 32+ character value as Vercel ASSET_MUTATION_SECRET:
-- insert into private.runtime_secrets (name, secret)
-- values ('asset_mutation', '<same-secret-as-vercel>')
-- on conflict (name) do update
-- set secret = excluded.secret, updated_at = now();

commit;
