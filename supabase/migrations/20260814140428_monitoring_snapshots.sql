begin;

create table public.monitoring_snapshots (
  provider text primary key check (
    provider in (
      'analytics',
      'deployment',
      'runtime_errors',
      'browser_errors',
      'monitor_home',
      'monitor_contact',
      'monitor_health'
    )
  ),
  payload jsonb not null check (
    pg_catalog.jsonb_typeof(payload) = 'object'
    and pg_catalog.octet_length(payload::text) <= 32768
  ),
  last_successful_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create function private.protect_monitoring_snapshot_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.provider is distinct from old.provider then
    raise exception 'monitoring_snapshot_provider_is_immutable' using errcode = '55000';
  end if;
  if new.last_successful_at < old.last_successful_at then
    raise exception 'monitoring_snapshot_cannot_regress' using errcode = '40001';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger monitoring_snapshots_move_forward
before update on public.monitoring_snapshots
for each row execute function private.protect_monitoring_snapshot_update();

alter table public.monitoring_snapshots enable row level security;

create policy monitoring_snapshots_admin_select
on public.monitoring_snapshots for select to authenticated
using ((select private.is_admin()));

create policy monitoring_snapshots_admin_insert
on public.monitoring_snapshots for insert to authenticated
with check ((select private.is_admin()));

create policy monitoring_snapshots_admin_update
on public.monitoring_snapshots for update to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

revoke all on table public.monitoring_snapshots
from public, anon, authenticated, service_role;
grant select, insert, update on table public.monitoring_snapshots to authenticated;

revoke execute on function private.protect_monitoring_snapshot_update()
from public, anon, authenticated, service_role;

commit;
