import { createHash, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { assetMutationAttestation } from "@/lib/assets";
import { getSupabasePublicConfig } from "@/lib/env";
import { deletePrivateObject } from "@/lib/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BATCH_LIMIT = 100;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type CleanupCandidate = {
  asset_id: string;
  object_key: string;
  private_derivative_key: string | null;
};

function response(body: object, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function validCronSecret(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || Buffer.byteLength(secret, "utf8") < 32) return false;

  const supplied = createHash("sha256")
    .update(request.headers.get("authorization") ?? "")
    .digest();
  const expected = createHash("sha256").update(`Bearer ${secret}`).digest();
  return timingSafeEqual(supplied, expected);
}

export async function GET(request: Request) {
  if (!validCronSecret(request)) return response({ error: "unauthorized" }, 401);

  const config = getSupabasePublicConfig();
  const configuredAdministratorId =
    process.env.CLEANUP_ADMIN_USER_ID?.trim() ?? "";
  if (!config || !UUID.test(configuredAdministratorId)) {
    return response({ error: "cleanup_not_configured" }, 503);
  }
  const administratorId = configuredAdministratorId.toLowerCase();

  let claimAttestation;
  try {
    claimAttestation = assetMutationAttestation(
      administratorId,
      "cleanup_claim",
      [String(BATCH_LIMIT)],
    );
  } catch {
    return response({ error: "cleanup_not_configured" }, 503);
  }

  const supabase = createClient(config.url, config.publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
  const { data: candidates, error: claimError } = await supabase.rpc(
    "claim_pending_assets_for_cleanup",
    {
      p_limit: BATCH_LIMIT,
      p_attestation_timestamp: claimAttestation.timestamp,
      p_attestation_signature: claimAttestation.signature,
      p_administrator_id: administratorId,
    },
  );
  if (claimError) return response({ error: "cleanup_claim_failed" }, 503);
  if (!candidates?.length) return response({ deleted: 0, released: 0 });

  const removals = await Promise.all(
    (candidates as CleanupCandidate[]).map(
      async ({ asset_id, object_key, private_derivative_key }) => {
        try {
          const deleted = await Promise.all(
            [object_key, private_derivative_key]
              .filter((key): key is string => Boolean(key))
              .map(deletePrivateObject),
          );
          return { assetId: asset_id, removed: deleted.every(Boolean) };
        } catch {
          return { assetId: asset_id, removed: false };
        }
      },
    ),
  );
  const removedIds = removals
    .filter(({ removed }) => removed)
    .map(({ assetId }) => assetId);
  const failedIds = removals
    .filter(({ removed }) => !removed)
    .map(({ assetId }) => assetId);

  let finishFailed = false;
  if (removedIds.length) {
    const attestation = assetMutationAttestation(
      administratorId,
      "cleanup_finish",
      [removedIds.join(",")],
    );
    const { data, error } = await supabase.rpc("finish_pending_asset_cleanup", {
      p_ids: removedIds,
      p_attestation_timestamp: attestation.timestamp,
      p_attestation_signature: attestation.signature,
      p_administrator_id: administratorId,
    });
    finishFailed =
      Boolean(error) || !Array.isArray(data) || data.length !== removedIds.length;
  }

  let releaseFailed = false;
  if (failedIds.length) {
    const attestation = assetMutationAttestation(
      administratorId,
      "cleanup_release",
      [failedIds.join(",")],
    );
    const { error } = await supabase.rpc("release_pending_asset_cleanup", {
      p_ids: failedIds,
      p_attestation_timestamp: attestation.timestamp,
      p_attestation_signature: attestation.signature,
      p_administrator_id: administratorId,
    });
    releaseFailed = Boolean(error);
  }

  if (finishFailed || releaseFailed) {
    return response({ error: "cleanup_state_failed" }, 503);
  }
  if (failedIds.length) {
    return response(
      { error: "cleanup_storage_failed", deleted: removedIds.length },
      503,
    );
  }
  return response({ deleted: removedIds.length, released: 0 });
}
