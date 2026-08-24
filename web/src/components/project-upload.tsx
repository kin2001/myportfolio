"use client";

import { useId, useState } from "react";
import type { MutationResult } from "@/lib/portfolio-types";
import {
  uploadSignedAsset,
  type SignedAssetUpload,
} from "@/lib/supabase/storage-upload";

type UploadReady = SignedAssetUpload;

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

export function ProjectUpload({
  label,
  onReady,
}: {
  label: string;
  onReady: (assetId: string) => void;
}) {
  const id = useId();
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  async function upload(file: File) {
    if (uploading) return;
    setUploading(true);
    setError("");
    if (!allowedTypes.has(file.type)) {
      setError("Choose a JPEG, PNG, WebP, or AVIF image.");
      setUploading(false);
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("Images must be 8 MB or smaller.");
      setUploading(false);
      return;
    }

    setStatus("Preparing upload…");
    try {
      const initiateResponse = await fetch("/api/admin/assets/initiate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          purpose: "project_image",
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
        }),
      });
      const initiate =
        (await initiateResponse.json()) as MutationResult<UploadReady>;
      if (!initiateResponse.ok || !initiate.ok) {
        throw new Error(
          initiate.ok ? "Upload could not be started." : initiate.error.message,
        );
      }

      setStatus("Uploading…");
      await uploadSignedAsset(initiate.data, file);

      setStatus("Validating image…");
      const finalizeResponse = await fetch("/api/admin/assets/finalize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assetId: initiate.data.assetId }),
      });
      const finalized =
        (await finalizeResponse.json()) as MutationResult<{ assetId: string }>;
      if (!finalizeResponse.ok || !finalized.ok) {
        throw new Error(
          finalized.ok ? "Image validation failed." : finalized.error.message,
        );
      }
      onReady(finalized.data.assetId);
      setStatus("Image ready.");
    } catch (uploadError) {
      setStatus("");
      setError(uploadError instanceof Error ? uploadError.message : "The image upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <label className="mono-label" htmlFor={id}>{label}</label>
      <input
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="field mt-3"
        id={id}
        type="file"
        disabled={uploading}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
          event.currentTarget.value = "";
        }}
      />
      {status ? <p className="mono-meta muted mt-3" role="status">{status}</p> : null}
      {error ? <p className="mt-3 text-sm text-[var(--danger)]" role="alert">{error}</p> : null}
    </div>
  );
}
