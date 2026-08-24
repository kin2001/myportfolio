"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicConfig } from "@/lib/env";
import { PRIVATE_ASSET_BUCKET } from "@/lib/supabase/storage-constants";

let client: ReturnType<typeof createBrowserClient> | undefined;

export type SignedAssetUpload = {
  assetId: string;
  uploadPath: string;
  uploadToken: string;
};

export async function uploadSignedAsset(upload: SignedAssetUpload, file: File) {
  const config = getSupabasePublicConfig();
  if (!config) throw new Error("Supabase is not configured.");
  client ??= createBrowserClient(config.url, config.publishableKey);

  const { error } = await client.storage
    .from(PRIVATE_ASSET_BUCKET)
    .uploadToSignedUrl(upload.uploadPath, upload.uploadToken, file, {
      cacheControl: "0",
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (error) throw new Error("The file upload failed.");
}
