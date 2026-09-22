import { NextResponse } from "next/server";
import {
  assetError,
  assetMutationAttestation,
  assetSuccess,
  type ClaimedPublicationSource,
  writeClaimedPublicationSource,
} from "@/lib/assets";
import {
  deletePrivateObject,
  retirePublicObject,
} from "@/lib/supabase/storage";
import { getAdminIdentity } from "@/lib/supabase/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSameOrigin } from "@/lib/request-security";

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

type AdminSupabase = NonNullable<
  Awaited<ReturnType<typeof createSupabaseServerClient>>
>;

async function recoverStalePublications(
  administratorId: string,
  supabase: AdminSupabase,
) {
  const claim = assetMutationAttestation(administratorId, "publish_recover", [
    "100",
  ]);
  const { data, error } = await supabase.rpc("claim_stale_asset_publications", {
    p_limit: 100,
    p_attestation_timestamp: claim.timestamp,
    p_attestation_signature: claim.signature,
  });
  if (error) return { ok: false, published: 0 };

  const results = await Promise.all(
    ((data ?? []) as PublicationCandidate[]).map(async (candidate) => {
      try {
        if (!(await writeClaimedPublicationSource(candidate))) return false;
        const finish = assetMutationAttestation(administratorId, "publish_finish", [
          candidate.asset_id,
          candidate.public_object_key,
          candidate.public_mime_type,
          candidate.claim_token,
        ]);
        const { data: completed, error: finishError } = await supabase.rpc(
          "finish_asset_publication",
          {
            p_asset_id: candidate.asset_id,
            p_public_object_key: candidate.public_object_key,
            p_public_mime_type: candidate.public_mime_type,
            p_claim_token: candidate.claim_token,
            p_attestation_timestamp: finish.timestamp,
            p_attestation_signature: finish.signature,
          },
        );
        return !finishError && completed === true;
      } catch {
        return false;
      }
    }),
  );
  return { ok: results.every(Boolean), published: results.filter(Boolean).length };
}

async function recoverStalePublicReverts(
  administratorId: string,
  supabase: AdminSupabase,
) {
  const claim = assetMutationAttestation(administratorId, "revert_claim", [
    "100",
  ]);
  const { data, error } = await supabase.rpc(
    "claim_stale_asset_public_reverts",
    {
      p_limit: 100,
      p_attestation_timestamp: claim.timestamp,
      p_attestation_signature: claim.signature,
    },
  );
  if (error) return { ok: false, reverted: 0 };

  const results = await Promise.all(
    ((data ?? []) as RevertCandidate[]).map(async (candidate) => {
      let removed = false;
      try {
        removed = await retirePublicObject(candidate.public_object_key);
      } catch {
        removed = false;
      }
      if (!removed) return false;
      const attestation = assetMutationAttestation(administratorId, "revert_finish", [
        candidate.asset_id,
        candidate.public_object_key,
        candidate.claim_token,
      ]);
      const { data: completed, error: completionError } = await supabase.rpc(
        "finish_asset_public_revert",
        {
          p_asset_id: candidate.asset_id,
          p_public_object_key: candidate.public_object_key,
          p_claim_token: candidate.claim_token,
          p_attestation_timestamp: attestation.timestamp,
          p_attestation_signature: attestation.signature,
        },
      );
      return !completionError && completed === true;
    }),
  );
  return {
    ok: results.every(Boolean),
    reverted: results.filter(Boolean).length,
  };
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "origin_not_allowed" }, { status: 403 });
  const [admin, supabase] = await Promise.all([
    getAdminIdentity(),
    createSupabaseServerClient(),
  ]);
  if (!admin || !supabase) {
    return NextResponse.json(
      assetError("unauthorized", "Administrator access is required."),
      { status: 401 },
    );
  }

  let claimAttestation;
  try {
    claimAttestation = assetMutationAttestation(admin.id, "cleanup_claim", [
      "100",
    ]);
  } catch {
    return NextResponse.json(
      assetError(
        "asset_mutation_not_configured",
        "Server-attested asset updates are not configured.",
      ),
      { status: 503 },
    );
  }
  const { data: candidates, error: claimError } = await supabase.rpc(
    "claim_pending_assets_for_cleanup",
    {
      p_limit: 100,
      p_attestation_timestamp: claimAttestation.timestamp,
      p_attestation_signature: claimAttestation.signature,
    },
  );
  let cleanupFailed = Boolean(claimError);
  const removals = await Promise.all(
    ((claimError ? [] : candidates ?? []) as CleanupCandidate[]).map(
      async ({ asset_id, object_key, private_derivative_key, claim_token }) => {
        try {
          const results = await Promise.all(
            [object_key, private_derivative_key]
              .filter((key): key is string => Boolean(key))
              .map((key) => deletePrivateObject(key)),
          );
          return {
            assetId: asset_id,
            claimToken: claim_token,
            removed: results.every(Boolean),
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
  const failedIds = removals
    .filter(({ removed }) => !removed)
    .map(({ assetId }) => assetId);
  const removedIds = removedClaims.map(({ assetId }) => assetId);

  if (removedIds.length) {
    const finishAttestation = assetMutationAttestation(
      admin.id,
      "cleanup_finish",
      [
        removedIds.join(","),
        removedClaims.map(({ claimToken }) => claimToken).join(","),
      ],
    );
    const { data: deletedRows, error: deleteError } = await supabase.rpc(
      "finish_pending_asset_cleanup",
      {
        p_ids: removedIds,
        p_claim_tokens: removedClaims.map(({ claimToken }) => claimToken),
        p_attestation_timestamp: finishAttestation.timestamp,
        p_attestation_signature: finishAttestation.signature,
      },
    );
    if (
      deleteError ||
      !Array.isArray(deletedRows) ||
      deletedRows.length !== removedIds.length
    ) {
      cleanupFailed = true;
    }
  }
  cleanupFailed ||= failedIds.length > 0;

  const [published, recovered] = await Promise.all([
    recoverStalePublications(admin.id, supabase),
    recoverStalePublicReverts(admin.id, supabase),
  ]);
  if (cleanupFailed || !published.ok || !recovered.ok) {
    return NextResponse.json(
      assetError(
        "asset_recovery_partial_failure",
        "Some cleanup or interrupted asset transitions need administrator review.",
      ),
      { status: 503 },
    );
  }
  return NextResponse.json(
    assetSuccess({
      deleted: removedIds.length,
      published: published.published,
      reverted: recovered.reverted,
    }),
  );
}
