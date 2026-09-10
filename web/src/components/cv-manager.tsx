"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
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
type UploadPhase = "idle" | "preparing" | "uploading" | "validating" | "ready" | "error";

const uploadSteps = ["Preparing", "Uploading", "Checking"] as const;

function date(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(new Date(value));
}

function fileSize(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(bytes >= 1024 * 1024 ? 1 : 2)} MB`;
}

function currentUploadStep(phase: UploadPhase) {
  if (phase === "preparing") return 0;
  if (phase === "uploading") return 1;
  if (phase === "validating") return 2;
  if (phase === "ready") return uploadSteps.length;
  return -1;
}

async function uploadPdf(
  file: File,
  setPhase: (phase: UploadPhase) => void,
): Promise<string> {
  const mimeType = file.type || (file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "");
  setPhase("preparing");
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

  setPhase("uploading");
  await uploadSignedAsset(upload, file);

  setPhase("validating");
  const finalize = await fetch("/api/admin/assets/finalize", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ assetId: upload.assetId }),
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
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);
  const [activeAction, setActiveAction] = useState<"upload" | string | null>(null);
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>("idle");
  const [uploadFile, setUploadFile] = useState<{ name: string; size: number } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const uploading = activeAction === "upload";

  async function submitUpload(formData: FormData) {
    const file = formData.get("cv");
    if (!(file instanceof File) || file.size === 0) {
      setMessage("Choose a PDF to upload.");
      setMessageIsError(true);
      return;
    }
    if ((file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) || file.size > 10 * 1024 * 1024) {
      setMessage("Use a PDF no larger than 10 MB.");
      setMessageIsError(true);
      return;
    }

    setUploadFile({ name: file.name, size: file.size });
    setMessage("");
    setMessageIsError(false);
    setActiveAction("upload");
    try {
      const assetId = await uploadPdf(file, setUploadPhase);
      const result = await registerVersion({
        assetId,
        filename: file.name,
        sizeBytes: file.size,
        note: String(formData.get("note") ?? "").trim(),
      });
      if (!result.ok) throw new Error(result.error.message);
      setUploadPhase("ready");
      setMessage("CV version uploaded and ready in the private registry.");
      formRef.current?.reset();
      router.refresh();
    } catch (error) {
      setUploadPhase("error");
      setMessage(error instanceof Error ? error.message : "CV upload failed.");
      setMessageIsError(true);
    } finally {
      setActiveAction(null);
    }
  }

  async function makeCurrent(versionId: string) {
    if (activeAction) return;
    setActiveAction(versionId);
    setMessage("");
    setMessageIsError(false);
    try {
      const result = await setCurrent(versionId);
      setMessage(result.ok ? "Current CV updated." : result.error.message);
      setMessageIsError(!result.ok);
      if (result.ok) router.refresh();
    } catch {
      setMessage("The current CV could not be updated. Check your connection and try again.");
      setMessageIsError(true);
    } finally {
      setActiveAction(null);
    }
  }

  return (
    <div className="space-y-8">
      <form ref={formRef} action={submitUpload} aria-busy={uploading} className="module grid gap-6 p-6 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <label>
          <span className="mono-label muted">PDF file</span>
          <input className="field mt-2" name="cv" type="file" accept="application/pdf,.pdf" required disabled={Boolean(activeAction)} />
        </label>
        <label>
          <span className="mono-label muted">Version note (optional)</span>
          <input className="field mt-2" name="note" maxLength={240} placeholder="What changed?" disabled={Boolean(activeAction)} />
        </label>
        <button className="button-primary" data-operation-state={uploading ? "working" : undefined} type="submit" disabled={Boolean(activeAction)}>
          {uploading ? <span className="loading-ring" aria-hidden="true" /> : null}
          {uploading ? "Uploading CV…" : "Upload CV"}
        </button>
        {uploadFile && uploadPhase !== "idle" ? (
          <div className="border-t border-[var(--line)] pt-5 md:col-span-3">
            <div className="flex items-start justify-between gap-4"><span className="min-w-0 truncate text-sm font-medium">{uploadFile.name}</span><span className="mono-meta muted shrink-0">{fileSize(uploadFile.size)}</span></div>
            <ol aria-label="CV upload progress" className="mt-5 grid grid-cols-3 gap-3">
              {uploadSteps.map((step, index) => {
                const progress = currentUploadStep(uploadPhase);
                const complete = progress > index;
                const current = progress === index;
                return <li aria-current={current ? "step" : undefined} key={step}><span aria-hidden="true" className={`block h-0.5 ${complete || current ? "bg-[var(--accent)]" : "bg-[var(--line)]"}`} /><span className={`mono-meta mt-2 block ${complete || current ? "accent" : "muted"}`}>{step}</span></li>;
              })}
            </ol>
            {uploading ? <div aria-hidden="true" className="mt-4 h-0.5 overflow-hidden bg-[var(--line)]"><span className="operation-progress block h-full w-1/3 bg-[var(--accent)]" /></div> : null}
          </div>
        ) : null}
      </form>

      {message ? <p className={`mono-meta ${messageIsError ? "text-[var(--danger)]" : "accent"}`} role={messageIsError ? "alert" : "status"}>{message}</p> : null}

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
                      aria-busy={activeAction === version.id}
                      data-operation-state={activeAction === version.id ? "working" : undefined}
                      disabled={Boolean(activeAction) || current}
                      onClick={() => makeCurrent(version.id)}
                    >
                      {activeAction === version.id ? <span className="loading-ring" aria-hidden="true" /> : null}
                      {activeAction === version.id ? "Updating…" : current ? "Current" : "Set current"}
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
