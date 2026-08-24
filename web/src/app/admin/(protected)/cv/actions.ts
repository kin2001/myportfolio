"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import {
  assetMutationAttestation,
  writeClaimedCurrentCv,
} from "@/lib/assets";
import type { MutationResult } from "@/lib/portfolio-types";
import {
  readCurrentCvPointer,
} from "@/lib/r2";
import { getAdminIdentity } from "@/lib/supabase/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type AdminSupabase = NonNullable<
  Awaited<ReturnType<typeof createSupabaseServerClient>>
>;

type CvSource = {
  versionId: string;
  objectKey: string;
  sizeBytes: number;
  checksumSha256: string;
};

type CvTransition = {
  claim_token: string;
  cv_version_id: string;
  object_key: string;
  size_bytes: number;
  checksum_sha256: string;
  generation: string;
  expected_pointer_etag: string | null;
  expected_pointer_absent: boolean;
};

function failure(error: unknown): MutationResult<never> {
  const message = error instanceof Error
    ? error.message
    : typeof error === "object" && error && "message" in error
      ? String(error.message)
      : "The CV operation failed.";
  return { ok: false, error: { code: "cv_operation_failed", message } };
}

export async function registerCvVersion(input: {
  assetId: string;
  filename: string;
  sizeBytes: number;
  note: string;
}): Promise<MutationResult<{ id: string }>> {
  if (
    !input.filename.trim() ||
    input.filename.length > 255 ||
    !Number.isSafeInteger(input.sizeBytes) ||
    input.sizeBytes < 1 ||
    input.sizeBytes > 10 * 1024 * 1024 ||
    input.note.length > 240
  ) {
    return {
      ok: false,
      error: {
        code: "invalid_cv_version",
        message: "Check the CV filename, file size, and 240-character note.",
      },
    };
  }
  const admin = await getAdminIdentity();
  const supabase = await createSupabaseServerClient();
  if (!admin || !supabase) return { ok: false, error: { code: "unauthorized", message: "Admin access is required." } };
  try {
    const { data, error } = await supabase
      .from("cv_versions")
      .insert({
        asset_id: input.assetId,
        original_filename: input.filename,
        size_bytes: input.sizeBytes,
        version_note: input.note || null,
        uploaded_by: admin.id,
      })
      .select("id")
      .single();
    if (error) throw error;
    revalidatePath("/admin/cv");
    return { ok: true, data: { id: data.id } };
  } catch (error) {
    return failure(error);
  }
}

async function readCvSource(
  supabase: AdminSupabase,
  versionId: string,
): Promise<CvSource | null> {
  const { data: version, error: versionError } = await supabase
    .from("cv_versions")
    .select("id,asset_id")
    .eq("id", versionId)
    .maybeSingle();
  if (versionError || !version) return null;

  const { data: asset, error: assetError } = await supabase
    .from("assets")
    .select("object_key,size_bytes,checksum_sha256,purpose,mime_type,processing_state,visibility")
    .eq("id", version.asset_id)
    .maybeSingle();
  const checksum = asset?.checksum_sha256;
  if (
    assetError ||
    !asset ||
    asset.purpose !== "cv_pdf" ||
    asset.mime_type !== "application/pdf" ||
    asset.processing_state !== "ready" ||
    asset.visibility !== "private" ||
    typeof checksum !== "string" ||
    !/^[0-9a-f]{64}$/.test(checksum)
  ) {
    return null;
  }
  return {
    versionId: version.id,
    objectKey: asset.object_key,
    sizeBytes: asset.size_bytes,
    checksumSha256: checksum,
  };
}

async function currentCvVersionId(supabase: AdminSupabase) {
  const { data, error } = await supabase
    .from("site_settings")
    .select("current_cv_version_id")
    .eq("singleton", true)
    .single();
  if (error || !data) throw error ?? new Error("CV settings are unavailable.");
  return data.current_cv_version_id as string | null;
}

async function writeClaimedCv(
  supabase: AdminSupabase,
  administratorId: string,
  source: CvSource & {
    generation: string;
    expectedPointerEtag: string | null;
    expectedPointerAbsent: boolean;
  },
  claimToken: string,
) {
  return writeClaimedCurrentCv(
    {
      cv_version_id: source.versionId,
      object_key: source.objectKey,
      size_bytes: source.sizeBytes,
      checksum_sha256: source.checksumSha256,
      generation: source.generation,
      expected_pointer_etag: source.expectedPointerEtag,
      expected_pointer_absent: source.expectedPointerAbsent,
    },
    async () => {
      const confirmation = assetMutationAttestation(
        administratorId,
        "cv_confirm",
        [claimToken],
      );
      const { data: confirmed, error } = await supabase.rpc(
        "confirm_current_cv_transition",
        {
          p_claim_token: claimToken,
          p_attestation_timestamp: confirmation.timestamp,
          p_attestation_signature: confirmation.signature,
        },
      );
      return !error && confirmed === true;
    },
  );
}

export async function setCurrentCv(versionId: string): Promise<MutationResult> {
  const [admin, supabase] = await Promise.all([
    getAdminIdentity(),
    createSupabaseServerClient(),
  ]);
  if (!admin || !supabase) return { ok: false, error: { code: "unauthorized", message: "Admin access is required." } };
  let transitionClaimed = false;
  try {
    const expectedVersionId = await currentCvVersionId(supabase);
    const source = await readCvSource(supabase, versionId);
    if (!source) {
      return {
        ok: false,
        error: { code: "cv_version_not_ready", message: "The CV version is not ready." },
      };
    }
    const pointer = await readCurrentCvPointer();
    if (!pointer) {
      return {
        ok: false,
        error: {
          code: "cv_storage_not_configured",
          message: "Public CV storage is not configured.",
        },
      };
    }
    const generation = randomUUID();
    const expectedPointerAbsent = "absent" in pointer;
    const expectedPointerEtag = expectedPointerAbsent ? null : pointer.etag;
    const claim = assetMutationAttestation(admin.id, "cv_claim", [
      source.versionId,
      expectedVersionId ?? "",
      generation,
      source.checksumSha256,
      expectedPointerEtag ?? "",
      String(expectedPointerAbsent),
    ]);
    const { data: transitionData, error: claimError } = await supabase
      .rpc("claim_current_cv_transition", {
        p_cv_version_id: source.versionId,
        p_expected_cv_version_id: expectedVersionId,
        p_generation: generation,
        p_checksum_sha256: source.checksumSha256,
        p_expected_pointer_etag: expectedPointerEtag,
        p_expected_pointer_absent: expectedPointerAbsent,
        p_attestation_timestamp: claim.timestamp,
        p_attestation_signature: claim.signature,
      })
      .single();
    const transition = transitionData as CvTransition | null;
    if (claimError || !transition || typeof transition.claim_token !== "string") {
      return {
        ok: false,
        error: {
          code: claimError?.message.includes("stale_current_cv")
            ? "cv_current_conflict"
            : "cv_current_busy",
          message: claimError?.message.includes("stale_current_cv")
            ? "The current CV changed in another session. Refresh and try again."
            : "A CV update is already being processed. Try again shortly.",
        },
      };
    }
    transitionClaimed = true;

    const claimedSource: CvSource & {
      generation: string;
      expectedPointerEtag: string | null;
      expectedPointerAbsent: boolean;
    } = {
      versionId: transition.cv_version_id,
      objectKey: transition.object_key,
      sizeBytes: transition.size_bytes,
      checksumSha256: transition.checksum_sha256,
      generation: transition.generation,
      expectedPointerEtag: transition.expected_pointer_etag,
      expectedPointerAbsent: transition.expected_pointer_absent,
    };
    if (!(await writeClaimedCv(
      supabase,
      admin.id,
      claimedSource,
      transition.claim_token,
    ))) {
      return {
        ok: false,
        error: {
          code: "cv_current_recovery_pending",
          message: "The CV update is retained for recovery and may need administrator review.",
        },
      };
    }

    const finish = assetMutationAttestation(admin.id, "cv_finish", [
      claimedSource.versionId,
      claimedSource.generation,
      claimedSource.checksumSha256,
      transition.claim_token,
    ]);
    const { error } = await supabase.rpc("finish_current_cv_transition", {
      p_cv_version_id: claimedSource.versionId,
      p_generation: claimedSource.generation,
      p_checksum_sha256: claimedSource.checksumSha256,
      p_claim_token: transition.claim_token,
      p_attestation_timestamp: finish.timestamp,
      p_attestation_signature: finish.signature,
    });
    if (error) {
      return {
        ok: false,
        error: {
          code: "cv_current_recovery_pending",
          message: "The CV update will be recovered automatically.",
        },
      };
    }
    transitionClaimed = false;
    revalidatePath("/admin/cv");
    revalidatePath("/resume.pdf");
    return { ok: true, data: undefined };
  } catch (error) {
    return transitionClaimed
      ? {
          ok: false,
          error: {
            code: "cv_current_recovery_pending",
            message: "The CV update is retained for recovery and may need administrator review.",
          },
        }
      : failure(error);
  }
}
