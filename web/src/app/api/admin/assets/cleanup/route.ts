import { NextResponse } from "next/server";
import {
  assetError,
  assetMutationAttestation,
  assetSuccess,
} from "@/lib/assets";
import { deletePrivateObject } from "@/lib/r2";
import { getAdminIdentity } from "@/lib/supabase/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type CleanupCandidate = {
  asset_id: string;
  object_key: string;
  private_derivative_key: string | null;
};

export async function POST() {
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
  if (claimError) {
    return NextResponse.json(
      assetError("cleanup_query_failed", "Abandoned uploads could not be checked."),
      { status: 500 },
    );
  }
  if (!candidates?.length) {
    return NextResponse.json(assetSuccess({ deleted: 0 }));
  }

  const removals = await Promise.all(
    (candidates as CleanupCandidate[]).map(
      async ({ asset_id, object_key, private_derivative_key }) => {
        try {
          const results = await Promise.all(
            [object_key, private_derivative_key]
              .filter((key): key is string => Boolean(key))
              .map((key) => deletePrivateObject(key)),
          );
          return { assetId: asset_id, removed: results.every(Boolean) };
        } catch {
          return { assetId: asset_id, removed: false };
        }
      },
    ),
  );
  const failedIds = removals
    .filter(({ removed }) => !removed)
    .map(({ assetId }) => assetId);
  const removedIds = removals
    .filter(({ removed }) => removed)
    .map(({ assetId }) => assetId);

  if (failedIds.length) {
    const releaseAttestation = assetMutationAttestation(
      admin.id,
      "cleanup_release",
      [failedIds.join(",")],
    );
    const { error: releaseError } = await supabase.rpc(
      "release_pending_asset_cleanup",
      {
        p_ids: failedIds,
        p_attestation_timestamp: releaseAttestation.timestamp,
        p_attestation_signature: releaseAttestation.signature,
      },
    );
    if (releaseError) {
      return NextResponse.json(
        assetError(
          "cleanup_release_failed",
          "Some cleanup claims need administrator review.",
        ),
        { status: 500 },
      );
    }
  }

  if (removedIds.length) {
    const finishAttestation = assetMutationAttestation(
      admin.id,
      "cleanup_finish",
      [removedIds.join(",")],
    );
    const { data: deletedRows, error: deleteError } = await supabase.rpc(
      "finish_pending_asset_cleanup",
      {
        p_ids: removedIds,
        p_attestation_timestamp: finishAttestation.timestamp,
        p_attestation_signature: finishAttestation.signature,
      },
    );
    if (
      deleteError ||
      !Array.isArray(deletedRows) ||
      deletedRows.length !== removedIds.length
    ) {
      return NextResponse.json(
        assetError(
          "cleanup_delete_failed",
          "Private objects were removed, but some cleanup records need review.",
        ),
        { status: 409 },
      );
    }
  }

  if (failedIds.length) {
    return NextResponse.json(
      assetError(
        "cleanup_partial_failure",
        "Some private objects could not be removed. Their claims were released.",
      ),
      { status: 503 },
    );
  }
  return NextResponse.json(assetSuccess({ deleted: removedIds.length }));
}
