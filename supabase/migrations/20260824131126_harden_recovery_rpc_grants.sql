begin;

revoke execute on function public.claim_pending_assets_for_cleanup(integer, bigint, text, uuid)
from public, anon;
revoke execute on function public.finish_pending_asset_cleanup(uuid[], uuid[], bigint, text, uuid)
from public, anon;
revoke execute on function public.release_pending_asset_cleanup(uuid[], uuid[], bigint, text, uuid)
from public, anon;
revoke execute on function public.finish_asset_publication(uuid, text, text, uuid, bigint, text, uuid)
from public, anon;
revoke execute on function public.claim_stale_asset_publications(integer, bigint, text, uuid)
from public, anon;
revoke execute on function public.finish_asset_public_revert(uuid, text, uuid, bigint, text, uuid)
from public, anon;
revoke execute on function public.release_asset_public_revert(uuid, text, uuid, bigint, text, uuid)
from public, anon;
revoke execute on function public.claim_stale_asset_public_reverts(integer, bigint, text, uuid)
from public, anon;

grant execute on function public.claim_pending_assets_for_cleanup(integer, bigint, text, uuid)
to service_role;
grant execute on function public.finish_pending_asset_cleanup(uuid[], uuid[], bigint, text, uuid)
to service_role;
grant execute on function public.finish_asset_publication(uuid, text, text, uuid, bigint, text, uuid)
to service_role;
grant execute on function public.claim_stale_asset_publications(integer, bigint, text, uuid)
to service_role;
grant execute on function public.finish_asset_public_revert(uuid, text, uuid, bigint, text, uuid)
to service_role;
grant execute on function public.claim_stale_asset_public_reverts(integer, bigint, text, uuid)
to service_role;

commit;
