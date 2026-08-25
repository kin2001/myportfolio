"use client";

import { useEffect, useId, useState } from "react";
import type { MutationResult } from "@/lib/portfolio-types";
import {
  uploadSignedAsset,
  type SignedAssetUpload,
} from "@/lib/supabase/storage-upload";

type UploadReady = SignedAssetUpload;
type UploadPhase = "idle" | "preparing" | "uploading" | "validating" | "ready" | "error";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const steps = ["Preparing", "Uploading", "Checking"] as const;

function formatFileSize(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(bytes >= 1024 * 1024 ? 1 : 2)} MB`;
}

function activeStep(phase: UploadPhase) {
  if (phase === "preparing") return 0;
  if (phase === "uploading") return 1;
  if (phase === "validating") return 2;
  if (phase === "ready") return steps.length;
  return -1;
}

function phaseMessage(phase: UploadPhase) {
  if (phase === "preparing") return "Preparing a secure upload…";
  if (phase === "uploading") return "Uploading image…";
  if (phase === "validating") return "Checking and processing image…";
  if (phase === "ready") return "Image ready.";
  return "";
}

export function ProjectUpload({
  label,
  onReady,
  resetKey,
}: {
  label: string;
  onReady: (assetId: string) => void;
  resetKey: string | number;
}) {
  const id = useId();
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [fileDetails, setFileDetails] = useState<{ name: string; size: number } | null>(null);
  const [error, setError] = useState("");
  const uploading = phase === "preparing" || phase === "uploading" || phase === "validating";

  useEffect(() => {
    setPhase("idle");
    setFileDetails(null);
    setError("");
  }, [resetKey]);

  async function upload(file: File) {
    if (uploading) return;
    setFileDetails({ name: file.name, size: file.size });
    setError("");
    if (!allowedTypes.has(file.type)) {
      setPhase("error");
      setError("Choose a JPEG, PNG, WebP, or AVIF image.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setPhase("error");
      setError("Images must be 8 MB or smaller.");
      return;
    }

    setPhase("preparing");
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

      setPhase("uploading");
      await uploadSignedAsset(initiate.data, file);

      setPhase("validating");
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
      setPhase("ready");
    } catch (uploadError) {
      setPhase("error");
      setError(uploadError instanceof Error ? uploadError.message : "The image upload failed.");
    }
  }

  const currentStep = activeStep(phase);

  return (
    <div>
      <label>
        <span className="mono-label muted">{uploading ? "Upload in progress" : label}</span>
        <input
          accept="image/jpeg,image/png,image/webp,image/avif"
          aria-describedby={error ? `${id}-help ${id}-error` : `${id}-help`}
          aria-invalid={Boolean(error)}
          className="field mt-2"
          disabled={uploading}
          id={id}
          type="file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
            event.currentTarget.value = "";
          }}
        />
      </label>
      <p className="mono-meta muted mt-2" id={`${id}-help`}>
        JPG, PNG, WebP or AVIF · 8 MB maximum · 2400px longest edge
      </p>

      {fileDetails && (uploading || phase === "ready") ? (
        <div className="mt-4 border border-[var(--line)] p-4">
          <div className="flex items-start justify-between gap-4">
            <span className="min-w-0 truncate text-sm font-medium">{fileDetails.name}</span>
            <span className="mono-meta muted shrink-0">{formatFileSize(fileDetails.size)}</span>
          </div>
          <ol aria-label="Image upload progress" className="mt-5 grid grid-cols-3 gap-3">
            {steps.map((step, index) => {
              const complete = currentStep > index;
              const current = currentStep === index;
              return (
                <li aria-current={current ? "step" : undefined} key={step}>
                  <span
                    aria-hidden="true"
                    className={`block h-0.5 transition-colors duration-200 ${
                      complete || current ? "bg-[var(--accent)]" : "bg-[var(--line)]"
                    }`}
                  />
                  <span className={`mono-meta mt-2 block ${complete || current ? "accent" : "muted"}`}>
                    {step}
                  </span>
                </li>
              );
            })}
          </ol>
          {uploading ? (
            <div aria-hidden="true" className="mt-4 h-0.5 overflow-hidden bg-[var(--line)]">
              <span className="operation-progress block h-full w-1/3 bg-[var(--accent)]" />
            </div>
          ) : null}
          <p
            aria-atomic="true"
            aria-live="polite"
            className={`mono-meta mt-4 ${phase === "ready" ? "accent" : "muted"}`}
            role="status"
          >
            {phaseMessage(phase)}
          </p>
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 border border-[var(--danger)] p-4" id={`${id}-error`} role="alert">
          <p className="mono-label text-[var(--danger)]">Upload stopped</p>
          <p className="mt-2 text-sm">{error} Choose the image again to retry.</p>
        </div>
      ) : null}
    </div>
  );
}
