import "server-only";
import { createHash, createHmac, randomUUID } from "node:crypto";
import sharp from "sharp";
import type { MutationResult } from "@/lib/portfolio-types";
import { getAdminIdentity } from "@/lib/supabase/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  copyPrivateObjectToPublic,
  createPrivatePreviewUrl,
  deletePublicObject,
} from "@/lib/r2";

export const ASSET_PURPOSES = [
  "project_image",
  "credential_image",
  "credential_pdf",
  "cv_pdf",
] as const;

export type AssetPurpose = (typeof ASSET_PURPOSES)[number];
export type AssetMutationOperation =
  | "finalize"
  | "publish"
  | "revert"
  | "cleanup_claim"
  | "cleanup_finish"
  | "cleanup_release";

export const IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_PDF_BYTES = 10 * 1024 * 1024;
export const MAX_TRACKED_BYTES = 8 * 1024 * 1024 * 1024;

export type AssetRow = {
  id: string;
  purpose: AssetPurpose;
  original_filename: string;
  object_key: string;
  private_derivative_key: string | null;
  private_derivative_size_bytes: number | null;
  public_object_key: string | null;
  public_mime_type: string | null;
  mime_type: string;
  width: number | null;
  height: number | null;
  size_bytes: number;
  checksum_sha256: string | null;
  processing_state: "pending" | "deleting" | "ready" | "published";
  visibility: "private" | "public";
  owner_id: string;
};

export function isAssetPurpose(value: unknown): value is AssetPurpose {
  return (
    typeof value === "string" &&
    (ASSET_PURPOSES as readonly string[]).includes(value)
  );
}

export function isMimeAllowed(purpose: AssetPurpose, mimeType: string) {
  return purpose.endsWith("_image")
    ? (IMAGE_MIME_TYPES as readonly string[]).includes(mimeType)
    : mimeType === "application/pdf";
}

export function maxBytesForPurpose(purpose: AssetPurpose) {
  return purpose.endsWith("_image") ? MAX_IMAGE_BYTES : MAX_PDF_BYTES;
}

export function detectAssetMime(bytes: Uint8Array): string | null {
  const buffer = Buffer.from(bytes);
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))
  ) {
    return "image/png";
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(4, 8).toString("ascii") === "ftyp"
  ) {
    for (let offset = 8; offset + 4 <= Math.min(buffer.length, 32); offset += 4) {
      const brand = buffer.subarray(offset, offset + 4).toString("ascii");
      if (brand === "avif" || brand === "avis") return "image/avif";
    }
  }
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-") {
    return "application/pdf";
  }
  return null;
}

function assertSignatureDetection() {
  const cases: [Uint8Array, string][] = [
    [Buffer.from("ffd8ff", "hex"), "image/jpeg"],
    [Buffer.from("89504e470d0a1a0a", "hex"), "image/png"],
    [Buffer.from("524946460000000057454250", "hex"), "image/webp"],
    [Buffer.from("000000186674797061766966", "hex"), "image/avif"],
    [Buffer.from("%PDF-1.7"), "application/pdf"],
  ];
  for (const [bytes, expected] of cases) {
    if (detectAssetMime(bytes) !== expected) {
      throw new Error(`Asset signature self-check failed for ${expected}.`);
    }
  }
}

assertSignatureDetection();

export function assetError(
  code: string,
  message: string,
  fieldErrors?: Record<string, string>,
): MutationResult<never> {
  return { ok: false, error: { code, message, fieldErrors } };
}

export function assetSuccess<T>(data: T): MutationResult<T> {
  return { ok: true, data };
}

export async function getAssetForAdmin(assetId: string) {
  const [admin, supabase] = await Promise.all([
    getAdminIdentity(),
    createSupabaseServerClient(),
  ]);
  if (!admin || !supabase) return null;

  const { data, error } = await supabase
    .from("assets")
    .select(
      "id,purpose,original_filename,object_key,private_derivative_key,private_derivative_size_bytes,public_object_key,public_mime_type,mime_type,width,height,size_bytes,checksum_sha256,processing_state,visibility,owner_id",
    )
    .eq("id", assetId)
    .maybeSingle();

  return error || !data ? null : (data as AssetRow);
}

export async function createAssetPreviewUrl(asset: AssetRow) {
  if (!["ready", "published"].includes(asset.processing_state)) return null;
  const key =
    asset.private_derivative_key && asset.purpose.endsWith("_image")
      ? asset.private_derivative_key
      : asset.object_key;
  return createPrivatePreviewUrl(key);
}

export async function publishAsset(
  assetId: string,
): Promise<
  MutationResult<{ publicObjectKey: string; newlyPublished: boolean }>
> {
  const [admin, supabase] = await Promise.all([
    getAdminIdentity(),
    createSupabaseServerClient(),
  ]);
  if (!admin || !supabase) {
    return assetError("unauthorized", "Administrator access is required.");
  }

  const { data, error } = await supabase
    .from("assets")
    .select(
      "id,purpose,original_filename,object_key,private_derivative_key,private_derivative_size_bytes,public_object_key,public_mime_type,mime_type,width,height,size_bytes,checksum_sha256,processing_state,visibility,owner_id",
    )
    .eq("id", assetId)
    .maybeSingle();
  if (error || !data) return assetError("asset_not_found", "Asset was not found.");

  const asset = data as AssetRow;
  if (asset.purpose === "cv_pdf") {
    return assetError("invalid_asset_purpose", "CV files use the current CV action.");
  }
  if (asset.processing_state === "published" && asset.public_object_key) {
    return assetSuccess({
      publicObjectKey: asset.public_object_key,
      newlyPublished: false,
    });
  }
  if (asset.processing_state !== "ready") {
    return assetError("asset_not_ready", "Finish validating the asset before publishing.");
  }

  const isImage = asset.purpose.endsWith("_image");
  const sourceKey = isImage ? asset.private_derivative_key : asset.object_key;
  if (!sourceKey) {
    return assetError("asset_derivative_missing", "The validated image derivative is missing.");
  }

  const extension = isImage ? "webp" : "pdf";
  const publicObjectKey = `assets/${asset.id}.${extension}`;
  const publicMimeType = isImage ? "image/webp" : "application/pdf";
  let attestation;
  try {
    attestation = assetMutationAttestation(admin.id, "publish", [
      asset.id,
      publicObjectKey,
      publicMimeType,
    ]);
  } catch {
    return assetError(
      "asset_mutation_not_configured",
      "Server-attested asset updates are not configured.",
    );
  }

  let copied = false;
  try {
    copied = await copyPrivateObjectToPublic({
      sourceKey,
      publicKey: publicObjectKey,
      contentType: publicMimeType,
      cacheControl: "public,max-age=31536000,immutable",
    });
    if (!copied) return assetError("r2_unavailable", "Asset storage is not configured.");

    const { data: newlyPublished, error: updateError } = await supabase.rpc(
      "publish_asset",
      {
        p_asset_id: asset.id,
        p_public_object_key: publicObjectKey,
        p_public_mime_type: publicMimeType,
        p_attestation_timestamp: attestation.timestamp,
        p_attestation_signature: attestation.signature,
      },
    );

    if (updateError) {
      const compensated = await rollbackPublishedAsset(
        asset.id,
        publicObjectKey,
      );
      return assetError(
        compensated ? "asset_publish_failed" : "asset_publish_compensation_failed",
        compensated
          ? "The asset could not be published."
          : "The asset publication needs administrator review.",
      );
    }
    return assetSuccess({
      publicObjectKey,
      newlyPublished: newlyPublished === true,
    });
  } catch {
    const compensated = await rollbackPublishedAsset(
      asset.id,
      publicObjectKey,
    );
    return assetError(
      compensated ? "asset_publish_failed" : "asset_publish_compensation_failed",
      compensated
        ? "The asset could not be published."
        : "The asset publication needs administrator review.",
    );
  }
}

export async function rollbackPublishedAsset(
  assetId: string,
  publicObjectKey: string,
) {
  const [admin, supabase] = await Promise.all([
    getAdminIdentity(),
    createSupabaseServerClient(),
  ]);
  if (!admin || !supabase) return false;

  try {
    const attestation = assetMutationAttestation(admin.id, "revert", [
      assetId,
      publicObjectKey,
    ]);
    const { data, error } = await supabase.rpc("revert_asset_publication", {
      p_asset_id: assetId,
      p_public_object_key: publicObjectKey,
      p_attestation_timestamp: attestation.timestamp,
      p_attestation_signature: attestation.signature,
    });
    if (!error && data === true) {
      return (await deletePublicObject(publicObjectKey)) === true;
    }
  } catch {
    // A missing or mismatched HMAC can only be compensated if DB state stayed ready.
  }

  try {
    const { data: asset, error: readError } = await supabase
      .from("assets")
      .select("processing_state,public_object_key")
      .eq("id", assetId)
      .maybeSingle();
    if (readError || !asset) return false;
    if (asset.processing_state === "ready") {
      return (await deletePublicObject(publicObjectKey)) === true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function optimizeImage(
  bytes: Buffer,
  mimeType: string,
): Promise<{ body: Buffer; width: number; height: number }> {
  const image = sharp(bytes, { failOn: "warning" });
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error("Image dimensions could not be read.");
  }
  if (Math.max(metadata.width, metadata.height) > 2400) {
    throw new Error("Image dimensions exceed 2400 pixels.");
  }

  const result = await image
    .rotate()
    .webp(mimeType === "image/png" ? { lossless: true } : { quality: 82 })
    .toBuffer({ resolveWithObject: true });
  if (result.data.byteLength > MAX_IMAGE_BYTES) {
    throw new Error("Optimized image exceeds 8 MB.");
  }

  return {
    body: result.data,
    width: result.info.width,
    height: result.info.height,
  };
}

export function sha256(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function assetMutationAttestation(
  administratorId: string,
  operation: AssetMutationOperation,
  fields: string[],
) {
  const secret = process.env.ASSET_MUTATION_SECRET?.trim();
  if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("ASSET_MUTATION_SECRET is not configured.");
  }
  const timestamp = Math.floor(Date.now() / 1000);
  return {
    timestamp,
    signature: assetMutationSignature(
      secret,
      administratorId,
      operation,
      timestamp,
      fields,
    ),
  };
}

function assetMutationSignature(
  secret: string,
  administratorId: string,
  operation: AssetMutationOperation,
  timestamp: number,
  fields: string[],
) {
  return createHmac("sha256", secret)
    .update(
      [
        "v1",
        operation,
        administratorId,
        String(timestamp),
        ...fields,
      ].join("|"),
    )
    .digest("hex");
}

if (
  assetMutationSignature(
    "0123456789abcdef0123456789abcdef",
    "00000000-0000-4000-8000-000000000001",
    "finalize",
    1_700_000_000,
    ["asset", "image/png", "128", "abc", "1", "1", "key", "96"],
  ) !== "3870064cafec52e6ac886694c49e3c8392315a468dabac96519346a91aa14091"
) {
  throw new Error("Asset mutation attestation self-check failed.");
}

export function newAssetIdentity(ownerId: string) {
  const id = randomUUID();
  return { id, objectKey: `pending/${ownerId}/${id}/original` };
}

export function newImageDerivativeKey(assetId: string) {
  return `ready/${assetId}/${randomUUID()}/image.webp`;
}
