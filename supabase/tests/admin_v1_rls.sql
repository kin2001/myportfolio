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

select pg_catalog.set_config('test.admin_1', :'admin_1', true);
select pg_catalog.set_config('test.admin_2', :'admin_2', true);

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
        'record_audit',
        'current_user_is_admin',
        'create_project',
        'save_project_draft',
        'publish_project',
        'archive_project',
        'set_project_order',
        'create_credential',
        'save_credential',
        'publish_credential',
        'archive_credential',
        'set_current_cv'
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
        'record_audit',
        'current_user_is_admin',
        'create_project',
        'save_project_draft',
        'publish_project',
        'archive_project',
        'set_project_order',
        'create_credential',
        'save_credential',
        'publish_credential',
        'archive_credential',
        'set_current_cv'
      )
      and acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ),
  'PUBLIC execute must be revoked from security-definer functions'
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
    '[]'::jsonb
  );
  raise exception 'stale project save unexpectedly succeeded';
exception
  when serialization_failure then null;
end;
$$;

insert into public.assets (
  object_key,
  mime_type,
  size_bytes,
  owner_id
)
values (
  'tests/admin-v1-image',
  'image/png',
  128,
  pg_catalog.current_setting('test.admin_1')::uuid
)
returning id::text as asset_id
\gset asset_

update public.assets
set width = 1,
    height = 1,
    checksum_sha256 = pg_catalog.repeat('0', 64),
    processing_state = 'ready',
    validated_at = now()
where id = :'asset_asset_id'::uuid;

select pg_catalog.set_config('test.asset_id', :'asset_asset_id', true);
do $$
begin
  update public.assets
  set object_key = 'tests/mutated-key'
  where id = pg_catalog.current_setting('test.asset_id')::uuid;
  raise exception 'validated asset metadata unexpectedly changed';
exception
  when object_not_in_prerequisite_state then null;
end;
$$;

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

reset role;

select pg_temp.assert_true(
  not pg_catalog.has_table_privilege('anon', 'private.admin_users', 'SELECT')
  and not pg_catalog.has_table_privilege('authenticated', 'private.admin_users', 'SELECT')
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
  not pg_catalog.has_table_privilege(
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
  and not pg_catalog.has_table_privilege('authenticated', 'public.audit_events', 'UPDATE')
  and not pg_catalog.has_table_privilege(
    'authenticated',
    'public.deployment_checks',
    'UPDATE'
  ),
  'immutable and append-only records must have no browser UPDATE grants'
);

select pg_temp.assert_true(
  pg_catalog.has_table_privilege('service_role', 'public.deployment_checks', 'INSERT')
  and not pg_catalog.has_table_privilege('service_role', 'public.deployment_checks', 'SELECT')
  and not pg_catalog.has_table_privilege('authenticated', 'public.deployment_checks', 'INSERT'),
  'only service_role may ingest deployment checks'
);

select pg_temp.assert_true(
  not pg_catalog.has_function_privilege(
    'anon',
    'public.current_user_is_admin()',
    'EXECUTE'
  )
  and not pg_catalog.has_function_privilege(
    'service_role',
    'public.create_project(text)',
    'EXECUTE'
  ),
  'anonymous and ingestion roles must not execute admin RPCs'
);

set local role service_role;
insert into public.deployment_checks (
  deployment_url,
  git_sha,
  run_id,
  run_number,
  result,
  run_url,
  checked_at
)
values (
  'https://admin-v1-test.example.com',
  '0123456789abcdef0123456789abcdef01234567',
  'admin-v1-rls-test',
  1,
  'passed',
  'https://github.com/example/example/actions/runs/1',
  now()
);
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
