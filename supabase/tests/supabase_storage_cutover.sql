begin;

do $$
declare
  v_private storage.buckets%rowtype;
  v_public storage.buckets%rowtype;
begin
  select * into strict v_private
  from storage.buckets
  where id = 'portfolio-private';
  if v_private.public or v_private.file_size_limit <> 10485760 then
    raise exception 'private_bucket_configuration_failed';
  end if;

  select * into strict v_public
  from storage.buckets
  where id = 'portfolio-public';
  if not v_public.public or v_public.file_size_limit <> 10485760 then
    raise exception 'public_bucket_configuration_failed';
  end if;

  if has_function_privilege('anon', 'public.set_current_cv(uuid)', 'EXECUTE') then
    raise exception 'anon_can_set_current_cv';
  end if;
  if not has_function_privilege('authenticated', 'public.set_current_cv(uuid)', 'EXECUTE') then
    raise exception 'authenticated_missing_set_current_cv';
  end if;
  if has_function_privilege('service_role', 'public.set_current_cv(uuid)', 'EXECUTE') then
    raise exception 'service_role_can_set_current_cv';
  end if;

  if to_regprocedure('public.claim_current_cv_transition(uuid,uuid,uuid,text,text,boolean,bigint,text)') is not null then
    raise exception 'obsolete_cv_transition_function_exists';
  end if;
end;
$$;

rollback;
