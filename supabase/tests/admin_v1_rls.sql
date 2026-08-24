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
        'claim_asset_publication',
        'finish_asset_publication',
        'release_asset_publication',
        'claim_stale_asset_publications',
        'claim_asset_public_revert',
        'finish_asset_public_revert',
        'release_asset_public_revert',
        'claim_stale_asset_public_reverts',
        'claim_pending_assets_for_cleanup',
        'finish_pending_asset_cleanup',
        'release_pending_asset_cleanup',
        'record_admin_login',
        'record_admin_logout',
        'record_content_export',
        'record_assets_export',
        'record_audit_export',
        'record_deployment_retry',
        'claim_current_cv_transition',
        'confirm_current_cv_transition',
        'finish_current_cv_transition',
        'release_current_cv_transition',
        'claim_stale_current_cv_transition',
        'create_project',
        'save_project_draft',
        'publish_project',
        'archive_project',
        'set_project_order',
        'create_credential',
        'save_credential',
        'publish_credential',
        'archive_credential',
        'prevent_claimed_asset_publication',
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
        'claim_asset_publication',
        'finish_asset_publication',
        'release_asset_publication',
        'claim_stale_asset_publications',
        'claim_asset_public_revert',
        'finish_asset_public_revert',
        'release_asset_public_revert',
        'claim_stale_asset_public_reverts',
        'claim_pending_assets_for_cleanup',
        'finish_pending_asset_cleanup',
        'release_pending_asset_cleanup',
        'record_admin_login',
        'record_admin_logout',
        'record_content_export',
        'record_assets_export',
        'record_audit_export',
        'record_deployment_retry',
        'claim_current_cv_transition',
        'confirm_current_cv_transition',
        'finish_current_cv_transition',
        'release_current_cv_transition',
        'claim_stale_current_cv_transition',
        'create_project',
        'save_project_draft',
        'publish_project',
        'archive_project',
        'set_project_order',
        'create_credential',
        'save_credential',
        'publish_credential',
        'archive_credential',
        'prevent_claimed_asset_publication',
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

select 'assets/' || :'asset_asset_id'
  || '/00000000-0000-4000-8000-000000000010.webp' as object_key
\gset asset_public_

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
  'publish_claim',
  pg_catalog.current_setting('test.admin_1')::uuid,
  :'published_timestamp'::bigint,
  array[
    :'asset_asset_id',
    :'asset_public_object_key',
    'image/webp'
  ]
) as signature
\gset published_

select claim_token::text as claim_token
from public.claim_asset_publication(
  :'asset_asset_id'::uuid,
  :'asset_public_object_key',
  'image/webp',
  :'published_timestamp'::bigint,
  :'published_signature'
)
\gset published_

select pg_catalog.floor(
  pg_catalog.date_part('epoch', pg_catalog.clock_timestamp())
)::bigint as timestamp
\gset publish_finish_

select pg_temp.asset_signature(
  'publish_finish',
  pg_catalog.current_setting('test.admin_1')::uuid,
  :'publish_finish_timestamp'::bigint,
  array[
    :'asset_asset_id',
    :'asset_public_object_key',
    'image/webp',
    :'published_claim_token'
  ]
) as signature
\gset publish_finish_

select pg_temp.assert_true(
  public.finish_asset_publication(
    :'asset_asset_id'::uuid,
    :'asset_public_object_key',
    'image/webp',
    :'published_claim_token'::uuid,
    :'publish_finish_timestamp'::bigint,
    :'publish_finish_signature'
  ),
  'database-first publication claim must finish only after the public copy'
);

select pg_catalog.floor(
  pg_catalog.date_part('epoch', pg_catalog.clock_timestamp())
)::bigint as timestamp
\gset revert_claim_

select pg_temp.asset_signature(
  'revert_claim',
  pg_catalog.current_setting('test.admin_1')::uuid,
  :'revert_claim_timestamp'::bigint,
  array[:'asset_asset_id', :'asset_public_object_key']
) as signature
\gset revert_claim_

select public.claim_asset_public_revert(
  :'asset_asset_id'::uuid,
  :'asset_public_object_key',
  :'revert_claim_timestamp'::bigint,
  :'revert_claim_signature'
)::text as claim_token
\gset revert_claim_

select pg_temp.assert_true(
  :'revert_claim_claim_token' <> '' and exists (
    select 1 from public.assets
    where id = :'asset_asset_id'::uuid
      and processing_state = 'published'
      and public_revert_claimed_at is not null
  ),
  'public revert must claim database state before object deletion'
);

select pg_catalog.floor(
  pg_catalog.date_part('epoch', pg_catalog.clock_timestamp())
)::bigint as timestamp
\gset revert_release_

select pg_temp.asset_signature(
  'revert_release',
  pg_catalog.current_setting('test.admin_1')::uuid,
  :'revert_release_timestamp'::bigint,
  array[
    :'asset_asset_id',
    :'asset_public_object_key',
    :'revert_claim_claim_token'
  ]
) as signature
\gset revert_release_

select pg_temp.assert_true(
  public.release_asset_public_revert(
    :'asset_asset_id'::uuid,
    :'asset_public_object_key',
    :'revert_claim_claim_token'::uuid,
    :'revert_release_timestamp'::bigint,
    :'revert_release_signature'
  )
  and exists (
    select 1 from public.assets
    where id = :'asset_asset_id'::uuid
      and processing_state = 'published'
      and public_revert_claimed_at is null
  ),
  'a pre-storage cancellation may release the revert claim with its lease token'
);

select pg_catalog.floor(
  pg_catalog.date_part('epoch', pg_catalog.clock_timestamp())
)::bigint as timestamp
\gset revert_reclaim_

select pg_temp.asset_signature(
  'revert_claim',
  pg_catalog.current_setting('test.admin_1')::uuid,
  :'revert_reclaim_timestamp'::bigint,
  array[:'asset_asset_id', :'asset_public_object_key']
) as signature
\gset revert_reclaim_

select public.claim_asset_public_revert(
  :'asset_asset_id'::uuid,
  :'asset_public_object_key',
  :'revert_reclaim_timestamp'::bigint,
  :'revert_reclaim_signature'
)::text as claim_token
\gset revert_reclaim_

reset role;
update public.assets
set public_revert_claimed_at = now() - interval '16 minutes'
where id = :'asset_asset_id'::uuid;

select pg_catalog.floor(
  pg_catalog.date_part('epoch', pg_catalog.clock_timestamp())
)::bigint as timestamp
\gset stale_revert_

select pg_temp.asset_signature(
  'revert_claim',
  pg_catalog.current_setting('test.admin_1')::uuid,
  :'stale_revert_timestamp'::bigint,
  array['100']
) as signature
\gset stale_revert_

set local role anon;
select claim_token::text as claim_token
from public.claim_stale_asset_public_reverts(
  100,
  :'stale_revert_timestamp'::bigint,
  :'stale_revert_signature',
  pg_catalog.current_setting('test.admin_1')::uuid
)
where asset_id = :'asset_asset_id'::uuid
\gset stale_revert_claim_

select pg_temp.assert_true(
  :'stale_revert_claim_claim_token'::uuid is distinct from :'revert_reclaim_claim_token'::uuid,
  'cleanup must reclaim an interrupted public revert after its lease expires'
);

select pg_catalog.floor(
  pg_catalog.date_part('epoch', pg_catalog.clock_timestamp())
)::bigint as timestamp
\gset stale_revert_release_

select pg_temp.asset_signature(
  'revert_release',
  pg_catalog.current_setting('test.admin_1')::uuid,
  :'stale_revert_release_timestamp'::bigint,
  array[
    :'asset_asset_id',
    :'asset_public_object_key',
    :'revert_reclaim_claim_token'
  ]
) as signature
\gset stale_revert_release_

select pg_temp.assert_true(
  not public.release_asset_public_revert(
    :'asset_asset_id'::uuid,
    :'asset_public_object_key',
    :'revert_reclaim_claim_token'::uuid,
    :'stale_revert_release_timestamp'::bigint,
    :'stale_revert_release_signature',
    pg_catalog.current_setting('test.admin_1')::uuid
  ),
  'a stale public-revert token must be rejected after lease reclaim'
);

reset role;
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  pg_catalog.current_setting('test.admin_1'),
  true
);
set local role authenticated;

select pg_catalog.floor(
  pg_catalog.date_part('epoch', pg_catalog.clock_timestamp())
)::bigint as timestamp
\gset revert_finish_

select pg_temp.asset_signature(
  'revert_finish',
  pg_catalog.current_setting('test.admin_1')::uuid,
  :'revert_finish_timestamp'::bigint,
  array[
    :'asset_asset_id',
    :'asset_public_object_key',
    :'stale_revert_claim_claim_token'
  ]
) as signature
\gset revert_finish_

select pg_temp.assert_true(
  public.finish_asset_public_revert(
    :'asset_asset_id'::uuid,
    :'asset_public_object_key',
    :'stale_revert_claim_claim_token'::uuid,
    :'revert_finish_timestamp'::bigint,
    :'revert_finish_signature'
  )
  and exists (
    select 1 from public.assets
    where id = :'asset_asset_id'::uuid
      and processing_state = 'ready'
      and visibility = 'private'
      and public_object_key is null
      and public_revert_claimed_at is null
  ),
  'finished public revert must securely restore ready private state'
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

select asset_id::text as asset_id, object_key, claim_token::text as claim_token
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

update public.assets
set cleanup_claimed_at = now() - interval '16 minutes'
where id = :'abandoned_asset_asset_id'::uuid;

select pg_catalog.floor(
  pg_catalog.date_part('epoch', pg_catalog.clock_timestamp())
)::bigint as timestamp
\gset stale_cleanup_

select pg_temp.asset_signature(
  'cleanup_claim',
  pg_catalog.current_setting('test.admin_1')::uuid,
  :'stale_cleanup_timestamp'::bigint,
  array['100']
) as signature
\gset stale_cleanup_

set local role anon;
select claim_token::text as claim_token
from public.claim_pending_assets_for_cleanup(
  100,
  :'stale_cleanup_timestamp'::bigint,
  :'stale_cleanup_signature',
  pg_catalog.current_setting('test.admin_1')::uuid
)
where asset_id = :'abandoned_asset_asset_id'::uuid
\gset stale_cleanup_claim_

select pg_temp.assert_true(
  :'stale_cleanup_claim_claim_token'::uuid is distinct from :'claimed_asset_claim_token'::uuid,
  'an expired deleting lease must be reclaimable after an interrupted cleanup'
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
      and cleanup_claimed_at is not null
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
  array[
    :'abandoned_asset_asset_id',
    :'claimed_asset_claim_token'
  ]
) as signature
\gset cleanup_release_

set local role anon;

select pg_temp.assert_true(
  public.release_pending_asset_cleanup(
    array[:'abandoned_asset_asset_id'::uuid],
    array[:'claimed_asset_claim_token'::uuid],
    :'cleanup_release_timestamp'::bigint,
    :'cleanup_release_signature',
    pg_catalog.current_setting('test.admin_1')::uuid
  ) = 0,
  'a stale pending-cleanup token must be rejected after lease reclaim'
);

reset role;

select pg_catalog.floor(
  pg_catalog.date_part('epoch', pg_catalog.clock_timestamp())
)::bigint as timestamp
\gset cleanup_release_current_

select pg_temp.asset_signature(
  'cleanup_release',
  pg_catalog.current_setting('test.admin_1')::uuid,
  :'cleanup_release_current_timestamp'::bigint,
  array[
    :'abandoned_asset_asset_id',
    :'stale_cleanup_claim_claim_token'
  ]
) as signature
\gset cleanup_release_current_

set local role anon;

select public.release_pending_asset_cleanup(
  array[:'abandoned_asset_asset_id'::uuid],
  array[:'stale_cleanup_claim_claim_token'::uuid],
  :'cleanup_release_current_timestamp'::bigint,
  :'cleanup_release_current_signature',
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
  'a pre-storage cancellation may release a cleanup claim with its lease token'
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

select asset_id::text as asset_id, claim_token::text as claim_token
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
  array[
    :'reclaimed_asset_asset_id',
    :'reclaimed_asset_claim_token'
  ]
) as signature
\gset cleanup_finish_

select pg_temp.assert_true(
  (
    select pg_catalog.count(*) = 1
    from public.finish_pending_asset_cleanup(
      array[:'reclaimed_asset_asset_id'::uuid],
      array[:'reclaimed_asset_claim_token'::uuid],
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

select coalesce(current_cv_version_id::text, '') as version_id
from public.site_settings
where singleton
\gset cv_expected_

select pg_catalog.floor(
  pg_catalog.date_part('epoch', pg_catalog.clock_timestamp())
)::bigint as timestamp
\gset cv_claim_

select pg_temp.asset_signature(
  'cv_claim',
  pg_catalog.current_setting('test.admin_1')::uuid,
  :'cv_claim_timestamp'::bigint,
  array[
    :'cv_cv_version_id',
    :'cv_expected_version_id',
    '00000000-0000-4000-8000-000000000020',
    pg_catalog.repeat('1', 64),
    '',
    'true'
  ]
) as signature
\gset cv_claim_

select claim_token::text as claim_token
from public.claim_current_cv_transition(
  :'cv_cv_version_id'::uuid,
  nullif(:'cv_expected_version_id', '')::uuid,
  '00000000-0000-4000-8000-000000000020'::uuid,
  pg_catalog.repeat('1', 64),
  null,
  true,
  :'cv_claim_timestamp'::bigint,
  :'cv_claim_signature'
)
\gset cv_transition_

select pg_catalog.floor(
  pg_catalog.date_part('epoch', pg_catalog.clock_timestamp())
)::bigint as timestamp
\gset cv_finish_

select pg_temp.asset_signature(
  'cv_finish',
  pg_catalog.current_setting('test.admin_1')::uuid,
  :'cv_finish_timestamp'::bigint,
  array[
    :'cv_cv_version_id',
    '00000000-0000-4000-8000-000000000020',
    pg_catalog.repeat('1', 64),
    :'cv_transition_claim_token'
  ]
) as signature
\gset cv_finish_

select public.finish_current_cv_transition(
  :'cv_cv_version_id'::uuid,
  '00000000-0000-4000-8000-000000000020'::uuid,
  pg_catalog.repeat('1', 64),
  :'cv_transition_claim_token'::uuid,
  :'cv_finish_timestamp'::bigint,
  :'cv_finish_signature'
);

select pg_temp.assert_true(
  exists (
    select 1
    from public.site_settings
    where singleton
      and current_cv_version_id = :'cv_cv_version_id'::uuid
      and current_cv_public_object_key = 'resume.pdf'
      and current_cv_generation = '00000000-0000-4000-8000-000000000020'::uuid
  )
  and pg_catalog.to_regprocedure('public.current_cv_download()') is null
  and pg_catalog.to_regprocedure('public.set_current_cv(uuid)') is null,
  'current CV transition must keep private metadata out of anonymous RPCs'
);

select pg_catalog.set_config('test.cv_version_id', :'cv_cv_version_id', true);

do $$
declare
  v_timestamp bigint := pg_catalog.floor(
    pg_catalog.date_part('epoch', pg_catalog.clock_timestamp())
  )::bigint;
  v_stale_expected constant uuid := '00000000-0000-4000-8000-000000000004';
  v_generation constant uuid := '00000000-0000-4000-8000-000000000022';
begin
  perform * from public.claim_current_cv_transition(
    pg_catalog.current_setting('test.cv_version_id')::uuid,
    v_stale_expected,
    v_generation,
    pg_catalog.repeat('1', 64),
    '"etag-current"',
    false,
    v_timestamp,
    pg_temp.asset_signature(
      'cv_claim',
      pg_catalog.current_setting('test.admin_1')::uuid,
      v_timestamp,
      array[
        pg_catalog.current_setting('test.cv_version_id'),
        coalesce(v_stale_expected::text, ''),
        v_generation::text,
        pg_catalog.repeat('1', 64),
        '"etag-current"',
        'false'
      ]
    )
  );
  raise exception 'stale current-CV commit unexpectedly succeeded';
exception
  when serialization_failure then null;
end;
$$;

select pg_catalog.floor(
  pg_catalog.date_part('epoch', pg_catalog.clock_timestamp())
)::bigint as timestamp
\gset cv_recovery_seed_

select pg_temp.asset_signature(
  'cv_claim',
  pg_catalog.current_setting('test.admin_1')::uuid,
  :'cv_recovery_seed_timestamp'::bigint,
  array[
    :'cv_cv_version_id',
    :'cv_cv_version_id',
    '00000000-0000-4000-8000-000000000021',
    pg_catalog.repeat('1', 64),
    '"etag-current"',
    'false'
  ]
) as signature
\gset cv_recovery_seed_

select claim_token::text as claim_token
from public.claim_current_cv_transition(
  :'cv_cv_version_id'::uuid,
  :'cv_cv_version_id'::uuid,
  '00000000-0000-4000-8000-000000000021'::uuid,
  pg_catalog.repeat('1', 64),
  '"etag-current"',
  false,
  :'cv_recovery_seed_timestamp'::bigint,
  :'cv_recovery_seed_signature'
)
\gset cv_recovery_old_

reset role;
update public.site_settings
set current_cv_transition_claimed_at = now() - interval '16 minutes'
where singleton;

select pg_catalog.floor(
  pg_catalog.date_part('epoch', pg_catalog.clock_timestamp())
)::bigint as timestamp
\gset cv_recovery_claim_

select pg_temp.asset_signature(
  'cv_recover',
  pg_catalog.current_setting('test.admin_1')::uuid,
  :'cv_recovery_claim_timestamp'::bigint,
  array['current-cv.json']
) as signature
\gset cv_recovery_claim_

set local role anon;
select claim_token::text as claim_token
from public.claim_stale_current_cv_transition(
  :'cv_recovery_claim_timestamp'::bigint,
  :'cv_recovery_claim_signature',
  pg_catalog.current_setting('test.admin_1')::uuid
)
\gset cv_recovery_new_

reset role;
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  pg_catalog.current_setting('test.admin_1'),
  true
);
set local role authenticated;

select pg_catalog.floor(
  pg_catalog.date_part('epoch', pg_catalog.clock_timestamp())
)::bigint as timestamp
\gset cv_stale_confirm_

select pg_temp.asset_signature(
  'cv_confirm',
  pg_catalog.current_setting('test.admin_1')::uuid,
  :'cv_stale_confirm_timestamp'::bigint,
  array[:'cv_recovery_old_claim_token']
) as signature
\gset cv_stale_confirm_

select pg_temp.assert_true(
  not public.confirm_current_cv_transition(
    :'cv_recovery_old_claim_token'::uuid,
    :'cv_stale_confirm_timestamp'::bigint,
    :'cv_stale_confirm_signature',
    pg_catalog.current_setting('test.admin_1')::uuid
  ),
  'a stale current-CV token must be rejected after recovery reclaim'
);

select pg_catalog.floor(
  pg_catalog.date_part('epoch', pg_catalog.clock_timestamp())
)::bigint as timestamp
\gset cv_current_confirm_

select pg_temp.asset_signature(
  'cv_confirm',
  pg_catalog.current_setting('test.admin_1')::uuid,
  :'cv_current_confirm_timestamp'::bigint,
  array[:'cv_recovery_new_claim_token']
) as signature
\gset cv_current_confirm_

select pg_temp.assert_true(
  public.confirm_current_cv_transition(
    :'cv_recovery_new_claim_token'::uuid,
    :'cv_current_confirm_timestamp'::bigint,
    :'cv_current_confirm_signature',
    pg_catalog.current_setting('test.admin_1')::uuid
  ),
  'the current CV lease token must remain valid for the conditional pointer write'
);

select pg_catalog.floor(
  pg_catalog.date_part('epoch', pg_catalog.clock_timestamp())
)::bigint as timestamp
\gset cv_recovery_finish_

select pg_temp.asset_signature(
  'cv_finish',
  pg_catalog.current_setting('test.admin_1')::uuid,
  :'cv_recovery_finish_timestamp'::bigint,
  array[
    :'cv_cv_version_id',
    '00000000-0000-4000-8000-000000000021',
    pg_catalog.repeat('1', 64),
    :'cv_recovery_new_claim_token'
  ]
) as signature
\gset cv_recovery_finish_

select pg_temp.assert_true(
  public.finish_current_cv_transition(
    :'cv_cv_version_id'::uuid,
    '00000000-0000-4000-8000-000000000021'::uuid,
    pg_catalog.repeat('1', 64),
    :'cv_recovery_new_claim_token'::uuid,
    :'cv_recovery_finish_timestamp'::bigint,
    :'cv_recovery_finish_signature',
    pg_catalog.current_setting('test.admin_1')::uuid
  ),
  'stale current-CV transitions must be recoverable with the refreshed token'
);

reset role;
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  pg_catalog.current_setting('test.admin_1'),
  true
);
set local role authenticated;

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

select 'assets/' || :'evidence_asset_asset_id'
  || '/00000000-0000-4000-8000-000000000011.pdf' as object_key
\gset evidence_public_

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

select lock_version::text as lock_version,
  redaction_confirmed::text as redaction_confirmed
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
)
\gset replaced_evidence_

select pg_temp.assert_true(
  :'replaced_evidence_redaction_confirmed' = 'false',
  'replacing credential evidence must reset redaction confirmation in SQL'
);

select pg_catalog.floor(
  pg_catalog.date_part('epoch', pg_catalog.clock_timestamp())
)::bigint as timestamp
\gset evidence_published_

select pg_temp.asset_signature(
  'publish_claim',
  pg_catalog.current_setting('test.admin_1')::uuid,
  :'evidence_published_timestamp'::bigint,
  array[
    :'evidence_asset_asset_id',
    :'evidence_public_object_key',
    'application/pdf'
  ]
) as signature
\gset evidence_published_

select claim_token::text as claim_token,
  source_size_bytes::text as source_size_bytes,
  source_checksum_sha256,
  source_purpose
from public.claim_asset_publication(
  :'evidence_asset_asset_id'::uuid,
  :'evidence_public_object_key',
  'application/pdf',
  :'evidence_published_timestamp'::bigint,
  :'evidence_published_signature'
)
\gset evidence_publication_old_

select pg_temp.assert_true(
  :'evidence_publication_old_source_size_bytes'::bigint = 80
  and :'evidence_publication_old_source_checksum_sha256' = pg_catalog.repeat('2', 64)
  and :'evidence_publication_old_source_purpose' = 'credential_pdf',
  'credential PDF publication claims must return immutable verification metadata'
);

reset role;
update public.assets
set publication_claimed_at = now() - interval '16 minutes'
where id = :'evidence_asset_asset_id'::uuid;

select pg_catalog.floor(
  pg_catalog.date_part('epoch', pg_catalog.clock_timestamp())
)::bigint as timestamp
\gset evidence_publication_recover_

select pg_temp.asset_signature(
  'publish_recover',
  pg_catalog.current_setting('test.admin_1')::uuid,
  :'evidence_publication_recover_timestamp'::bigint,
  array['100']
) as signature
\gset evidence_publication_recover_

set local role anon;
select claim_token::text as claim_token,
  source_size_bytes::text as source_size_bytes,
  source_checksum_sha256,
  source_purpose
from public.claim_stale_asset_publications(
  100,
  :'evidence_publication_recover_timestamp'::bigint,
  :'evidence_publication_recover_signature',
  pg_catalog.current_setting('test.admin_1')::uuid
)
where asset_id = :'evidence_asset_asset_id'::uuid
\gset evidence_publication_new_

select pg_temp.assert_true(
  :'evidence_publication_new_source_size_bytes'::bigint = 80
  and :'evidence_publication_new_source_checksum_sha256' = pg_catalog.repeat('2', 64)
  and :'evidence_publication_new_source_purpose' = 'credential_pdf',
  'stale credential PDF recovery must retain immutable verification metadata'
);

reset role;
select pg_catalog.set_config(
  'request.jwt.claim.sub',
  pg_catalog.current_setting('test.admin_1'),
  true
);
set local role authenticated;

select pg_catalog.floor(
  pg_catalog.date_part('epoch', pg_catalog.clock_timestamp())
)::bigint as timestamp
\gset evidence_publication_stale_release_

select pg_temp.asset_signature(
  'publish_release',
  pg_catalog.current_setting('test.admin_1')::uuid,
  :'evidence_publication_stale_release_timestamp'::bigint,
  array[
    :'evidence_asset_asset_id',
    :'evidence_publication_old_claim_token'
  ]
) as signature
\gset evidence_publication_stale_release_

select pg_temp.assert_true(
  not public.release_asset_publication(
    :'evidence_asset_asset_id'::uuid,
    :'evidence_publication_old_claim_token'::uuid,
    :'evidence_publication_stale_release_timestamp'::bigint,
    :'evidence_publication_stale_release_signature'
  ),
  'a stale publication token must be rejected after recovery reclaim'
);

select pg_catalog.floor(
  pg_catalog.date_part('epoch', pg_catalog.clock_timestamp())
)::bigint as timestamp
\gset evidence_publication_finish_

select pg_temp.asset_signature(
  'publish_finish',
  pg_catalog.current_setting('test.admin_1')::uuid,
  :'evidence_publication_finish_timestamp'::bigint,
  array[
    :'evidence_asset_asset_id',
    :'evidence_public_object_key',
    'application/pdf',
    :'evidence_publication_new_claim_token'
  ]
) as signature
\gset evidence_publication_finish_

select public.finish_asset_publication(
  :'evidence_asset_asset_id'::uuid,
  :'evidence_public_object_key',
  'application/pdf',
  :'evidence_publication_new_claim_token'::uuid,
  :'evidence_publication_finish_timestamp'::bigint,
  :'evidence_publication_finish_signature',
  pg_catalog.current_setting('test.admin_1')::uuid
);

select lock_version::text as lock_version
from public.save_credential(
  :'credential_credential_id'::uuid,
  :'replaced_evidence_lock_version'::bigint,
  'Admin v1 credential fixture',
  'Verified issuer',
  date '2026-07-30',
  null,
  array['Workflow automation'],
  null,
  'https://example.com/verify',
  :'evidence_asset_asset_id'::uuid,
  'public',
  null,
  true
)
\gset public_evidence_

select pg_catalog.floor(
  pg_catalog.date_part('epoch', pg_catalog.clock_timestamp())
)::bigint as timestamp
\gset evidence_revert_claim_

select pg_temp.asset_signature(
  'revert_claim',
  pg_catalog.current_setting('test.admin_1')::uuid,
  :'evidence_revert_claim_timestamp'::bigint,
  array[
    :'evidence_asset_asset_id',
    :'evidence_public_object_key'
  ]
) as signature
\gset evidence_revert_claim_

select public.claim_asset_public_revert(
  :'evidence_asset_asset_id'::uuid,
  :'evidence_public_object_key',
  :'evidence_revert_claim_timestamp'::bigint,
  :'evidence_revert_claim_signature'
)::text as claim_token
\gset evidence_revert_

select pg_catalog.set_config(
  'test.credential_id',
  :'credential_credential_id',
  true
);
select pg_catalog.set_config(
  'test.credential_lock',
  :'public_evidence_lock_version',
  true
);

do $$
begin
  perform public.publish_credential(
    pg_catalog.current_setting('test.credential_id')::uuid,
    pg_catalog.current_setting('test.credential_lock')::bigint
  );
  raise exception 'credential publication with a claimed asset unexpectedly succeeded';
exception
  when serialization_failure then null;
end;
$$;

select pg_catalog.floor(
  pg_catalog.date_part('epoch', pg_catalog.clock_timestamp())
)::bigint as timestamp
\gset evidence_revert_release_

select pg_temp.asset_signature(
  'revert_release',
  pg_catalog.current_setting('test.admin_1')::uuid,
  :'evidence_revert_release_timestamp'::bigint,
  array[
    :'evidence_asset_asset_id',
    :'evidence_public_object_key',
    :'evidence_revert_claim_token'
  ]
) as signature
\gset evidence_revert_release_

select public.release_asset_public_revert(
  :'evidence_asset_asset_id'::uuid,
  :'evidence_public_object_key',
  :'evidence_revert_claim_token'::uuid,
  :'evidence_revert_release_timestamp'::bigint,
  :'evidence_revert_release_signature'
);

select id::text as publication_id
from public.publish_credential(
  :'credential_credential_id'::uuid,
  :'public_evidence_lock_version'::bigint
)
\gset credential_

select pg_catalog.set_config(
  'test.credential_publication_id',
  :'credential_publication_id',
  true
);

select pg_catalog.floor(
  pg_catalog.date_part('epoch', pg_catalog.clock_timestamp())
)::bigint as timestamp
\gset referenced_revert_

select pg_temp.asset_signature(
  'revert_claim',
  pg_catalog.current_setting('test.admin_1')::uuid,
  :'referenced_revert_timestamp'::bigint,
  array[
    :'evidence_asset_asset_id',
    :'evidence_public_object_key'
  ]
) as signature
\gset referenced_revert_

select pg_temp.assert_true(
  public.claim_asset_public_revert(
    :'evidence_asset_asset_id'::uuid,
    :'evidence_public_object_key',
    :'referenced_revert_timestamp'::bigint,
    :'referenced_revert_signature'
  ) is null,
  'a public asset referenced by the current credential publication must not be claimed'
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
  pg_catalog.to_regprocedure('public.current_cv_download()') is null
  and not pg_catalog.has_table_privilege('anon', 'public.site_settings', 'SELECT')
  and not pg_catalog.has_table_privilege('anon', 'public.cv_versions', 'SELECT')
  and not pg_catalog.has_table_privilege('anon', 'public.assets', 'SELECT'),
  'anonymous users must not resolve private CV object metadata'
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
    'public.finish_pending_asset_cleanup(uuid[],uuid[],bigint,text,uuid)',
    'EXECUTE'
  )
  and pg_catalog.has_function_privilege(
    'authenticated',
    'public.release_pending_asset_cleanup(uuid[],uuid[],bigint,text,uuid)',
    'EXECUTE'
  )
  and pg_catalog.has_function_privilege(
    'anon',
    'public.claim_pending_assets_for_cleanup(integer,bigint,text,uuid)',
    'EXECUTE'
  )
  and pg_catalog.has_function_privilege(
    'anon',
    'public.finish_pending_asset_cleanup(uuid[],uuid[],bigint,text,uuid)',
    'EXECUTE'
  )
  and pg_catalog.has_function_privilege(
    'anon',
    'public.release_pending_asset_cleanup(uuid[],uuid[],bigint,text,uuid)',
    'EXECUTE'
  )
  and not pg_catalog.has_function_privilege(
    'service_role',
    'public.claim_pending_assets_for_cleanup(integer,bigint,text,uuid)',
    'EXECUTE'
  )
  and not pg_catalog.has_function_privilege(
    'service_role',
    'public.finish_pending_asset_cleanup(uuid[],uuid[],bigint,text,uuid)',
    'EXECUTE'
  )
  and not pg_catalog.has_function_privilege(
    'service_role',
    'public.release_pending_asset_cleanup(uuid[],uuid[],bigint,text,uuid)',
    'EXECUTE'
  )
  and not pg_catalog.has_function_privilege(
    'service_role',
    'public.claim_asset_publication(uuid,text,text,bigint,text,uuid)',
    'EXECUTE'
  )
  and not pg_catalog.has_function_privilege(
    'service_role',
    'public.finish_asset_publication(uuid,text,text,uuid,bigint,text,uuid)',
    'EXECUTE'
  )
  and not pg_catalog.has_function_privilege(
    'service_role',
    'public.release_asset_publication(uuid,uuid,bigint,text,uuid)',
    'EXECUTE'
  )
  and not pg_catalog.has_function_privilege(
    'service_role',
    'public.claim_stale_asset_publications(integer,bigint,text,uuid)',
    'EXECUTE'
  )
  and pg_catalog.has_function_privilege(
    'authenticated',
    'public.claim_asset_publication(uuid,text,text,bigint,text,uuid)',
    'EXECUTE'
  )
  and not pg_catalog.has_function_privilege(
    'anon',
    'public.claim_asset_publication(uuid,text,text,bigint,text,uuid)',
    'EXECUTE'
  )
  and pg_catalog.has_function_privilege(
    'anon',
    'public.finish_asset_publication(uuid,text,text,uuid,bigint,text,uuid)',
    'EXECUTE'
  )
  and pg_catalog.has_function_privilege(
    'anon',
    'public.claim_stale_asset_publications(integer,bigint,text,uuid)',
    'EXECUTE'
  )
  and pg_catalog.to_regprocedure('public.current_cv_download()') is null
  and pg_catalog.to_regprocedure('public.set_current_cv(uuid)') is null
  and pg_catalog.to_regprocedure('public.publish_asset(uuid,text,text,bigint,text)') is null
  and pg_catalog.to_regprocedure('public.commit_current_cv(uuid,uuid,text,text,bigint,text)') is null
  and pg_catalog.has_function_privilege(
    'authenticated',
    'public.claim_current_cv_transition(uuid,uuid,uuid,text,text,boolean,bigint,text)',
    'EXECUTE'
  )
  and not pg_catalog.has_function_privilege(
    'anon',
    'public.claim_current_cv_transition(uuid,uuid,uuid,text,text,boolean,bigint,text)',
    'EXECUTE'
  )
  and pg_catalog.has_function_privilege(
    'anon',
    'public.finish_current_cv_transition(uuid,uuid,text,uuid,bigint,text,uuid)',
    'EXECUTE'
  )
  and pg_catalog.has_function_privilege(
    'anon',
    'public.confirm_current_cv_transition(uuid,bigint,text,uuid)',
    'EXECUTE'
  )
  and pg_catalog.has_function_privilege(
    'anon',
    'public.claim_stale_current_cv_transition(bigint,text,uuid)',
    'EXECUTE'
  )
  and pg_catalog.has_function_privilege(
    'authenticated',
    'public.claim_asset_public_revert(uuid,text,bigint,text,uuid)',
    'EXECUTE'
  )
  and not pg_catalog.has_function_privilege(
    'anon',
    'public.claim_asset_public_revert(uuid,text,bigint,text,uuid)',
    'EXECUTE'
  )
  and pg_catalog.has_function_privilege(
    'anon',
    'public.claim_stale_asset_public_reverts(integer,bigint,text,uuid)',
    'EXECUTE'
  )
  and pg_catalog.has_function_privilege(
    'anon',
    'public.finish_asset_public_revert(uuid,text,uuid,bigint,text,uuid)',
    'EXECUTE'
  )
  and pg_catalog.has_function_privilege(
    'anon',
    'public.release_asset_public_revert(uuid,text,uuid,bigint,text,uuid)',
    'EXECUTE'
  )
  and not pg_catalog.has_function_privilege(
    'service_role',
    'public.claim_current_cv_transition(uuid,uuid,uuid,text,text,boolean,bigint,text)',
    'EXECUTE'
  )
  and not pg_catalog.has_function_privilege(
    'service_role',
    'public.finish_current_cv_transition(uuid,uuid,text,uuid,bigint,text,uuid)',
    'EXECUTE'
  )
  and not pg_catalog.has_function_privilege(
    'service_role',
    'public.confirm_current_cv_transition(uuid,bigint,text,uuid)',
    'EXECUTE'
  )
  and not pg_catalog.has_function_privilege(
    'service_role',
    'public.release_current_cv_transition(uuid,bigint,text,uuid)',
    'EXECUTE'
  )
  and not pg_catalog.has_function_privilege(
    'service_role',
    'public.claim_stale_current_cv_transition(bigint,text,uuid)',
    'EXECUTE'
  )
  and not pg_catalog.has_function_privilege(
    'service_role',
    'public.claim_asset_public_revert(uuid,text,bigint,text,uuid)',
    'EXECUTE'
  )
  and not pg_catalog.has_function_privilege(
    'service_role',
    'public.finish_asset_public_revert(uuid,text,uuid,bigint,text,uuid)',
    'EXECUTE'
  )
  and not pg_catalog.has_function_privilege(
    'service_role',
    'public.release_asset_public_revert(uuid,text,uuid,bigint,text,uuid)',
    'EXECUTE'
  )
  and not pg_catalog.has_function_privilege(
    'service_role',
    'public.claim_stale_asset_public_reverts(integer,bigint,text,uuid)',
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
  'anonymous execution must be limited to attested cleanup and revert recovery'
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
