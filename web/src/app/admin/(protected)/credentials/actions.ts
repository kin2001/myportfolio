"use server";

import { revalidatePath } from "next/cache";
import { publishAsset, rollbackPublishedAsset } from "@/lib/assets";
import { triggerProductionBuild } from "@/lib/deploy";
import type { CredentialInput } from "@/components/credential-editor";
import type { MutationResult } from "@/lib/portfolio-types";
import { getAdminIdentity } from "@/lib/supabase/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function failure(error: unknown): MutationResult<never> {
  const message = error instanceof Error
    ? error.message
    : typeof error === "object" && error && "message" in error
      ? String(error.message)
      : "The credential operation failed.";
  const code = message.includes("stale_lock_version") ? "stale_lock_version" : "credential_operation_failed";
  return {
    ok: false,
    error: {
      code,
      message: code === "stale_lock_version"
        ? "This credential changed in another session. Refresh before saving again."
        : message,
    },
  };
}

function rejected(code: string, message: string): MutationResult<never> {
  return { ok: false, error: { code, message } };
}

function validateCredentialInput(input: CredentialInput) {
  if (!input.name.trim() || input.name.trim().length > 160) {
    return rejected(
      "invalid_credential_name",
      "Credential names must be between 1 and 160 characters.",
    );
  }
  if (input.issuer.trim().length > 160) {
    return rejected(
      "invalid_credential_issuer",
      "Credential issuers must be 160 characters or fewer.",
    );
  }
  if (
    input.skills.length > 50 ||
    input.skills.some((skill) => !skill.trim() || skill.length > 100)
  ) {
    return rejected(
      "invalid_credential_skills",
      "Use no more than 50 skills of 100 characters each.",
    );
  }
  if (input.verificationUrl) {
    try {
      const url = new URL(input.verificationUrl);
      if (url.protocol !== "https:" || input.verificationUrl.length > 2048) {
        throw new Error();
      }
    } catch {
      return rejected(
        "invalid_verification_url",
        "Verification URLs must be valid HTTPS URLs of 2,048 characters or fewer.",
      );
    }
  }
  if ((input.evidenceAlt?.length ?? 0) > 500) {
    return rejected(
      "invalid_evidence_alt",
      "Evidence alt text must be 500 characters or fewer.",
    );
  }
  return null;
}

async function adminClient() {
  const [admin, supabase] = await Promise.all([getAdminIdentity(), createSupabaseServerClient()]);
  return admin && supabase ? supabase : null;
}

export async function createCredential(name: string): Promise<MutationResult<{ id: string }>> {
  if (!name.trim() || name.trim().length > 160) {
    return rejected(
      "invalid_credential_name",
      "Credential names must be between 1 and 160 characters.",
    );
  }
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: { code: "unauthorized", message: "Admin access is required." } };
  try {
    const { data, error } = await supabase.rpc("create_credential", { p_name: name.trim() });
    if (error) throw error;
    revalidatePath("/admin/credentials");
    return { ok: true, data: { id: data.id } };
  } catch (error) {
    return failure(error);
  }
}

export async function saveCredential(input: CredentialInput): Promise<MutationResult<{ lockVersion: number }>> {
  const invalid = validateCredentialInput(input);
  if (invalid) return invalid;
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: { code: "unauthorized", message: "Admin access is required." } };
  try {
    const { data, error } = await supabase.rpc("save_credential", {
      p_credential_id: input.id,
      p_expected_lock_version: input.lockVersion,
      p_name: input.name,
      p_issuer: input.issuer,
      p_issue_date: input.issueDate,
      p_expiry_date: input.expiryDate,
      p_skills: input.skills,
      p_related_project_id: input.relatedProjectId,
      p_verification_url: input.verificationUrl,
      p_evidence_asset_id: input.evidenceAssetId,
      p_evidence_visibility: input.evidenceVisibility,
      p_evidence_alt: input.evidenceAlt,
      p_redaction_confirmed: input.redactionConfirmed,
    });
    if (error) throw error;
    revalidatePath("/admin/credentials");
    return { ok: true, data: { lockVersion: data.lock_version } };
  } catch (error) {
    return failure(error);
  }
}

export async function publishCredential(
  id: string,
  lockVersion: number,
): Promise<MutationResult<{ deploymentTriggered: boolean }>> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: { code: "unauthorized", message: "Admin access is required." } };
  try {
    const { data: credential, error: readError } = await supabase
      .from("credentials")
      .select(
        "name,issuer,issue_date,expiry_date,skills,related_project_id,verification_url,evidence_asset_id,evidence_visibility,evidence_alt,redaction_confirmed,lock_version",
      )
      .eq("id", id)
      .single();
    if (readError) throw readError;
    if (credential.lock_version !== lockVersion) {
      return rejected(
        "stale_lock_version",
        "This credential changed in another session. Refresh before publishing.",
      );
    }
    if (
      !credential.name.trim() ||
      credential.name.length > 160 ||
      !credential.issuer.trim() ||
      credential.issuer.length > 160 ||
      !credential.issue_date ||
      credential.skills.length > 50 ||
      credential.skills.some(
        (skill: string) => !skill.trim() || skill.length > 100,
      ) ||
      (credential.verification_url?.length ?? 0) > 2048 ||
      (credential.evidence_alt?.length ?? 0) > 500 ||
      (!credential.verification_url && !credential.evidence_asset_id)
    ) {
      return rejected(
        "credential_preflight_failed",
        "Complete the required credential fields before publication.",
      );
    }
    if (credential.related_project_id) {
      const { data: relatedProject, error: relatedError } = await supabase
        .from("projects")
        .select("id")
        .eq("id", credential.related_project_id)
        .eq("lifecycle_state", "published")
        .maybeSingle();
      if (relatedError || !relatedProject) {
        return rejected(
          "credential_preflight_failed",
          "The related project must be published first.",
        );
      }
    }

    let newlyPublished:
      | { assetId: string; publicObjectKey: string }
      | undefined;
    if (credential.evidence_asset_id) {
      const { data: asset, error: assetError } = await supabase
        .from("assets")
        .select(
          "id,purpose,mime_type,processing_state,visibility,private_derivative_key,public_object_key,public_mime_type,publication_permission_confirmed_at",
        )
        .eq("id", credential.evidence_asset_id)
        .maybeSingle();
      const isImage = asset?.purpose === "credential_image";
      const isPublic =
        asset?.processing_state === "published" &&
        asset.visibility === "public" &&
        Boolean(asset.public_object_key) &&
        asset.public_mime_type ===
          (isImage ? "image/webp" : "application/pdf") &&
        Boolean(asset.publication_permission_confirmed_at);
      const isReady =
        asset?.processing_state === "ready" &&
        asset.visibility === "private" &&
        (asset.purpose === "credential_pdf" ||
          Boolean(asset.private_derivative_key));
      if (
        assetError ||
        !asset ||
        !["credential_image", "credential_pdf"].includes(asset.purpose) ||
        !credential.redaction_confirmed ||
        (credential.evidence_visibility === "public"
          ? !isReady && !isPublic
          : !isReady) ||
        (credential.evidence_visibility === "public" &&
          isImage &&
          !credential.evidence_alt?.trim())
      ) {
        return rejected(
          "credential_preflight_failed",
          "Review the selected evidence, visibility, redaction, and alt text.",
        );
      }
      if (credential.evidence_visibility === "public") {
        const published = await publishAsset(credential.evidence_asset_id);
        if (!published.ok) return published;
        if (published.data.newlyPublished) {
          newlyPublished = {
            assetId: credential.evidence_asset_id,
            publicObjectKey: published.data.publicObjectKey,
          };
        }
      }
    }
    const { error } = await supabase.rpc("publish_credential", {
      p_credential_id: id,
      p_expected_lock_version: lockVersion,
    });
    if (error) {
      if (newlyPublished) {
        const compensated = await rollbackPublishedAsset(
          newlyPublished.assetId,
          newlyPublished.publicObjectKey,
        );
        if (!compensated) {
          return rejected(
            "asset_compensation_failed",
            "The newly public credential evidence needs administrator review.",
          );
        }
      }
      throw error;
    }
    revalidatePath("/admin/credentials");
    revalidatePath("/credentials");
    const deployment = await triggerProductionBuild();
    return { ok: true, data: { deploymentTriggered: deployment.ok } };
  } catch (error) {
    return failure(error);
  }
}

export async function archiveCredential(
  id: string,
): Promise<MutationResult<{ deploymentTriggered: boolean }>> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: { code: "unauthorized", message: "Admin access is required." } };
  try {
    const { error } = await supabase.rpc("archive_credential", { p_credential_id: id });
    if (error) throw error;
    revalidatePath("/admin/credentials");
    revalidatePath("/credentials");
    const deployment = await triggerProductionBuild();
    return { ok: true, data: { deploymentTriggered: deployment.ok } };
  } catch (error) {
    return failure(error);
  }
}

export async function retryCredentialDeployment(): Promise<MutationResult> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: { code: "unauthorized", message: "Admin access is required." } };
  const { error: auditError } = await supabase.rpc("record_deployment_retry");
  if (auditError) {
    return rejected(
      "audit_unavailable",
      "The deployment retry could not be audited.",
    );
  }
  const result = await triggerProductionBuild();
  return result.ok ? { ok: true, data: undefined } : result;
}
