"use client";

import { useState, useTransition } from "react";
import type { MutationResult } from "@/lib/portfolio-types";
import {
  uploadSignedAsset,
  type SignedAssetUpload,
} from "@/lib/supabase/storage-upload";

export type CvVersion = {
  id: string;
  assetId: string;
  filename: string;
  sizeBytes: number;
  note: string | null;
  uploadedAt: string;
};

type AssetUpload = SignedAssetUpload;

function date(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(new Date(value));
}

async function uploadPdf(file: File): Promise<string> {
  const mimeType = file.type || (file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "");
  const initiate = await fetch("/api/admin/assets/initiate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      purpose: "cv_pdf",
      fileName: file.name,
      mimeType,
      sizeBytes: file.size,
    }),
  });
  const initiated = await initiate.json() as MutationResult<AssetUpload>;
  if (!initiate.ok || !initiated.ok) {
    throw new Error(initiated.ok ? "Could not start the upload." : initiated.error.message);
  }
  const upload = initiated.data;

  await uploadSignedAsset(upload, file);

  const checksumSha256 = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer())),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
  const finalize = await fetch("/api/admin/assets/finalize", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ assetId: upload.assetId, checksumSha256 }),
  });
  const finalized = await finalize.json() as MutationResult<{ assetId: string }>;
  if (!finalize.ok || !finalized.ok) {
    throw new Error(finalized.ok ? "Could not validate the PDF." : finalized.error.message);
  }
  return upload.assetId;
}

export function CvManager({
  versions,
  currentVersionId,
  registerVersion,
  setCurrent,
}: {
  versions: CvVersion[];
  currentVersionId: string | null;
  registerVersion: (input: {
    assetId: string;
    filename: string;
    sizeBytes: number;
    note: string;
  }) => Promise<MutationResult<{ id: string }>>;
  setCurrent: (versionId: string) => Promise<MutationResult>;
}) {
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function submitUpload(formData: FormData) {
    const file = formData.get("cv");
    if (!(file instanceof File) || file.size === 0) {
      setMessage("Choose a PDF to upload.");
      return;
    }
    if ((file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) || file.size > 10 * 1024 * 1024) {
      setMessage("Use a PDF no larger than 10 MB.");
      return;
    }

    setMessage("Uploading and validating PDF…");
    startTransition(async () => {
      try {
        const assetId = await uploadPdf(file);
        const result = await registerVersion({
          assetId,
          filename: file.name,
          sizeBytes: file.size,
          note: String(formData.get("note") ?? "").trim(),
        });
        setMessage(result.ok ? "CV version uploaded." : result.error.message);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "CV upload failed.");
      }
    });
  }

  function makeCurrent(versionId: string) {
    setMessage("Updating the public CV…");
    startTransition(async () => {
      const result = await setCurrent(versionId);
      setMessage(result.ok ? "Current CV updated." : result.error.message);
    });
  }

  return (
    <div className="space-y-8">
      <form action={submitUpload} className="module grid gap-6 p-6 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <label>
          <span className="mono-label muted">PDF file</span>
          <input className="field mt-2" name="cv" type="file" accept="application/pdf,.pdf" required disabled={pending} />
        </label>
        <label>
          <span className="mono-label muted">Version note (optional)</span>
          <input className="field mt-2" name="note" maxLength={240} placeholder="What changed?" disabled={pending} />
        </label>
        <button className="button-primary" type="submit" disabled={pending}>Upload CV</button>
      </form>

      {message ? <p className="mono-meta" role="status">{message}</p> : null}

      <section aria-labelledby="cv-history-title">
        <div className="section-heading">
          <div>
            <p className="mono-meta accent">VERSION_REGISTRY</p>
            <h2 id="cv-history-title" className="mt-2 text-2xl font-medium">CV history</h2>
          </div>
          <span className="mono-meta muted">{versions.length} version{versions.length === 1 ? "" : "s"}</span>
        </div>
        {versions.length === 0 ? (
          <div className="module mt-5 p-7">
            <p className="ink-soft">No CV versions uploaded.</p>
          </div>
        ) : (
          <ul className="mt-5 space-y-3">
            {versions.map((version) => {
              const current = version.id === currentVersionId;
              return (
                <li className="module flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between" key={version.id}>
                  <div className="min-w-0">
                    <p className="break-all font-medium">{version.filename}</p>
                    <p className="mono-meta muted mt-2">
                      {(version.sizeBytes / 1024 / 1024).toFixed(2)} MB · {date(version.uploadedAt)}
                    </p>
                    {version.note ? <p className="mt-2 ink-soft">{version.note}</p> : null}
                    {current ? <p className="mono-label accent mt-3">Current public CV</p> : null}
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <a className="button-secondary" href={`/api/admin/assets/${version.assetId}/preview`} target="_blank" rel="noreferrer">
                      Preview<span className="sr-only"> (opens in a new tab)</span>
                    </a>
                    <button
                      className="button-primary"
                      type="button"
                      disabled={pending || current}
                      onClick={() => makeCurrent(version.id)}
                    >
                      {current ? "Current" : "Set current"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
