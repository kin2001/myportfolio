import "server-only";

import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "@/lib/env";
import {
  PRIVATE_ASSET_BUCKET,
  PUBLIC_ASSET_BUCKET,
} from "@/lib/supabase/storage-constants";

export { PRIVATE_ASSET_BUCKET, PUBLIC_ASSET_BUCKET };

let serviceClient: SupabaseClient | undefined;

export function getStorageClient() {
  const config = getSupabasePublicConfig();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!config || !serviceRoleKey) return null;

  serviceClient ??= createClient(config.url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
  return serviceClient;
}

export async function createPrivateUploadToken(key: string) {
  const client = getStorageClient();
  if (!client) return null;
  const { data, error } = await client.storage
    .from(PRIVATE_ASSET_BUCKET)
    .createSignedUploadUrl(key, { upsert: false });
  return error || !data ? null : { path: data.path, token: data.token };
}

export async function headPrivateObject(key: string) {
  const client = getStorageClient();
  if (!client) return null;
  const { data, error } = await client.storage.from(PRIVATE_ASSET_BUCKET).info(key);
  return error || !data
    ? null
    : { ContentLength: data.size, ContentType: data.contentType };
}

export async function readPrivateObject(key: string) {
  const client = getStorageClient();
  if (!client) return null;
  const { data, error } = await client.storage.from(PRIVATE_ASSET_BUCKET).download(key);
  return error || !data ? null : Buffer.from(await data.arrayBuffer());
}

export async function writePrivateObject(
  key: string,
  body: Buffer,
  contentType: string,
) {
  const client = getStorageClient();
  if (!client) return false;
  const { error } = await client.storage.from(PRIVATE_ASSET_BUCKET).upload(key, body, {
    cacheControl: "0",
    contentType,
    upsert: false,
  });
  return !error;
}

export async function createPrivatePreviewUrl(key: string) {
  const client = getStorageClient();
  if (!client) return null;
  const { data, error } = await client.storage
    .from(PRIVATE_ASSET_BUCKET)
    .createSignedUrl(key, 60);
  return error || !data ? null : data.signedUrl;
}

export async function deletePrivateObject(key: string) {
  const client = getStorageClient();
  if (!client) return false;
  const { error } = await client.storage.from(PRIVATE_ASSET_BUCKET).remove([key]);
  return !error;
}

export async function readVerifiedPrivatePdf({
  key,
  sizeBytes,
  checksumSha256,
}: {
  key: string;
  sizeBytes: number;
  checksumSha256: string;
}) {
  const body = await readPrivateObject(key);
  if (
    !body ||
    body.byteLength !== sizeBytes ||
    body.subarray(0, 5).toString("ascii") !== "%PDF-" ||
    createHash("sha256").update(body).digest("hex") !== checksumSha256
  ) {
    return null;
  }
  return body;
}

export async function readCurrentCv(): Promise<
  | { status: "absent" }
  | { status: "ready"; body: Buffer }
  | { status: "unavailable" }
> {
  const client = getStorageClient();
  if (!client) return { status: "unavailable" };

  const { data: settings, error: settingsError } = await client
    .from("site_settings")
    .select("current_cv_version_id")
    .eq("singleton", true)
    .maybeSingle();
  if (settingsError || !settings) return { status: "unavailable" };
  if (!settings.current_cv_version_id) return { status: "absent" };

  const { data: version, error: versionError } = await client
    .from("cv_versions")
    .select("asset_id")
    .eq("id", settings.current_cv_version_id)
    .maybeSingle();
  if (versionError || !version) return { status: "unavailable" };

  const { data: asset, error: assetError } = await client
    .from("assets")
    .select("object_key,size_bytes,checksum_sha256,purpose,mime_type,processing_state")
    .eq("id", version.asset_id)
    .maybeSingle();
  if (
    assetError ||
    !asset ||
    asset.purpose !== "cv_pdf" ||
    asset.mime_type !== "application/pdf" ||
    asset.processing_state !== "ready" ||
    typeof asset.checksum_sha256 !== "string"
  ) {
    return { status: "unavailable" };
  }

  const body = await readVerifiedPrivatePdf({
    key: asset.object_key,
    sizeBytes: asset.size_bytes,
    checksumSha256: asset.checksum_sha256,
  });
  return body ? { status: "ready", body } : { status: "unavailable" };
}

export async function publicObjectExists(key: string) {
  const client = getStorageClient();
  if (!client) return null;
  const { data, error } = await client.storage.from(PUBLIC_ASSET_BUCKET).exists(key);
  return error ? null : data;
}

export async function writePublicObject({
  key,
  body,
  contentType,
}: {
  key: string;
  body: Buffer;
  contentType: string;
}) {
  const client = getStorageClient();
  if (!client) return false;
  const { error } = await client.storage.from(PUBLIC_ASSET_BUCKET).upload(key, body, {
    cacheControl: "0",
    contentType,
    upsert: false,
  });
  return !error;
}

export async function retirePublicObject(key: string) {
  const client = getStorageClient();
  if (!client) return false;
  const { error } = await client.storage.from(PUBLIC_ASSET_BUCKET).remove([key]);
  return !error;
}

export function publicAssetUrl(key: string) {
  const config = getSupabasePublicConfig();
  if (!config) return null;
  return `${config.url}/storage/v1/object/public/${PUBLIC_ASSET_BUCKET}/${key
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}
