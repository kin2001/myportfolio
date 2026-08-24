"use server";

import { revalidatePath } from "next/cache";
import type { MutationResult } from "@/lib/portfolio-types";
import { getAdminIdentity } from "@/lib/supabase/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

  const [admin, supabase] = await Promise.all([
    getAdminIdentity(),
    createSupabaseServerClient(),
  ]);
  if (!admin || !supabase) {
    return {
      ok: false,
      error: { code: "unauthorized", message: "Admin access is required." },
    };
  }

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

export async function setCurrentCv(versionId: string): Promise<MutationResult> {
  const [admin, supabase] = await Promise.all([
    getAdminIdentity(),
    createSupabaseServerClient(),
  ]);
  if (!admin || !supabase) {
    return {
      ok: false,
      error: { code: "unauthorized", message: "Admin access is required." },
    };
  }

  try {
    const { error } = await supabase.rpc("set_current_cv", {
      p_cv_version_id: versionId,
    });
    if (error) throw error;
    revalidatePath("/admin/cv");
    revalidatePath("/resume.pdf");
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}
