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

select pg_temp.assert_true(
  (
    select c.relrowsecurity
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'monitoring_snapshots'
  ),
  'monitoring snapshots must have RLS enabled'
);

select pg_temp.assert_true(
  not pg_catalog.has_table_privilege('anon', 'public.monitoring_snapshots', 'SELECT')
  and not pg_catalog.has_table_privilege('anon', 'public.monitoring_snapshots', 'INSERT')
  and not pg_catalog.has_table_privilege('service_role', 'public.monitoring_snapshots', 'SELECT')
  and pg_catalog.has_table_privilege('authenticated', 'public.monitoring_snapshots', 'SELECT')
  and pg_catalog.has_table_privilege('authenticated', 'public.monitoring_snapshots', 'INSERT')
  and pg_catalog.has_table_privilege('authenticated', 'public.monitoring_snapshots', 'UPDATE')
  and not pg_catalog.has_table_privilege('authenticated', 'public.monitoring_snapshots', 'DELETE'),
  'only authenticated administrators receive the required table grants'
);

select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000099',
  true
);
set local role authenticated;

select pg_temp.assert_true(
  (select pg_catalog.count(*) = 0 from public.monitoring_snapshots),
  'a non-admin authenticated user must not read monitoring snapshots'
);

do $$
begin
  insert into public.monitoring_snapshots (
    provider,
    payload,
    last_successful_at
  ) values (
    'analytics',
    '{"sevenDays":{"visitors":0,"pageviews":0}}'::jsonb,
    now()
  );
  raise exception 'non-admin monitoring insert unexpectedly succeeded';
exception
  when insufficient_privilege then null;
end;
$$;

reset role;
select pg_catalog.set_config('request.jwt.claim.sub', :'admin_1', true);
set local role authenticated;

insert into public.monitoring_snapshots (
  provider,
  payload,
  last_successful_at
) values (
  'analytics',
  '{"sevenDays":{"visitors":1,"pageviews":2}}'::jsonb,
  now() - interval '1 minute'
);

select pg_temp.assert_true(
  (select pg_catalog.count(*) = 1 from public.monitoring_snapshots),
  'the first allowlisted administrator must read and write snapshots'
);

reset role;
select pg_catalog.set_config('request.jwt.claim.sub', :'admin_2', true);
set local role authenticated;

update public.monitoring_snapshots
set payload = '{"sevenDays":{"visitors":2,"pageviews":3}}'::jsonb,
    last_successful_at = now()
where provider = 'analytics';

select pg_temp.assert_true(
  (
    select payload #>> '{sevenDays,visitors}' = '2'
    from public.monitoring_snapshots
    where provider = 'analytics'
  ),
  'the second allowlisted administrator must update snapshots'
);

do $$
begin
  update public.monitoring_snapshots
  set last_successful_at = last_successful_at - interval '1 day'
  where provider = 'analytics';
  raise exception 'monitoring timestamp unexpectedly regressed';
exception
  when serialization_failure then null;
end;
$$;

reset role;
set local role anon;

do $$
begin
  perform 1 from public.monitoring_snapshots;
  raise exception 'anonymous monitoring read unexpectedly succeeded';
exception
  when insufficient_privilege then null;
end;
$$;

reset role;
rollback;
