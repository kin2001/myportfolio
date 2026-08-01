\set ON_ERROR_STOP on

\if :{?admin_1}
\else
  \echo 'admin_1 is required'
  \quit 3
\endif

\if :{?admin_2}
\else
  \echo 'admin_2 is required'
  \quit 3
\endif

-- Run after both real Supabase users occupy private.admin_users slots 1 and 2:
-- psql "$DATABASE_URL" \
--   -v admin_1=00000000-0000-4000-8000-000000000001 \
--   -v admin_2=00000000-0000-4000-8000-000000000002 \
--   -f supabase/tests/admin_v1_rls.sql

begin;

create function pg_temp.assert_true(p_condition boolean, p_message text)
returns void
language plpgsql
as $$
begin
  if not coalesce(p_condition, false) then
    raise exception 'assertion failed: %', p_message;
  end if;
end;
$$;

create function pg_temp.asset_signature(
  p_operation text,
  p_actor uuid,
  p_timestamp bigint,
  p_fields text[]
)
returns text
language sql
security definer
set search_path = ''
as $$
  select pg_catalog.encode(
    extensions.hmac(
      pg_catalog.array_to_string(
        array['v1', p_operation, p_actor::text, p_timestamp::text]
          || coalesce(p_fields, '{}'::text[]),
        '|',
        ''
      ),
      secret,
      'sha256'
    ),
    'hex'
  )
  from private.runtime_secrets
  where name = 'asset_mutation';
$$;

select pg_catalog.set_config('test.admin_1', :'admin_1', true);
select pg_catalog.set_config('test.admin_2', :'admin_2', true);

insert into private.runtime_secrets (name, secret)
values ('asset_mutation', 'admin-v1-test-secret-32-characters-minimum')
on conflict (name) do update
set secret = excluded.secret, updated_at = now();

select pg_temp.assert_true(
  (
    select pg_catalog.count(*) = 2
      and pg_catalog.count(*) filter (
        where user_id in (
          pg_catalog.current_setting('test.admin_1')::uuid,
          pg_catalog.current_setting('test.admin_2')::uuid
        )
      ) = 2
    from private.admin_users
  ),
  'the two supplied UUIDs must occupy the two allowlist slots'
);

select pg_temp.assert_true(
  not exists (
    select 1
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('private', 'public')
      and c.relname in (
        'admin_users',
        'runtime_secrets',
        'assets',
        'projects',
        'project_drafts',
        'project_publications',
        'credentials',
        'credential_publications',
        'cv_versions',
        'site_settings',
        'audit_events',
        'deployment_checks'
      )
      and not c.relrowsecurity
  ),
  'every admin-v1 table must have RLS enabled'
);

select pg_temp.assert_true(
  not exists (
    select 1
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where p.prosecdef
      and n.nspname in ('private', 'public')
      and p.proname in (
        'is_admin',
        'is_current_credential_publication',
        'asset_mutation_attested',
        'record_audit',
        'current_user_is_admin',
        'finalize_asset',
        'publish_asset',
        'revert_asset_publication',
        'claim_pending_assets_for_cleanup',
        'finish_pending_asset_cleanup',
        'release_pending_asset_cleanup',
        'record_admin_login',
        'record_admin_logout',
        'record_content_export',
        'record_assets_export',
        'record_audit_export',
        'record_deployment_retry',
        'current_cv_download',
        'create_project',
        'save_project_draft',
        'publish_project',
        'archive_project',
        'set_project_order',
        'create_credential',
        'save_credential',
        'publish_credential',
        'archive_credential',
        'set_current_cv',
        'record_cv_upload_audit',
        'record_asset_upload_audit'
      )
      and not exists (
        select 1
        from pg_catalog.unnest(p.proconfig) setting
        where setting like 'search_path=%'
          and pg_catalog.btrim(
            pg_catalog.btrim(pg_catalog.substr(setting, 13)),
            '"'
          ) = ''
      )
  ),
  'every security-definer function must use an empty search_path'
);

select pg_temp.assert_true(
  not exists (
    select 1
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    cross join lateral pg_catalog.aclexplode(
      coalesce(
        p.proacl,
        pg_catalog.acldefault('f', p.proowner)
      )
    ) acl
    where p.prosecdef
      and n.nspname in ('private', 'public')
      and p.proname in (
        'is_admin',
        'is_current_credential_publication',
        'asset_mutation_attested',
        'record_audit',
        'current_user_is_admin',
        'finalize_asset',
        'publish_asset',
        'revert_asset_publication',
        'claim_pending_assets_for_cleanup',
        'finish_pending_asset_cleanup',
        'release_pending_asset_cleanup',
        'record_admin_login',
        'record_admin_logout',
        'record_content_export',
        'record_assets_export',
        'record_audit_export',
        'record_deployment_retry',
        'current_cv_download',
        'create_project',
        'save_project_draft',
        'publish_project',
        'archive_project',
        'set_project_order',
        'create_credential',
        'save_credential',
        'publish_credential',
        'archive_credential',
        'set_current_cv',
        'record_cv_upload_audit',
        'record_asset_upload_audit'
      )
      and acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ),
  'PUBLIC execute must be revoked from security-definer functions'
);

select pg_temp.assert_true(
  not private.valid_project_document(
    (
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', position::text,
          'type', 'text',
          'body', 'bounded',
          'format', 'paragraph'
        )
      )
      from pg_catalog.generate_series(1, 101) as position
    ),
    false
  )
  and not private.valid_project_document(
    pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'id', 'oversized',
        'type', 'text',
        'body', pg_catalog.repeat('x', 1000001),
        'format', 'paragraph'
      )
    ),
    false
  ),
  'project documents must stay within 100 blocks and one megabyte'
);

select pg_temp.assert_true(
  not private.valid_project_links(
    (
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', position::text,
          'label', 'Link',
          'url', 'https://example.com/' || position::text,
          'kind', 'other'
        )
      )
      from pg_catalog.generate_series(1, 21) as position
    )
  )
  and not private.valid_credential_skills(
    pg_catalog.array_fill('skill'::text, array[51])
  ),
  'project links and credential skills must enforce their trust-boundary limits'
);

select pg_catalog.set_config(
  'request.jwt.claim.sub',
  pg_catalog.current_setting('test.admin_1'),
  true
);
set local role authenticated;

select pg_temp.assert_true(
  public.current_user_is_admin(),
  'first allowlisted user must pass the auth probe'
);

select project_id::text as project_id, lock_version::text as lock_version
from public.create_project('Admin v1 RLS fixture')
\gset project_

select lock_version::text as lock_version
from public.save_project_draft(
  :'project_project_id'::uuid,
  :'project_lock_version'::bigint,
  'Admin v1 RLS fixture',
  '[
    {
      "id": "text-1",
      "type": "text",
      "body": "One verified text block is sufficient.",
      "format": "paragraph"
    }
  ]'::jsonb,
  null,
  null,
  '[]'::jsonb
)
\gset saved_project_

select id::text as publication_id
from public.publish_project(
  :'project_project_id'::uuid,
  :'saved_project_lock_version'::bigint
)
\gset project_

select pg_catalog.set_config('test.project_id', :'project_project_id', true);
select pg_catalog.set_config(
  'test.project_publication_id',
  :'project_publication_id',
  true
);

do $$
begin
  perform public.save_project_draft(
    pg_catalog.current_setting('test.project_id')::uuid,
    1,
    'Stale overwrite',
    '[]'::jsonb,
    null,
    null,
    '[]'::jsonb
  );
  raise exception 'stale project save unexpectedly succeeded';
exception
  when serialization_failure then null;
end;
$$;

insert into public.assets (
  purpose,
  original_filename,
  object_key,
  mime_type,
  size_bytes,
  owner_id
)
values (
  'project_image',
  'admin-v1-image.png',
  'tests/admin-v1-image',
  'image/png',
  128,
  pg_catalog.current_setting('test.admin_1')::uuid
)
returning id::text as asset_id
\gset asset_

select
  pg_catalog.floor(
    pg_catalog.date_part('epoch', pg_catalog.clock_timestamp())
  )::bigint as timestamp,
  'ready/' || :'asset_asset_id'
    || '/00000000-0000-4000-8000-000000000010/image.webp' as derivative_key
\gset finalized_

select pg_temp.asset_signature(
  'finalize',
  pg_catalog.current_setting('test.admin_1')::uuid,
  :'finalized_timestamp'::bigint,
  array[
    :'asset_asset_id',
    'image/png',
    '128',
    pg_catalog.repeat('0', 64),
    '1',
    '1',
    :'finalized_derivative_key',
    '96'
  ]
) as signature
\gset finalized_

select pg_temp.assert_true(
  public.finalize_asset(
    :'asset_asset_id'::uuid,
    'image/png',
    128,
    pg_catalog.repeat('0', 64),
    1,
    1,
    :'finalized_derivative_key',
    96,
    :'finalized_timestamp'::bigint,
    :'finalized_signature'
  ),
  'server-attested finalization must update exactly one pending row'
);

select pg_temp.assert_true(
  (
    select pg_catalog.count(*) = 1
    from public.audit_events
    where administrator_id = pg_catalog.current_setting('test.admin_1')::uuid
      and entity_type = 'asset'
      and entity_id = :'asset_asset_id'::uuid
      and action = 'uploaded'
  ),
  'asset finalization must emit one atomic upload audit event'
);

select pg_catalog.set_config('test.asset_id', :'asset_asset_id', true);
select pg_catalog.set_config(
  'test.finalized_timestamp',
  :'finalized_timestamp',
  true
);
select pg_catalog.set_config(
  'test.finalized_signature',
  :'finalized_signature',
  true
);
select pg_catalog.set_config(
  'test.finalized_derivative_key',
  :'finalized_derivative_key',
  true
);
do $$
begin
  perform public.finalize_asset(
    pg_catalog.current_setting('test.asset_id')::uuid,
    'image/png',
    128,
    pg_catalog.repeat('0', 64),
    1,
    1,
    pg_catalog.current_setting('test.finalized_derivative_key'),
    96,
    pg_catalog.current_setting('test.finalized_timestamp')::bigint,
    pg_catalog.current_setting('test.finalized_signature')
  );
  raise exception 'replayed finalization unexpectedly succeeded';
exception
  when serialization_failure then null;
end;
$$;

select
  pg_catalog.floor(
    pg_catalog.date_part('epoch', pg_catalog.clock_timestamp())
  )::bigint as timestamp
\gset published_

select pg_temp.asset_signature(
  'publish',
  pg_catalog.current_setting('test.admin_1')::uuid,
  :'published_timestamp'::bigint,
  array[
    :'asset_asset_id',
    'assets/' || :'asset_asset_id' || '.webp',
    'image/webp'
  ]
) as signature
\gset published_

select pg_temp.assert_true(
  public.publish_asset(
    :'asset_asset_id'::uuid,
    'assets/' || :'asset_asset_id' || '.webp',
    'image/webp',
    :'published_timestamp'::bigint,
    :'published_signature'
  ),
  'server-attested publication must publish a ready asset'
);

select
  pg_catalog.floor(
    pg_catalog.date_part('epoch', pg_catalog.clock_timestamp())
  )::bigint as timestamp
\gset reverted_

select pg_temp.asset_signature(
  'revert',
  pg_catalog.current_setting('test.admin_1')::uuid,
  :'reverted_timestamp'::bigint,
  array[:'asset_asset_id', 'assets/' || :'asset_asset_id' || '.webp']
) as signature
\gset reverted_

select pg_temp.assert_true(
  public.revert_asset_publication(
    :'asset_asset_id'::uuid,
    'assets/' || :'asset_asset_id' || '.webp',
    :'reverted_timestamp'::bigint,
    :'reverted_signature'
  )
  and exists (
    select 1
    from public.assets
    where id = :'asset_asset_id'::uuid
      and processing_state = 'ready'
      and visibility = 'private'
      and public_object_key is null
  ),
  'failed entity publication compensation must securely restore ready state'
);

do $$
begin
  update public.assets
  set private_derivative_size_bytes = 95
  where id = pg_catalog.current_setting('test.asset_id')::uuid;
  raise exception 'direct browser asset update unexpectedly succeeded';
exception
  when insufficient_privilege then null;
end;
$$;

insert into public.assets (
  purpose,
  original_filename,
  object_key,
  mime_type,
  size_bytes,
  owner_id,
  created_at
)
values (
  'cv_pdf',
  'abandoned-admin-v1.pdf',
  'tests/abandoned-admin-v1.pdf',
  'application/pdf',
  64,
  pg_catalog.current_setting('test.admin_1')::uuid,
  now() - interval '25 hours'
)
returning id::text as asset_id
\gset abandoned_asset_

insert into public.assets (
  purpose,
  original_filename,
  object_key,
  mime_type,
  size_bytes,
  owner_id
)
values (
  'cv_pdf',
  'fresh-admin-v1.pdf',
  'tests/fresh-admin-v1.pdf',
  'application/pdf',
  64,
  pg_catalog.current_setting('test.admin_1')::uuid
)
returning id::text as asset_id
\gset fresh_asset_

select pg_catalog.floor(
  pg_catalog.date_part('epoch', pg_catalog.clock_timestamp())
)::bigint as timestamp
\gset cleanup_claim_

select pg_temp.asset_signature(
  'cleanup_claim',
  pg_catalog.current_setting('test.admin_1')::uuid,
  :'cleanup_claim_timestamp'::bigint,
  array['100']
) as signature
\gset cleanup_claim_

reset role;
select pg_catalog.set_config('request.jwt.claim.sub', '', true);
set local role anon;

do $$
begin
  perform *
  from public.claim_pending_assets_for_cleanup(
    100,
    pg_catalog.floor(
      pg_catalog.date_part('epoch', pg_catalog.clock_timestamp())
    )::bigint,
    pg_catalog.repeat('0', 64)
  );
  raise exception 'anonymous cleanup without an actor unexpectedly succeeded';
exception
  when insufficient_privilege then null;
end;
$$;

do $$
begin
  perform *
  from public.claim_pending_assets_for_cleanup(
    100,
    pg_catalog.floor(
      pg_catalog.date_part('epoch', pg_catalog.clock_timestamp())
    )::bigint,
    pg_catalog.repeat('0', 64),
    pg_catalog.current_setting('test.admin_1')::uuid
  );
  raise exception 'unattested anonymous cleanup unexpectedly succeeded';
exception
  when insufficient_privilege then null;
end;
$$;

do $$
declare
  v_actor constant uuid := '00000000-0000-4000-8000-000000000003';
  v_timestamp bigint := pg_catalog.floor(
    pg_catalog.date_part('epoch', pg_catalog.clock_timestamp())
  )::bigint;
begin
  perform *
  from public.claim_pending_assets_for_cleanup(
    100,
    v_timestamp,
    pg_temp.asset_signature(
      'cleanup_claim',
      v_actor,
      v_timestamp,
      array['100']
    ),
    v_actor
  );
  raise exception 'attested non-administrator cleanup unexpectedly succeeded';
exception
  when insufficient_privilege then null;
end;
$$;

select asset_id::text as asset_id, object_key
from public.claim_pending_assets_for_cleanup(
  100,
  :'cleanup_claim_timestamp'::bigint,
  :'cleanup_claim_signature',
  pg_catalog.current_setting('test.admin_1')::uuid
)
where asset_id = :'abandoned_asset_asset_id'::uuid
\gset claimed_asset_

select pg_temp.assert_true(
  not exists (
    select 1
    from public.claim_pending_assets_for_cleanup(
      100,
      :'cleanup_claim_timestamp'::bigint,
      :'cleanup_claim_signature',
      pg_catalog.current_setting('test.admin_1')::uuid
    )
    where asset_id = :'abandoned_asset_asset_id'::uuid
  ),
  'duplicate cron claims must not reclaim an asset already marked deleting'
);

reset role;

select pg_temp.assert_true(
  :'claimed_asset_asset_id'::uuid = :'abandoned_asset_asset_id'::uuid
  and :'claimed_asset_object_key' = 'tests/abandoned-admin-v1.pdf'
  and exists (
    select 1
    from public.assets
    where id = :'abandoned_asset_asset_id'::uuid
      and processing_state = 'deleting'
  )
  and exists (
    select 1
    from public.assets
    where id = :'asset_asset_id'::uuid
      and processing_state = 'ready'
  )
  and exists (
    select 1
    from public.assets
    where id = :'fresh_asset_asset_id'::uuid
      and processing_state = 'pending'
  ),
  'pending cleanup must atomically claim only abandoned pending assets'
);

select pg_catalog.floor(
  pg_catalog.date_part('epoch', pg_catalog.clock_timestamp())
)::bigint as timestamp
\gset cleanup_release_

select pg_temp.asset_signature(
  'cleanup_release',
  pg_catalog.current_setting('test.admin_1')::uuid,
  :'cleanup_release_timestamp'::bigint,
  array[:'abandoned_asset_asset_id']
) as signature
\gset cleanup_release_

set local role anon;

select public.release_pending_asset_cleanup(
  array[:'abandoned_asset_asset_id'::uuid],
  :'cleanup_release_timestamp'::bigint,
  :'cleanup_release_signature',
  pg_catalog.current_setting('test.admin_1')::uuid
) as released
\gset cleanup_release_result_

reset role;

select pg_temp.assert_true(
  :'cleanup_release_result_released'::integer = 1
  and exists (
    select 1
    from public.assets
    where id = :'abandoned_asset_asset_id'::uuid
      and processing_state = 'pending'
  ),
  'storage failure must release a cleanup claim'
);

select pg_catalog.floor(
  pg_catalog.date_part('epoch', pg_catalog.clock_timestamp())
)::bigint as timestamp
\gset cleanup_reclaim_

select pg_temp.asset_signature(
  'cleanup_claim',
  pg_catalog.current_setting('test.admin_1')::uuid,
  :'cleanup_reclaim_timestamp'::bigint,
  array['100']
) as signature
\gset cleanup_reclaim_

set local role anon;

select asset_id::text as asset_id
from public.claim_pending_assets_for_cleanup(
  100,
  :'cleanup_reclaim_timestamp'::bigint,
  :'cleanup_reclaim_signature',
  pg_catalog.current_setting('test.admin_1')::uuid
)
where asset_id = :'abandoned_asset_asset_id'::uuid
\gset reclaimed_asset_

select pg_catalog.floor(
  pg_catalog.date_part('epoch', pg_catalog.clock_timestamp())
)::bigint as timestamp
\gset cleanup_finish_

select pg_temp.asset_signature(
  'cleanup_finish',
  pg_catalog.current_setting('test.admin_1')::uuid,
  :'cleanup_finish_timestamp'::bigint,
  array[:'reclaimed_asset_asset_id']
) as signature
\gset cleanup_finish_

select pg_temp.assert_true(
  (
    select pg_catalog.count(*) = 1
    from public.finish_pending_asset_cleanup(
      array[:'reclaimed_asset_asset_id'::uuid],
      :'cleanup_finish_timestamp'::bigint,
      :'cleanup_finish_signature',
      pg_catalog.current_setting('test.admin_1')::uuid
    )
  ),
  'attested anonymous cleanup must finish the claimed database row'
);

reset role;

select pg_temp.assert_true(
  not exists (
    select 1
    from public.assets
    where id = :'abandoned_asset_asset_id'::uuid
  ),
  'successful storage cleanup must delete the claimed database row'
);

select pg_temp.assert_true(
  (
    select pg_catalog.count(*) = 1
    from public.audit_events
    where administrator_id = pg_catalog.current_setting('test.admin_1')::uuid
      and entity_type = 'asset'
      and action = 'pending_cleanup'
  ),
  'pending cleanup must emit one aggregate audit event'
);

select pg_catalog.set_config(
  'request.jwt.claim.sub',
  pg_catalog.current_setting('test.admin_1'),
  true
);
set local role authenticated;

insert into public.assets (
  purpose,
  original_filename,
  object_key,
  mime_type,
  size_bytes,
  owner_id
)
values (
  'cv_pdf',
  'admin-v1-cv.pdf',
  'tests/admin-v1-cv.pdf',
  'application/pdf',
  96,
  pg_catalog.current_setting('test.admin_1')::uuid
)
returning id::text as asset_id
\gset cv_asset_

select pg_catalog.floor(
  pg_catalog.date_part('epoch', pg_catalog.clock_timestamp())
)::bigint as timestamp
\gset cv_finalized_

select pg_temp.asset_signature(
  'finalize',
  pg_catalog.current_setting('test.admin_1')::uuid,
  :'cv_finalized_timestamp'::bigint,
  array[
    :'cv_asset_asset_id',
    'application/pdf',
    '96',
    pg_catalog.repeat('1', 64),
    '',
    '',
    '',
    ''
  ]
) as signature
\gset cv_finalized_

select pg_temp.assert_true(
  public.finalize_asset(
    :'cv_asset_asset_id'::uuid,
    'application/pdf',
    96,
    pg_catalog.repeat('1', 64),
    null,
    null,
    null,
    null,
    :'cv_finalized_timestamp'::bigint,
    :'cv_finalized_signature'
  ),
  'CV finalization must use the same server attestation boundary'
);

insert into public.cv_versions (
  asset_id,
  original_filename,
  size_bytes,
  uploaded_by
)
values (
  :'cv_asset_asset_id'::uuid,
  'admin-v1-cv.pdf',
  96,
  pg_catalog.current_setting('test.admin_1')::uuid
)
returning id::text as cv_version_id
\gset cv_

select pg_temp.assert_true(
  (
    select pg_catalog.count(*) = 1
    from public.audit_events
    where administrator_id = pg_catalog.current_setting('test.admin_1')::uuid
      and entity_type = 'cv'
      and entity_id = :'cv_cv_version_id'::uuid
      and action = 'uploaded'
  ),
  'CV insertion must emit one atomic upload audit event'
);

select id
from public.set_current_cv(:'cv_cv_version_id'::uuid);

select pg_temp.assert_true(
  (
    select pg_catalog.count(*) = 1
    from public.current_cv_download()
    where object_key = 'tests/admin-v1-cv.pdf'
      and size_bytes = 96
  ),
  'the stable CV route must resolve the database-selected private version'
);

select id::text as credential_id, lock_version::text as lock_version
from public.create_credential('Admin v1 credential fixture')
\gset credential_

select lock_version::text as lock_version
from public.save_credential(
  :'credential_credential_id'::uuid,
  :'credential_lock_version'::bigint,
  'Admin v1 credential fixture',
  'Verified issuer',
  date '2026-07-30',
  null,
  array['Workflow automation'],
  null,
  'https://example.com/verify',
  null,
  'private',
  null,
  false
)
\gset saved_credential_

select id::text as publication_id
from public.publish_credential(
  :'credential_credential_id'::uuid,
  :'saved_credential_lock_version'::bigint
)
\gset credential_

select pg_catalog.set_config(
  'test.credential_publication_id',
  :'credential_publication_id',
  true
);

insert into public.assets (
  purpose,
  original_filename,
  object_key,
  mime_type,
  size_bytes,
  owner_id
)
values (
  'credential_pdf',
  'replacement-evidence.pdf',
  'tests/replacement-evidence.pdf',
  'application/pdf',
  80,
  pg_catalog.current_setting('test.admin_1')::uuid
)
returning id::text as asset_id
\gset evidence_asset_

select pg_catalog.floor(
  pg_catalog.date_part('epoch', pg_catalog.clock_timestamp())
)::bigint as timestamp
\gset evidence_finalized_

select pg_temp.asset_signature(
  'finalize',
  pg_catalog.current_setting('test.admin_1')::uuid,
  :'evidence_finalized_timestamp'::bigint,
  array[
    :'evidence_asset_asset_id',
    'application/pdf',
    '80',
    pg_catalog.repeat('2', 64),
    '',
    '',
    '',
    ''
  ]
) as signature
\gset evidence_finalized_

select public.finalize_asset(
  :'evidence_asset_asset_id'::uuid,
  'application/pdf',
  80,
  pg_catalog.repeat('2', 64),
  null,
  null,
  null,
  null,
  :'evidence_finalized_timestamp'::bigint,
  :'evidence_finalized_signature'
);

select pg_temp.assert_true(
  not redaction_confirmed,
  'replacing credential evidence must reset redaction confirmation in SQL'
)
from public.save_credential(
  :'credential_credential_id'::uuid,
  :'saved_credential_lock_version'::bigint,
  'Admin v1 credential fixture',
  'Verified issuer',
  date '2026-07-30',
  null,
  array['Workflow automation'],
  null,
  'https://example.com/verify',
  :'evidence_asset_asset_id'::uuid,
  'private',
  null,
  true
);

reset role;
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  pg_catalog.current_setting('test.admin_2'),
  true
);
set local role authenticated;

select pg_temp.assert_true(
  public.current_user_is_admin(),
  'second allowlisted user must pass the auth probe'
);

select pg_temp.assert_true(
  (select pg_catalog.count(*) >= 1 from public.project_drafts),
  'second allowlisted user must read private drafts'
);

select project_id
from public.create_project('Second administrator fixture')
limit 1;

reset role;
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000003',
  true
);
set local role authenticated;

select pg_temp.assert_true(
  not public.current_user_is_admin(),
  'a third authenticated user must fail the auth probe'
);

select pg_temp.assert_true(
  (select pg_catalog.count(*) = 0 from public.project_drafts),
  'a third authenticated user must not read project drafts'
);

select pg_temp.assert_true(
  (select pg_catalog.count(*) = 0 from public.credentials),
  'a third authenticated user must not read credential drafts'
);

select pg_temp.assert_true(
  (select pg_catalog.count(*) = 0 from public.audit_events)
  and (select pg_catalog.count(*) = 0 from public.site_settings)
  and (select pg_catalog.count(*) = 0 from public.assets),
  'a third authenticated user must not read audit, settings, or assets'
);

do $$
begin
  perform public.create_project('Unauthorized fixture');
  raise exception 'third user unexpectedly created a project';
exception
  when insufficient_privilege then null;
end;
$$;

reset role;
set local role anon;

select pg_temp.assert_true(
  (
    select pg_catalog.count(*) = 1
    from public.project_publications
    where id = pg_catalog.current_setting('test.project_publication_id')::uuid
  ),
  'anonymous users must read the current project snapshot'
);

select pg_temp.assert_true(
  (
    select pg_catalog.count(*) = 1
    from public.credential_publications
    where id = pg_catalog.current_setting('test.credential_publication_id')::uuid
  ),
  'anonymous users must read the current credential snapshot'
);

select pg_temp.assert_true(
  (
    select pg_catalog.count(*) = 1
    from public.current_cv_download()
    where object_key = 'tests/admin-v1-cv.pdf'
  ),
  'anonymous CV downloads may resolve only the selected private object'
);

reset role;

select pg_temp.assert_true(
  not pg_catalog.has_table_privilege('anon', 'private.admin_users', 'SELECT')
  and not pg_catalog.has_table_privilege('authenticated', 'private.admin_users', 'SELECT')
  and not pg_catalog.has_table_privilege('anon', 'private.runtime_secrets', 'SELECT')
  and not pg_catalog.has_table_privilege(
    'authenticated',
    'private.runtime_secrets',
    'SELECT'
  )
  and not pg_catalog.has_table_privilege('anon', 'public.assets', 'SELECT')
  and not pg_catalog.has_table_privilege('anon', 'public.project_drafts', 'SELECT')
  and not pg_catalog.has_table_privilege('anon', 'public.credentials', 'SELECT')
  and not pg_catalog.has_table_privilege('anon', 'public.cv_versions', 'SELECT')
  and not pg_catalog.has_table_privilege('anon', 'public.site_settings', 'SELECT')
  and not pg_catalog.has_table_privilege('anon', 'public.audit_events', 'SELECT')
  and not pg_catalog.has_table_privilege('anon', 'public.deployment_checks', 'SELECT'),
  'anonymous users must have no private-table SELECT grants'
);

select pg_temp.assert_true(
  not exists (
    select 1
    from (
      values
        ('public.assets'),
        ('public.projects'),
        ('public.project_drafts'),
        ('public.project_publications'),
        ('public.credentials'),
        ('public.credential_publications'),
        ('public.cv_versions'),
        ('public.site_settings'),
        ('public.audit_events'),
        ('public.deployment_checks')
    ) as targets(table_name)
    where pg_catalog.has_table_privilege('authenticated', table_name, 'DELETE')
       or pg_catalog.has_table_privilege('anon', table_name, 'DELETE')
  ),
  'browser roles must have no hard-delete grants'
);

select pg_temp.assert_true(
  not pg_catalog.has_table_privilege('authenticated', 'public.assets', 'UPDATE')
  and not pg_catalog.has_table_privilege(
    'authenticated',
    'public.project_publications',
    'UPDATE'
  )
  and not pg_catalog.has_table_privilege(
    'authenticated',
    'public.credential_publications',
    'UPDATE'
  )
  and not pg_catalog.has_table_privilege('authenticated', 'public.cv_versions', 'UPDATE')
  and not pg_catalog.has_table_privilege('authenticated', 'public.audit_events', 'INSERT')
  and not pg_catalog.has_table_privilege('authenticated', 'public.audit_events', 'UPDATE')
  and not pg_catalog.has_table_privilege(
    'authenticated',
    'public.deployment_checks',
    'UPDATE'
  ),
  'immutable and service-managed records must have no browser UPDATE grants'
);

select pg_temp.assert_true(
  pg_catalog.has_table_privilege('service_role', 'public.deployment_checks', 'INSERT')
  and pg_catalog.has_table_privilege('service_role', 'public.deployment_checks', 'UPDATE')
  and not pg_catalog.has_table_privilege('service_role', 'public.deployment_checks', 'SELECT')
  and pg_catalog.has_column_privilege(
    'service_role',
    'public.deployment_checks',
    'deployment_id',
    'SELECT'
  )
  and pg_catalog.has_column_privilege(
    'service_role',
    'public.deployment_checks',
    'project_id',
    'SELECT'
  )
  and pg_catalog.has_column_privilege(
    'service_role',
    'public.deployment_checks',
    'git_sha',
    'SELECT'
  )
  and pg_catalog.has_column_privilege(
    'service_role',
    'public.deployment_checks',
    'run_id',
    'SELECT'
  )
  and pg_catalog.has_column_privilege(
    'service_role',
    'public.deployment_checks',
    'status',
    'SELECT'
  )
  and not pg_catalog.has_table_privilege('authenticated', 'public.deployment_checks', 'INSERT')
  and not pg_catalog.has_table_privilege('authenticated', 'public.deployment_checks', 'UPDATE'),
  'only service_role may create and finish deployment checks'
);

select pg_temp.assert_true(
  not pg_catalog.has_function_privilege(
    'anon',
    'public.current_user_is_admin()',
    'EXECUTE'
  )
  and pg_catalog.has_function_privilege(
    'authenticated',
    'public.finalize_asset(uuid,text,bigint,text,integer,integer,text,bigint,bigint,text)',
    'EXECUTE'
  )
  and not pg_catalog.has_function_privilege(
    'anon',
    'public.finalize_asset(uuid,text,bigint,text,integer,integer,text,bigint,bigint,text)',
    'EXECUTE'
  )
  and not pg_catalog.has_function_privilege(
    'service_role',
    'public.finalize_asset(uuid,text,bigint,text,integer,integer,text,bigint,bigint,text)',
    'EXECUTE'
  )
  and pg_catalog.has_function_privilege(
    'authenticated',
    'public.claim_pending_assets_for_cleanup(integer,bigint,text,uuid)',
    'EXECUTE'
  )
  and pg_catalog.has_function_privilege(
    'authenticated',
    'public.finish_pending_asset_cleanup(uuid[],bigint,text,uuid)',
    'EXECUTE'
  )
  and pg_catalog.has_function_privilege(
    'authenticated',
    'public.release_pending_asset_cleanup(uuid[],bigint,text,uuid)',
    'EXECUTE'
  )
  and pg_catalog.has_function_privilege(
    'anon',
    'public.claim_pending_assets_for_cleanup(integer,bigint,text,uuid)',
    'EXECUTE'
  )
  and pg_catalog.has_function_privilege(
    'anon',
    'public.finish_pending_asset_cleanup(uuid[],bigint,text,uuid)',
    'EXECUTE'
  )
  and pg_catalog.has_function_privilege(
    'anon',
    'public.release_pending_asset_cleanup(uuid[],bigint,text,uuid)',
    'EXECUTE'
  )
  and not pg_catalog.has_function_privilege(
    'service_role',
    'public.claim_pending_assets_for_cleanup(integer,bigint,text,uuid)',
    'EXECUTE'
  )
  and not pg_catalog.has_function_privilege(
    'service_role',
    'public.finish_pending_asset_cleanup(uuid[],bigint,text,uuid)',
    'EXECUTE'
  )
  and not pg_catalog.has_function_privilege(
    'service_role',
    'public.release_pending_asset_cleanup(uuid[],bigint,text,uuid)',
    'EXECUTE'
  )
  and not pg_catalog.has_function_privilege(
    'service_role',
    'public.publish_asset(uuid,text,text,bigint,text)',
    'EXECUTE'
  )
  and pg_catalog.has_function_privilege(
    'anon',
    'public.current_cv_download()',
    'EXECUTE'
  )
  and not pg_catalog.has_function_privilege(
    'service_role',
    'public.record_deployment_retry()',
    'EXECUTE'
  )
  and not pg_catalog.has_function_privilege(
    'service_role',
    'public.create_project(text)',
    'EXECUTE'
  ),
  'anonymous execution must be limited to attested cleanup and public CV reads'
);

set local role service_role;
insert into public.deployment_checks (
  deployment_id,
  project_id,
  deployment_url,
  git_sha,
  run_id,
  run_number,
  status,
  run_url,
  checked_at,
  pages_checked
)
values (
  'dpl_admin_v1_rls_test',
  'prj_admin_v1_rls_test',
  'https://admin-v1-test.example.com',
  '0123456789abcdef0123456789abcdef01234567',
  'admin-v1-rls-test',
  1,
  'running',
  'https://github.com/example/example/actions/runs/1',
  now(),
  0
);

update public.deployment_checks
set status = 'success',
    checked_at = now(),
    pages_checked = 3
where deployment_id = 'dpl_admin_v1_rls_test'
  and run_id = 'admin-v1-rls-test'
  and git_sha = '0123456789abcdef0123456789abcdef01234567'
  and project_id = 'prj_admin_v1_rls_test'
  and status = 'running';

do $$
begin
  update public.deployment_checks
  set status = 'failure',
      checked_at = now(),
      failures = '[{"kind":"late-mutation"}]'::jsonb
  where deployment_id = 'dpl_admin_v1_rls_test';
  raise exception 'terminal deployment check unexpectedly changed';
exception
  when object_not_in_prerequisite_state then null;
end;
$$;
reset role;

do $$
begin
  update public.project_publications
  set title = title
  where id = pg_catalog.current_setting('test.project_publication_id')::uuid;
  raise exception 'immutable project publication unexpectedly updated';
exception
  when object_not_in_prerequisite_state then null;
end;
$$;

select pg_catalog.set_config(
  'request.jwt.claim.sub',
  pg_catalog.current_setting('test.admin_1'),
  true
);
set local role authenticated;
select public.archive_project(pg_catalog.current_setting('test.project_id')::uuid);
reset role;
set local role anon;

select pg_temp.assert_true(
  (
    select pg_catalog.count(*) = 0
    from public.project_publications
    where id = pg_catalog.current_setting('test.project_publication_id')::uuid
  ),
  'archived project snapshots must stop being anonymously readable'
);

reset role;
rollback;
