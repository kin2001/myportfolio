import { NextResponse } from "next/server";
import {
  assetError,
  assetSuccess,
  isAssetPurpose,
  isMimeAllowed,
  MAX_TRACKED_BYTES,
  maxBytesForPurpose,
  newAssetIdentity,
} from "@/lib/assets";
import { createPrivateUploadToken } from "@/lib/supabase/storage";
import { getAdminIdentity } from "@/lib/supabase/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSameOrigin, readJsonObject, RequestBodyError } from "@/lib/request-security";

function cleanFileName(value: unknown) {
  if (typeof value !== "string") return null;
  const name = value.split(/[\\/]/).pop()?.trim();
  return name && name.length <= 255 && !/[\u0000-\u001f\u007f]/.test(name)
    ? name
    : null;
}

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

  const purpose = body.purpose;
  const fileName = cleanFileName(body.fileName);
  const mimeType =
    typeof body.mimeType === "string" ? body.mimeType.trim().toLowerCase() : "";
  const sizeBytes = body.sizeBytes;
  const fieldErrors: Record<string, string> = {};

  if (!isAssetPurpose(purpose)) fieldErrors.purpose = "Select a supported asset purpose.";
  if (!fileName) fieldErrors.fileName = "Use a filename between 1 and 255 characters.";
  if (
    !Number.isSafeInteger(sizeBytes) ||
    (sizeBytes as number) <= 0
  ) {
    fieldErrors.sizeBytes = "File size must be a positive integer.";
  }
  if (isAssetPurpose(purpose)) {
    if (!isMimeAllowed(purpose, mimeType)) {
      fieldErrors.mimeType = "This file type is not allowed for the selected purpose.";
    } else if (
      Number.isSafeInteger(sizeBytes) &&
      (sizeBytes as number) > maxBytesForPurpose(purpose)
    ) {
      fieldErrors.sizeBytes =
        purpose.endsWith("_image")
          ? "Images must be 8 MB or smaller."
          : "PDF files must be 10 MB or smaller.";
    }
  }

  if (Object.keys(fieldErrors).length) {
    return NextResponse.json(
      assetError("invalid_asset", "Check the selected file.", fieldErrors),
      { status: 400 },
    );
  }

  const { data: trackedRows, error: storageError } = await supabase
    .from("assets")
    .select(
      "id,size_bytes,private_derivative_size_bytes,public_object_key,public_mime_type",
    );
  if (storageError) {
    return NextResponse.json(
      assetError("storage_check_failed", "Tracked storage could not be checked."),
      { status: 503 },
    );
  }

  const trackedBytes = (trackedRows ?? []).reduce(
    (total, row) => {
      const original = Number(row.size_bytes ?? 0);
      const derivative = Number(row.private_derivative_size_bytes ?? 0);
      const publicCopy = row.public_object_key
        ? row.public_mime_type === "image/webp"
          ? derivative
          : original
        : 0;
      return total + original + derivative + publicCopy;
    },
    0,
  );

  if (
    trackedBytes + (sizeBytes as number) >
    MAX_TRACKED_BYTES
  ) {
    return NextResponse.json(
      assetError(
        "storage_limit_reached",
        "New uploads are blocked because tracked storage would exceed 900 MB.",
      ),
      { status: 409 },
    );
  }

  const { id, objectKey } = newAssetIdentity(admin.id);
  let signed: { path: string; token: string } | null;
  try {
    signed = await createPrivateUploadToken(objectKey);
  } catch {
    signed = null;
  }
  if (!signed) {
    return NextResponse.json(
      assetError("storage_unavailable", "Supabase Storage is not configured or unavailable."),
      { status: 503 },
    );
  }

  const { error: insertError } = await supabase.from("assets").insert({
    id,
    purpose,
    original_filename: fileName,
    object_key: objectKey,
    mime_type: mimeType,
    size_bytes: sizeBytes,
    owner_id: admin.id,
  });
  if (insertError) {
    return NextResponse.json(
      assetError("asset_create_failed", "The upload record could not be created."),
      { status: 500 },
    );
  }

  return NextResponse.json(
    assetSuccess({
      assetId: id,
      uploadPath: signed.path,
      uploadToken: signed.token,
    }),
    { status: 201 },
  );
}
