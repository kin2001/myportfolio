import { NextResponse } from "next/server";
import {
  assetMutationAttestation,
  assetError,
  assetSuccess,
  createAssetPreviewUrl,
  detectAssetMime,
  isMimeAllowed,
  maxBytesForPurpose,
  newImageDerivativeKey,
  optimizeImage,
  sha256,
  type AssetRow,
} from "@/lib/assets";
import {
  createPrivatePreviewUrl,
  deletePrivateObject,
  headPrivateObject,
  readPrivateObject,
  writePrivateObject,
} from "@/lib/supabase/storage";
import { getAdminIdentity } from "@/lib/supabase/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSameOrigin, readJsonObject, RequestBodyError } from "@/lib/request-security";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/i;

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "origin_not_allowed" }, { status: 403 });
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

  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(request, 4_096);
  } catch (error) {
    return NextResponse.json(
      assetError("invalid_json", "Send a valid JSON request."),
      { status: error instanceof RequestBodyError ? error.status : 400 },
    );
  }

  const assetId = typeof body.assetId === "string" ? body.assetId : "";
  const suppliedChecksum =
    typeof body.checksumSha256 === "string"
      ? body.checksumSha256.trim().toLowerCase()
      : undefined;
  const fieldErrors: Record<string, string> = {};
  if (!UUID.test(assetId)) fieldErrors.assetId = "Use a valid asset ID.";
  if (suppliedChecksum !== undefined && !SHA256.test(suppliedChecksum)) {
    fieldErrors.checksumSha256 = "Checksum must be a 64-character SHA-256 value.";
  }
  if (Object.keys(fieldErrors).length) {
    return NextResponse.json(
      assetError("invalid_finalize_request", "Check the finalize request.", fieldErrors),
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("assets")
    .select(
      "id,purpose,original_filename,object_key,private_derivative_key,private_derivative_size_bytes,public_object_key,public_mime_type,mime_type,width,height,size_bytes,checksum_sha256,processing_state,visibility,owner_id",
    )
    .eq("id", assetId)
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json(
      assetError("asset_not_found", "Asset was not found."),
      { status: 404 },
    );
  }

  const asset = data as AssetRow;
  if (asset.processing_state === "deleting") {
    return NextResponse.json(
      assetError("asset_cleanup_claimed", "This abandoned upload is being cleaned up."),
      { status: 409 },
    );
  }
  if (asset.processing_state !== "pending") {
    const previewUrl = await createAssetPreviewUrl(asset).catch(() => null);
    return NextResponse.json(
      assetSuccess({ assetId: asset.id, ...(previewUrl ? { previewUrl } : {}) }),
    );
  }

  let head;
  let bytes;
  try {
    head = await headPrivateObject(asset.object_key);
    bytes = await readPrivateObject(asset.object_key);
  } catch {
    return NextResponse.json(
      assetError("upload_missing", "The uploaded object could not be read."),
      { status: 404 },
    );
  }
  if (!head || !bytes) {
    return NextResponse.json(
      assetError("storage_unavailable", "Supabase Storage is not configured or unavailable."),
      { status: 503 },
    );
  }

  const actualSize = head.ContentLength;
  if (
    actualSize === undefined ||
    actualSize !== bytes.byteLength ||
    actualSize !== asset.size_bytes ||
    actualSize > maxBytesForPurpose(asset.purpose)
  ) {
    return NextResponse.json(
      assetError("asset_size_mismatch", "Uploaded file size does not match the request."),
      { status: 400 },
    );
  }

  const actualMime = detectAssetMime(bytes);
  if (
    !actualMime ||
    actualMime !== asset.mime_type ||
    !isMimeAllowed(asset.purpose, actualMime)
  ) {
    return NextResponse.json(
      assetError("asset_signature_mismatch", "The file content does not match its type."),
      { status: 400 },
    );
  }

  const checksum = sha256(bytes);
  if (suppliedChecksum && checksum !== suppliedChecksum) {
    return NextResponse.json(
      assetError("asset_checksum_mismatch", "The uploaded file checksum did not match."),
      { status: 400 },
    );
  }

  let derivative:
    | { key: string; body: Buffer; width: number; height: number }
    | undefined;
  if (asset.purpose.endsWith("_image")) {
    try {
      const optimized = await optimizeImage(bytes, actualMime);
      derivative = {
        key: newImageDerivativeKey(asset.id),
        ...optimized,
      };
      const stored = await writePrivateObject(
        derivative.key,
        derivative.body,
        "image/webp",
      );
      if (!stored) throw new Error("Supabase Storage is not configured.");
    } catch (optimizationError) {
      const message =
        optimizationError instanceof Error &&
        optimizationError.message.includes("2400")
          ? "Images must be no more than 2400 pixels on their longest edge."
          : optimizationError instanceof Error &&
              optimizationError.message.includes("8 MB")
            ? "The optimized image must be 8 MB or smaller."
          : "The image could not be decoded safely.";
      return NextResponse.json(
        assetError("image_validation_failed", message),
        { status: 400 },
      );
    }
  }

  let attestation;
  try {
    attestation = assetMutationAttestation(admin.id, "finalize", [
      asset.id,
      actualMime,
      String(actualSize),
      checksum,
      derivative ? String(derivative.width) : "",
      derivative ? String(derivative.height) : "",
      derivative?.key ?? "",
      derivative ? String(derivative.body.byteLength) : "",
    ]);
  } catch {
    if (derivative) {
      await deletePrivateObject(derivative.key).catch(() => undefined);
    }
    return NextResponse.json(
      assetError(
        "asset_mutation_not_configured",
        "Server-attested asset updates are not configured.",
      ),
      { status: 503 },
    );
  }

  const { data: finalized, error: updateError } = await supabase.rpc(
    "finalize_asset",
    {
      p_asset_id: asset.id,
      p_mime_type: actualMime,
      p_size_bytes: actualSize,
      p_checksum_sha256: checksum,
      p_width: derivative?.width ?? null,
      p_height: derivative?.height ?? null,
      p_private_derivative_key: derivative?.key ?? null,
      p_private_derivative_size_bytes: derivative?.body.byteLength ?? null,
      p_attestation_timestamp: attestation.timestamp,
      p_attestation_signature: attestation.signature,
    },
  );
  if (updateError || finalized !== true) {
    const { data: current } = await supabase
      .from("assets")
      .select("processing_state,private_derivative_key")
      .eq("id", asset.id)
      .maybeSingle();
    if (
      current?.processing_state === "ready" &&
      current.private_derivative_key === (derivative?.key ?? null)
    ) {
      const previewUrl = await createPrivatePreviewUrl(
        derivative?.key ?? asset.object_key,
      ).catch(() => null);
      return NextResponse.json(
        assetSuccess({
          assetId: asset.id,
          ...(previewUrl ? { previewUrl } : {}),
        }),
      );
    }
    if (
      derivative &&
      current &&
      current.private_derivative_key !== derivative.key
    ) {
      await deletePrivateObject(derivative.key).catch(() => undefined);
    }
    return NextResponse.json(
      assetError(
        updateError?.code === "40001"
          ? "asset_finalize_conflict"
          : "asset_finalize_failed",
        updateError?.code === "40001"
          ? "The upload changed while it was being validated."
          : "The validated asset could not be saved.",
      ),
      { status: updateError?.code === "40001" ? 409 : 500 },
    );
  }

  const previewKey = derivative?.key ?? asset.object_key;
  const previewUrl = await createPrivatePreviewUrl(previewKey).catch(() => null);
  return NextResponse.json(
    assetSuccess({ assetId: asset.id, ...(previewUrl ? { previewUrl } : {}) }),
  );
}
