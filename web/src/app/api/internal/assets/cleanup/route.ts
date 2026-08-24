import { createHash, timingSafeEqual } from "node:crypto";
import {
  assetMutationAttestation,
  type ClaimedPublicationSource,
  writeClaimedPublicationSource,
} from "@/lib/assets";
import {
  deletePrivateObject,
  getStorageClient,
  retirePublicObject,
} from "@/lib/supabase/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BATCH_LIMIT = 100;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type CleanupCandidate = {
  asset_id: string;
  object_key: string;
  private_derivative_key: string | null;
  claim_token: string;
};

type RevertCandidate = {
  asset_id: string;
  public_object_key: string;
  claim_token: string;
};

type PublicationCandidate = ClaimedPublicationSource & {
  asset_id: string;
  claim_token: string;
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

  const supabase = getStorageClient();
  const configuredAdministratorId =
    process.env.CLEANUP_ADMIN_USER_ID?.trim() ?? "";
  if (!supabase || !UUID.test(configuredAdministratorId)) {
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

  const { data: candidates, error: claimError } = await supabase.rpc(
    "claim_pending_assets_for_cleanup",
    {
      p_limit: BATCH_LIMIT,
      p_attestation_timestamp: claimAttestation.timestamp,
      p_attestation_signature: claimAttestation.signature,
      p_administrator_id: administratorId,
    },
  );
  const cleanupClaimFailed = Boolean(claimError);
  const removals = await Promise.all(
    ((claimError ? [] : candidates ?? []) as CleanupCandidate[]).map(
      async ({ asset_id, object_key, private_derivative_key, claim_token }) => {
        try {
          const deleted = await Promise.all(
            [object_key, private_derivative_key]
              .filter((key): key is string => Boolean(key))
              .map(deletePrivateObject),
          );
          return {
            assetId: asset_id,
            claimToken: claim_token,
            removed: deleted.every(Boolean),
          };
        } catch {
          return {
            assetId: asset_id,
            claimToken: claim_token,
            removed: false,
          };
        }
      },
    ),
  );
  const removedClaims = removals.filter(({ removed }) => removed);
  const removedIds = removedClaims.map(({ assetId }) => assetId);
  const failedIds = removals
    .filter(({ removed }) => !removed)
    .map(({ assetId }) => assetId);

  let finishFailed = false;
  if (removedIds.length) {
    const attestation = assetMutationAttestation(
      administratorId,
      "cleanup_finish",
      [
        removedIds.join(","),
        removedClaims.map(({ claimToken }) => claimToken).join(","),
      ],
    );
    const { data, error } = await supabase.rpc("finish_pending_asset_cleanup", {
      p_ids: removedIds,
      p_claim_tokens: removedClaims.map(({ claimToken }) => claimToken),
      p_attestation_timestamp: attestation.timestamp,
      p_attestation_signature: attestation.signature,
      p_administrator_id: administratorId,
    });
    finishFailed =
      Boolean(error) || !Array.isArray(data) || data.length !== removedIds.length;
  }

  const publicationClaim = assetMutationAttestation(
    administratorId,
    "publish_recover",
    [String(BATCH_LIMIT)],
  );
  const { data: stalePublications, error: publicationClaimError } =
    await supabase.rpc("claim_stale_asset_publications", {
      p_limit: BATCH_LIMIT,
      p_attestation_timestamp: publicationClaim.timestamp,
      p_attestation_signature: publicationClaim.signature,
      p_administrator_id: administratorId,
    });
  const publicationResults = await Promise.all(
    ((publicationClaimError ? [] : stalePublications ?? []) as PublicationCandidate[]).map(
      async (candidate) => {
        try {
          if (!(await writeClaimedPublicationSource(candidate))) return false;
          const finish = assetMutationAttestation(
            administratorId,
            "publish_finish",
            [
              candidate.asset_id,
              candidate.public_object_key,
              candidate.public_mime_type,
              candidate.claim_token,
            ],
          );
          const { data, error } = await supabase.rpc(
            "finish_asset_publication",
            {
              p_asset_id: candidate.asset_id,
              p_public_object_key: candidate.public_object_key,
              p_public_mime_type: candidate.public_mime_type,
              p_claim_token: candidate.claim_token,
              p_attestation_timestamp: finish.timestamp,
              p_attestation_signature: finish.signature,
              p_administrator_id: administratorId,
            },
          );
          return !error && data === true;
        } catch {
          return false;
        }
      },
    ),
  );
  const publicationFailed =
    Boolean(publicationClaimError) || !publicationResults.every(Boolean);

  const revertClaim = assetMutationAttestation(
    administratorId,
    "revert_claim",
    [String(BATCH_LIMIT)],
  );
  const { data: staleReverts, error: revertClaimError } = await supabase.rpc(
    "claim_stale_asset_public_reverts",
    {
      p_limit: BATCH_LIMIT,
      p_attestation_timestamp: revertClaim.timestamp,
      p_attestation_signature: revertClaim.signature,
      p_administrator_id: administratorId,
    },
  );

  const revertResults = await Promise.all(
    ((revertClaimError ? [] : staleReverts ?? []) as RevertCandidate[]).map(async (candidate) => {
      let removed = false;
      try {
        removed = await retirePublicObject(candidate.public_object_key);
      } catch {
        removed = false;
      }
      if (!removed) return false;
      const attestation = assetMutationAttestation(
        administratorId,
        "revert_finish",
        [
          candidate.asset_id,
          candidate.public_object_key,
          candidate.claim_token,
        ],
      );
      const { data, error } = await supabase.rpc(
        "finish_asset_public_revert",
        {
          p_asset_id: candidate.asset_id,
          p_public_object_key: candidate.public_object_key,
          p_claim_token: candidate.claim_token,
          p_attestation_timestamp: attestation.timestamp,
          p_attestation_signature: attestation.signature,
          p_administrator_id: administratorId,
        },
      );
      return !error && data === true;
    }),
  );
  const revertFailed = Boolean(revertClaimError) || !revertResults.every(Boolean);

  if (
    cleanupClaimFailed ||
    finishFailed ||
    failedIds.length > 0 ||
    publicationFailed ||
    revertFailed
  ) {
    return response(
      {
        error: "asset_recovery_partial_failure",
        deleted: removedIds.length,
        published: publicationResults.filter(Boolean).length,
        reverted: revertResults.filter(Boolean).length,
      },
      503,
    );
  }
  return response({
    deleted: removedIds.length,
    released: 0,
    published: publicationResults.length,
    reverted: revertResults.length,
  });
}
