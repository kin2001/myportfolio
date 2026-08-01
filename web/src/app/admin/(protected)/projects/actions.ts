"use server";

import { revalidatePath } from "next/cache";
import { getAdminIdentity } from "@/lib/supabase/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { publishAsset, rollbackPublishedAsset } from "@/lib/assets";
import { triggerProductionBuild } from "@/lib/deploy";
import type {
  MutationResult,
  ProjectDocumentBlock,
  ProjectLink,
} from "@/lib/portfolio-types";

type SavedDraft = {
  project_id: string;
  lock_version: number;
  updated_at: string;
};

type ProjectMutationInput = {
  projectId: string;
  expectedLockVersion: number;
  title: string;
  document: ProjectDocumentBlock[];
  coverAssetId: string | null;
  coverAlt: string;
  links: ProjectLink[];
};

type PublishedAssetChange = {
  assetId: string;
  publicObjectKey: string;
};

const errorMessages: Record<string, { message: string; field?: string }> = {
  title_required: { message: "Enter a project title.", field: "title" },
  invalid_document: { message: "Review the documentation blocks.", field: "document" },
  invalid_links: { message: "Links must have labels and valid HTTPS URLs.", field: "links" },
  stale_lock_version: {
    message: "Another administrator saved this project. Reload before saving again.",
  },
  project_not_publishable: {
    message: "Add a title and at least one nonempty documentation text block.",
    field: "document",
  },
  document_asset_not_publishable: {
    message: "Every documentation image must be ready, permitted, and have alt text.",
    field: "document",
  },
  cover_asset_not_publishable: {
    message: "The cover image is not ready for publication.",
    field: "cover",
  },
};

function failure(
  code: string,
  message: string,
  fieldErrors?: Record<string, string>,
): MutationResult<never> {
  return { ok: false, error: { code, message, fieldErrors } };
}

function databaseFailure(error: { message?: string; code?: string } | null): MutationResult<never> {
  const text = error?.message ?? "";
  const stableCode =
    Object.keys(errorMessages).find((code) => text.includes(code)) ??
    (error?.code === "42501" ? "admin_not_allowed" : "mutation_failed");
  const known = errorMessages[stableCode];
  return failure(
    stableCode,
    known?.message ?? "The project could not be updated. Try again.",
    known?.field ? { [known.field]: known.message } : undefined,
  );
}

async function adminClient() {
  const [admin, supabase] = await Promise.all([
    getAdminIdentity(),
    createSupabaseServerClient(),
  ]);
  return admin && supabase ? supabase : null;
}

async function compensateAssetPublications(changes: PublishedAssetChange[]) {
  const results = await Promise.all(
    changes.map(({ assetId, publicObjectKey }) =>
      rollbackPublishedAsset(assetId, publicObjectKey),
    ),
  );
  return results.every(Boolean);
}

function validateDraft(input: ProjectMutationInput): MutationResult<never> | null {
  if (!input.title.trim()) {
    return failure("title_required", "Enter a project title.", {
      title: "Enter a project title.",
    });
  }
  if (input.title.trim().length > 160) {
    return failure("title_too_long", "Project titles must be 160 characters or fewer.", {
      title: "Shorten the project title.",
    });
  }
  if (!Array.isArray(input.document)) {
    return failure("invalid_document", "Review the documentation blocks.", {
      document: "Documentation must be an ordered list.",
    });
  }
  if (
    input.document.length > 100 ||
    Buffer.byteLength(JSON.stringify(input.document), "utf8") > 1_000_000
  ) {
    return failure("document_too_large", "The project documentation is too large.", {
      document: "Use no more than 100 blocks and 1 MB of structured text.",
    });
  }
  if (input.links.length > 20) {
    return failure("too_many_links", "Use no more than 20 project links.", {
      links: "Remove unnecessary links.",
    });
  }
  const invalidLink = input.links.find(
    (link) =>
      !link.label.trim() ||
      link.label.trim().length > 100 ||
      link.url.length > 2048 ||
      (() => {
        try {
          return new URL(link.url).protocol !== "https:";
        } catch {
          return true;
        }
      })(),
  );
  if (invalidLink) {
    return failure("invalid_links", "Links must have labels and valid HTTPS URLs.", {
      links: "Use a label and an HTTPS URL for every link.",
    });
  }
  return null;
}

export async function createProjectAction(
  title: string,
): Promise<MutationResult<{ projectId: string }>> {
  if (!title.trim()) {
    return failure("title_required", "Enter a project title.", {
      title: "Enter a project title.",
    });
  }
  if (title.trim().length > 160) {
    return failure("title_too_long", "Project titles must be 160 characters or fewer.", {
      title: "Shorten the project title.",
    });
  }
  const supabase = await adminClient();
  if (!supabase) return failure("admin_not_allowed", "Your admin session is unavailable.");

  const { data, error } = await supabase.rpc("create_project", { p_title: title.trim() });
  if (error || !data) return databaseFailure(error);
  const draft = data as SavedDraft;
  revalidatePath("/admin/projects");
  return { ok: true, data: { projectId: draft.project_id } };
}

export async function saveProjectAction(
  input: ProjectMutationInput,
): Promise<MutationResult<{ lockVersion: number; updatedAt: string }>> {
  const invalid = validateDraft(input);
  if (invalid) return invalid;
  const supabase = await adminClient();
  if (!supabase) return failure("admin_not_allowed", "Your admin session is unavailable.");

  const { data, error } = await supabase.rpc("save_project_draft", {
    p_project_id: input.projectId,
    p_expected_lock_version: input.expectedLockVersion,
    p_title: input.title.trim(),
    p_document: input.document,
    p_cover_asset_id: input.coverAssetId,
    p_cover_alt: input.coverAlt.trim() || null,
    p_links: input.links,
  });
  if (error || !data) return databaseFailure(error);
  const draft = data as SavedDraft;
  revalidatePath("/admin/projects");
  revalidatePath(`/admin/projects/${input.projectId}`);
  revalidatePath(`/admin/projects/${input.projectId}/preview`);
  return {
    ok: true,
    data: { lockVersion: draft.lock_version, updatedAt: draft.updated_at },
  };
}

export async function publishProjectAction(input: {
  projectId: string;
  expectedLockVersion: number;
  mediaPermissionConfirmed: boolean;
}): Promise<MutationResult<{ deploymentTriggered: boolean }>> {
  const supabase = await adminClient();
  if (!supabase) return failure("admin_not_allowed", "Your admin session is unavailable.");

  const { data: draft, error: draftError } = await supabase
    .from("project_drafts")
    .select("title,document,cover_asset_id,cover_alt,links,lock_version")
    .eq("project_id", input.projectId)
    .single();
  if (draftError || !draft) return databaseFailure(draftError);
  if (draft.lock_version !== input.expectedLockVersion) {
    return databaseFailure({ message: "stale_lock_version", code: "40001" });
  }

  const document = draft.document as ProjectDocumentBlock[];
  const invalid = validateDraft({
    projectId: input.projectId,
    expectedLockVersion: input.expectedLockVersion,
    title: draft.title,
    document,
    coverAssetId: draft.cover_asset_id,
    coverAlt: draft.cover_alt ?? "",
    links: draft.links as ProjectLink[],
  });
  if (invalid) return invalid;
  if (!document.some((block) => block.type === "text" && block.body.trim())) {
    return failure(
      "project_not_publishable",
      "Add at least one nonempty documentation text block.",
      { document: "Documentation text is required before publication." },
    );
  }
  const assetIds = [
    draft.cover_asset_id as string | null,
    ...document
      .filter((block): block is Extract<ProjectDocumentBlock, { type: "image" }> => block.type === "image")
      .map((block) => block.assetId),
  ].filter((id): id is string => Boolean(id));

  if (assetIds.length && !input.mediaPermissionConfirmed) {
    return failure("media_permission_required", "Confirm permission to publish the selected media.", {
      mediaPermission: "Confirmation is required before media can be published.",
    });
  }
  const missingAlt = document.find((block) => block.type === "image" && !block.alt.trim());
  if (missingAlt) {
    return failure("image_alt_required", "Add alt text for every documentation image.", {
      document: "Every meaningful image needs alt text.",
    });
  }
  if (draft.cover_asset_id && !draft.cover_alt?.trim()) {
    return failure("cover_alt_required", "Add alt text for the project cover.", {
      cover: "The project cover needs alt text.",
    });
  }

  const uniqueAssetIds = [...new Set(assetIds)];
  if (uniqueAssetIds.length) {
    const { data: assetRows, error: assetError } = await supabase
      .from("assets")
      .select(
        "id,purpose,processing_state,visibility,private_derivative_key,public_object_key,public_mime_type,publication_permission_confirmed_at",
      )
      .in("id", uniqueAssetIds);
    if (assetError || assetRows?.length !== uniqueAssetIds.length) {
      return failure(
        "project_asset_preflight_failed",
        "Every selected project image must exist and be available.",
      );
    }
    const invalidAsset = assetRows.find(
      (asset) =>
        asset.purpose !== "project_image" ||
        (asset.processing_state === "ready"
          ? asset.visibility !== "private" || !asset.private_derivative_key
          : asset.processing_state !== "published" ||
            asset.visibility !== "public" ||
            !asset.public_object_key ||
            asset.public_mime_type !== "image/webp" ||
            !asset.publication_permission_confirmed_at),
    );
    if (invalidAsset) {
      return failure(
        "project_asset_preflight_failed",
        "Every selected project image must be validated before publication.",
      );
    }
  }

  const newlyPublished: PublishedAssetChange[] = [];
  for (const assetId of uniqueAssetIds) {
    const published = await publishAsset(assetId);
    if (!published.ok) {
      const compensated = await compensateAssetPublications(newlyPublished);
      return compensated
        ? failure(published.error.code, published.error.message)
        : failure(
            "asset_compensation_failed",
            "Some newly public project assets need administrator review.",
          );
    }
    if (published.data.newlyPublished) {
      newlyPublished.push({
        assetId,
        publicObjectKey: published.data.publicObjectKey,
      });
    }
  }

  const { error } = await supabase.rpc("publish_project", {
    p_project_id: input.projectId,
    p_expected_lock_version: input.expectedLockVersion,
  });
  if (error) {
    const compensated = await compensateAssetPublications(newlyPublished);
    return compensated
      ? databaseFailure(error)
      : failure(
          "asset_compensation_failed",
          "Some newly public project assets need administrator review.",
        );
  }

  const deployment = await triggerProductionBuild();
  revalidatePath("/admin/projects");
  revalidatePath(`/admin/projects/${input.projectId}`);
  return { ok: true, data: { deploymentTriggered: deployment.ok } };
}

export async function archiveProjectAction(
  projectId: string,
): Promise<MutationResult<{ deploymentTriggered: boolean }>> {
  const supabase = await adminClient();
  if (!supabase) return failure("admin_not_allowed", "Your admin session is unavailable.");
  const { error } = await supabase.rpc("archive_project", { p_project_id: projectId });
  if (error) return databaseFailure(error);

  const deployment = await triggerProductionBuild();
  revalidatePath("/admin/projects");
  revalidatePath(`/admin/projects/${projectId}`);
  return { ok: true, data: { deploymentTriggered: deployment.ok } };
}

export async function reorderProjectsAction(input: {
  orderedProjectIds: string[];
}): Promise<MutationResult<{ deploymentTriggered: boolean }>> {
  const supabase = await adminClient();
  if (!supabase) return failure("admin_not_allowed", "Your admin session is unavailable.");
  if (
    !input.orderedProjectIds.length ||
    new Set(input.orderedProjectIds).size !== input.orderedProjectIds.length
  ) {
    return failure("invalid_project_order", "The project order is invalid.");
  }
  const { data: originals, error: originalsError } = await supabase
    .from("projects")
    .select("id,display_order")
    .in("id", input.orderedProjectIds);
  if (originalsError || originals?.length !== input.orderedProjectIds.length) {
    return databaseFailure(originalsError);
  }
  for (const [displayOrder, projectId] of input.orderedProjectIds.entries()) {
    const result = await supabase.rpc("set_project_order", {
      p_project_id: projectId,
      p_display_order: displayOrder,
    });
    if (result.error) {
      for (const original of originals) {
        await supabase.rpc("set_project_order", {
          p_project_id: original.id,
          p_display_order: original.display_order,
        });
      }
      return databaseFailure(result.error);
    }
  }

  const deployment = await triggerProductionBuild();
  revalidatePath("/admin/projects");
  return { ok: true, data: { deploymentTriggered: deployment.ok } };
}

export async function retryProjectDeploymentAction(): Promise<MutationResult<undefined>> {
  const supabase = await adminClient();
  if (!supabase) {
    return failure("admin_not_allowed", "Your admin session is unavailable.");
  }
  const { error: auditError } = await supabase.rpc("record_deployment_retry");
  if (auditError) {
    return failure("audit_unavailable", "The deployment retry could not be audited.");
  }
  const result = await triggerProductionBuild();
  return result.ok
    ? { ok: true, data: undefined }
    : failure(result.error.code, result.error.message);
}
