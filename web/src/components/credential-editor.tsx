"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MutationResult } from "@/lib/portfolio-types";
import {
  uploadSignedAsset,
  type SignedAssetUpload,
} from "@/lib/supabase/storage-upload";

export type CredentialRecord = {
  id: string;
  slug: string;
  name: string;
  issuer: string;
  issueDate: string | null;
  expiryDate: string | null;
  skills: string[];
  relatedProjectId: string | null;
  verificationUrl: string | null;
  evidenceAssetId: string | null;
  evidenceKind: "image" | "pdf" | null;
  evidenceVisibility: "private" | "public";
  evidenceAlt: string | null;
  redactionConfirmed: boolean;
  lifecycleState: "draft" | "published" | "archived";
  lockVersion: number;
};

export type CredentialInput = Omit<
  CredentialRecord,
  "slug" | "lifecycleState" | "evidenceKind"
>;

type AssetUpload = SignedAssetUpload;
type SaveState = "saved" | "unsaved" | "saving" | "blocked" | "error";
type UploadPhase = "idle" | "preparing" | "uploading" | "validating" | "ready" | "error";
type ActiveAction = "create" | "publish" | "archive" | "deploy" | null;
type CredentialDraft = {
  name: string;
  issuer: string;
  issueDate: string;
  expiryDate: string;
  skills: string;
  relatedProjectId: string;
  verificationUrl: string;
  evidenceVisibility: "private" | "public";
  evidenceAlt: string;
};

const uploadSteps = ["Preparing", "Uploading", "Checking"] as const;

function isHttpsUrl(value: string) {
  if (!value) return true;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function draftCanSave(draft: CredentialDraft) {
  const datesAreOrdered =
    !draft.issueDate || !draft.expiryDate || draft.expiryDate >= draft.issueDate;
  return (
    Boolean(draft.name.trim()) &&
    isHttpsUrl(draft.verificationUrl.trim()) &&
    datesAreOrdered
  );
}

function fileSize(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(bytes >= 1024 * 1024 ? 1 : 2)} MB`;
}

function uploadStep(phase: UploadPhase) {
  if (phase === "preparing") return 0;
  if (phase === "uploading") return 1;
  if (phase === "validating") return 2;
  if (phase === "ready") return uploadSteps.length;
  return -1;
}

function uploadMessage(phase: UploadPhase) {
  if (phase === "preparing") return "Preparing a secure upload…";
  if (phase === "uploading") return "Uploading evidence…";
  if (phase === "validating") return "Checking and processing evidence…";
  if (phase === "ready") return "Evidence ready and included in autosave.";
  return "";
}

async function uploadEvidence(
  file: File,
  setPhase: (phase: UploadPhase) => void,
): Promise<{ assetId: string; kind: "image" | "pdf" }> {
  const image = ["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type);
  const pdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!image && !pdf) throw new Error("Choose a JPEG, PNG, WebP, AVIF, or PDF file.");
  if (image && file.size > 8 * 1024 * 1024) throw new Error("Images must be 8 MB or smaller.");
  if (pdf && file.size > 10 * 1024 * 1024) throw new Error("PDF files must be 10 MB or smaller.");

  const mimeType = file.type || "application/pdf";
  const purpose = image ? "credential_image" : "credential_pdf";
  setPhase("preparing");
  const initiate = await fetch("/api/admin/assets/initiate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ purpose, fileName: file.name, mimeType, sizeBytes: file.size }),
  });
  const initiated = await initiate.json() as MutationResult<AssetUpload>;
  if (!initiate.ok || !initiated.ok) {
    throw new Error(initiated.ok ? "Could not start the upload." : initiated.error.message);
  }

  setPhase("uploading");
  await uploadSignedAsset(initiated.data, file);
  setPhase("validating");
  const finalize = await fetch("/api/admin/assets/finalize", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ assetId: initiated.data.assetId }),
  });
  const finalized = await finalize.json() as MutationResult<{ assetId: string }>;
  if (!finalize.ok || !finalized.ok) {
    throw new Error(finalized.ok ? "Could not validate the evidence." : finalized.error.message);
  }
  return { assetId: finalized.data.assetId, kind: image ? "image" : "pdf" };
}

export function CredentialEditor({
  credentials,
  selected,
  projects,
  createCredential,
  saveCredential,
  publishCredential,
  archiveCredential,
  retryDeployment,
}: {
  credentials: CredentialRecord[];
  selected: CredentialRecord | null;
  projects: { id: string; title: string }[];
  createCredential: (name: string) => Promise<MutationResult<{ id: string }>>;
  saveCredential: (input: CredentialInput) => Promise<MutationResult<{ lockVersion: number }>>;
  publishCredential: (id: string, lockVersion: number) => Promise<MutationResult<{ deploymentTriggered: boolean }>>;
  archiveCredential: (id: string) => Promise<MutationResult<{ deploymentTriggered: boolean }>>;
  retryDeployment: () => Promise<MutationResult>;
}) {
  const router = useRouter();
  const initialDraft: CredentialDraft = {
    name: selected?.name ?? "",
    issuer: selected?.issuer ?? "",
    issueDate: selected?.issueDate ?? "",
    expiryDate: selected?.expiryDate ?? "",
    skills: selected?.skills.join(", ") ?? "",
    relatedProjectId: selected?.relatedProjectId ?? "",
    verificationUrl: selected?.verificationUrl ?? "",
    evidenceVisibility: selected?.evidenceVisibility ?? "private",
    evidenceAlt: selected?.evidenceAlt ?? "",
  };
  const [draft, setDraft] = useState(initialDraft);
  const [assetId, setAssetId] = useState(selected?.evidenceAssetId ?? "");
  const [evidenceKind, setEvidenceKind] = useState<"image" | "pdf" | null>(selected?.evidenceKind ?? null);
  const [redactionConfirmed, setRedactionConfirmed] = useState(selected?.redactionConfirmed ?? false);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>("idle");
  const [uploadFile, setUploadFile] = useState<{ name: string; size: number } | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [activeAction, setActiveAction] = useState<ActiveAction>(null);
  const [publishState, setPublishState] = useState<"idle" | "publishing" | "published" | "error">("idle");
  const [publishDetail, setPublishDetail] = useState("");
  const [feedback, setFeedback] = useState("");
  const [feedbackIsError, setFeedbackIsError] = useState(false);
  const feedbackRef = useRef<HTMLParagraphElement>(null);
  const dirtyRef = useRef(false);
  const editRevisionRef = useRef(0);
  const saveInFlightRef = useRef(false);
  const lockVersionRef = useRef(selected?.lockVersion ?? 0);
  const draftRef = useRef({ draft, assetId, redactionConfirmed });
  const uploading = ["preparing", "uploading", "validating"].includes(uploadPhase);
  const verificationReady = Boolean(draft.verificationUrl.trim() || assetId);
  const publicImageAltReady = !assetId || draft.evidenceVisibility !== "public" || evidenceKind !== "image" || Boolean(draft.evidenceAlt.trim());
  const publishReady = Boolean(
    draftCanSave(draft) &&
    draft.name.trim() &&
    draft.issuer.trim() &&
    draft.issueDate &&
    verificationReady &&
    (!assetId || redactionConfirmed) &&
    publicImageAltReady,
  );

  useEffect(() => {
    draftRef.current = { draft, assetId, redactionConfirmed };
  }, [assetId, draft, redactionConfirmed]);

  function report(text: string, error = false) {
    setFeedback(text);
    setFeedbackIsError(error);
    if (error) requestAnimationFrame(() => feedbackRef.current?.focus());
  }

  function changed() {
    editRevisionRef.current += 1;
    dirtyRef.current = true;
    setDirty(true);
    setSaveState("unsaved");
    setPublishState("idle");
    setPublishDetail("");
  }

  function updateDraft<K extends keyof CredentialDraft>(field: K, value: CredentialDraft[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
    changed();
  }

  const save = useCallback(async () => {
    if (!selected || !dirtyRef.current || saveInFlightRef.current) return;
    const snapshot = draftRef.current;
    if (!draftCanSave(snapshot.draft)) {
      setSaveState("blocked");
      return;
    }
    const revision = editRevisionRef.current;
    let needsAnotherSave = false;
    saveInFlightRef.current = true;
    setSaveState("saving");
    try {
      const result = await saveCredential({
        id: selected.id,
        lockVersion: lockVersionRef.current,
        name: snapshot.draft.name.trim(),
        issuer: snapshot.draft.issuer.trim(),
        issueDate: snapshot.draft.issueDate || null,
        expiryDate: snapshot.draft.expiryDate || null,
        skills: snapshot.draft.skills.split(",").map((item) => item.trim()).filter(Boolean),
        relatedProjectId: snapshot.draft.relatedProjectId || null,
        verificationUrl: snapshot.draft.verificationUrl.trim() || null,
        evidenceAssetId: snapshot.assetId || null,
        evidenceVisibility: snapshot.draft.evidenceVisibility,
        evidenceAlt: snapshot.draft.evidenceAlt.trim() || null,
        redactionConfirmed: snapshot.redactionConfirmed,
      });
      if (!result.ok) {
        setSaveState("error");
        report(result.error.message, true);
        return;
      }
      lockVersionRef.current = result.data.lockVersion;
      if (editRevisionRef.current === revision) {
        dirtyRef.current = false;
        setDirty(false);
        setSaveState("saved");
        setFeedback("");
      } else {
        needsAnotherSave = true;
      }
    } catch {
      setSaveState("error");
      report("The credential draft could not save. Check your connection and retry.", true);
    } finally {
      saveInFlightRef.current = false;
      if (needsAnotherSave && dirtyRef.current) queueMicrotask(() => void save());
    }
  }, [saveCredential, selected]);

  useEffect(() => {
    if (!dirty || saveState === "saving" || uploading) return;
    if (!draftCanSave(draft)) {
      setSaveState("blocked");
      return;
    }
    const timer = window.setTimeout(() => void save(), 800);
    return () => window.clearTimeout(timer);
  }, [assetId, draft, dirty, redactionConfirmed, save, saveState, uploading]);

  useEffect(() => {
    const saveWhenHidden = () => {
      if (document.visibilityState === "hidden") void save();
    };
    document.addEventListener("visibilitychange", saveWhenHidden);
    return () => document.removeEventListener("visibilitychange", saveWhenHidden);
  }, [save]);

  useEffect(() => {
    if (!dirty) return;
    const prompt = "Your latest credential changes are still saving. Leave anyway?";
    const beforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    const beforeNavigation = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest("a");
      if (!anchor || anchor.target === "_blank" || anchor.origin !== window.location.origin || anchor.href === window.location.href) return;
      if (!window.confirm(prompt)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", beforeNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", beforeNavigation, true);
    };
  }, [dirty]);

  async function create() {
    if (activeAction) return;
    setActiveAction("create");
    report("");
    try {
      const result = await createCredential("Untitled credential");
      if (!result.ok) return report(result.error.message, true);
      router.push(`/admin/credentials?id=${result.data.id}`);
    } catch {
      report("The credential draft could not be created. Check your connection and try again.", true);
    } finally {
      setActiveAction(null);
    }
  }

  async function upload(file: File | undefined) {
    if (!file || uploading) return;
    setUploadFile({ name: file.name, size: file.size });
    setUploadError("");
    try {
      const uploaded = await uploadEvidence(file, setUploadPhase);
      setAssetId(uploaded.assetId);
      setEvidenceKind(uploaded.kind);
      setRedactionConfirmed(false);
      setUploadPhase("ready");
      changed();
    } catch (error) {
      setUploadPhase("error");
      setUploadError(error instanceof Error ? error.message : "Evidence upload failed.");
    }
  }

  async function publish() {
    if (!selected || activeAction || dirty || !publishReady) return;
    setActiveAction("publish");
    setPublishState("publishing");
    setPublishDetail("");
    try {
      const result = await publishCredential(selected.id, lockVersionRef.current);
      if (!result.ok) {
        setPublishState("error");
        setPublishDetail(result.error.message);
        return;
      }
      setPublishState("published");
      setPublishDetail(result.data.deploymentTriggered
        ? "Credential published. A production deployment was requested."
        : "Credential published. The production deployment could not be started; use Retry deployment when the hook is available.");
      router.refresh();
    } catch {
      setPublishState("error");
      setPublishDetail("Publishing failed. Check your connection and try again.");
    } finally {
      setActiveAction(null);
    }
  }

  async function archive() {
    if (!selected || activeAction || !window.confirm("Archive this credential? It will be retained and removed from the public site after deployment.")) return;
    setActiveAction("archive");
    try {
      const result = await archiveCredential(selected.id);
      report(
        result.ok
          ? result.data.deploymentTriggered
            ? "Credential archived. A production deployment was requested."
            : "Credential archived. The production deployment could not be started; retry it when the hook is available."
          : result.error.message,
        !result.ok,
      );
      if (result.ok) router.refresh();
    } finally {
      setActiveAction(null);
    }
  }

  async function retryDeploy() {
    if (activeAction) return;
    setActiveAction("deploy");
    try {
      const result = await retryDeployment();
      report(result.ok ? "Production deployment requested." : result.error.message, !result.ok);
    } finally {
      setActiveAction(null);
    }
  }

  const currentUploadStep = uploadStep(uploadPhase);

  return (
    <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
      <aside className="space-y-5">
        <button
          aria-busy={activeAction === "create"}
          className="button-primary w-full"
          disabled={Boolean(activeAction)}
          type="button"
          onClick={() => void create()}
        >
          {activeAction === "create" ? <span className="loading-ring" aria-hidden="true" /> : null}
          {activeAction === "create" ? "Opening editor…" : "New credential"}
        </button>
        {!selected && feedback ? (
          <p
            className={`mono-meta ${feedbackIsError ? "text-[var(--danger)]" : "accent"}`}
            ref={feedbackRef}
            role={feedbackIsError ? "alert" : "status"}
            tabIndex={feedbackIsError ? -1 : undefined}
          >
            {feedback}
          </p>
        ) : null}
        <label className="module block p-4 lg:hidden">
          <span className="mono-label muted">Choose credential</span>
          <select
            className="field mt-2"
            value={selected?.id ?? ""}
            onChange={(event) => router.push(event.target.value ? `/admin/credentials?id=${event.target.value}` : "/admin/credentials")}
          >
            <option value="">Select one</option>
            {credentials.map((credential) => <option key={credential.id} value={credential.id}>{credential.name}</option>)}
          </select>
        </label>
        <nav className="module hidden p-3 lg:block" aria-label="Credential drafts">
          {credentials.length === 0 ? <p className="p-3 ink-soft">No credentials recorded.</p> : (
            <ul className="space-y-1">
              {credentials.map((credential) => (
                <li key={credential.id}>
                  <Link
                    className={`block min-h-11 border-r-2 p-3 ${selected?.id === credential.id ? "border-[var(--accent)] text-[var(--accent)]" : "border-transparent"}`}
                    href={`/admin/credentials?id=${credential.id}`}
                    aria-current={selected?.id === credential.id ? "page" : undefined}
                  >
                    <span className="block font-medium">{credential.name}</span>
                    <span className="mono-meta muted">{credential.lifecycleState}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </nav>
      </aside>

      {selected ? (
        <div>
          <form className="module p-6" onSubmit={(event) => { event.preventDefault(); void save(); }}>
            <div className="flex flex-col gap-4 border-b border-[var(--line)] pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="mono-meta accent">DRAFT / {selected.lifecycleState.toUpperCase()}</p>
                <h2 className="mt-2 text-2xl font-medium">{draft.name || "Untitled credential"}</h2>
              </div>
              <div className="flex flex-col items-start gap-2 sm:items-end">
                <p className={`mono-meta ${saveState === "error" || saveState === "blocked" ? "text-[var(--danger)]" : saveState === "saved" ? "accent" : "muted"}`} role="status">
                  {saveState === "saving"
                    ? "SAVING DRAFT…"
                    : saveState === "error"
                      ? "AUTOSAVE NEEDS ATTENTION"
                      : saveState === "blocked"
                        ? "FIX THE NAME, DATES, OR LINK TO SAVE"
                        : dirty
                          ? "AUTOSAVE PENDING"
                          : "DRAFT SAVED"}
                </p>
                {saveState === "error" ? <button className="button-secondary" type="submit">Retry save</button> : null}
              </div>
            </div>

            <section className="mt-7">
              <h3 className="text-xl font-medium">Credential details</h3>
              <p className="mt-2 text-sm ink-soft">Start with the information shown on the credential.</p>
              <div className="mt-5 grid gap-6 md:grid-cols-2">
                <label><span className="mono-label muted">Name</span><input autoFocus={selected.name === "Untitled credential"} className="field mt-2" id="credential-name" maxLength={160} required value={draft.name} onChange={(event) => updateDraft("name", event.target.value)} /></label>
                <label><span className="mono-label muted">Issuer</span><input className="field mt-2" id="credential-issuer" maxLength={160} value={draft.issuer} onChange={(event) => updateDraft("issuer", event.target.value)} /></label>
                <label><span className="mono-label muted">Issue date</span><input className="field mt-2" id="credential-issue-date" type="date" value={draft.issueDate} onChange={(event) => updateDraft("issueDate", event.target.value)} /></label>
                <label><span className="mono-label muted">Expiry date (optional)</span><input className="field mt-2" type="date" value={draft.expiryDate} onChange={(event) => updateDraft("expiryDate", event.target.value)} /></label>
              </div>
            </section>

            <section className="mt-8 border-t border-[var(--line)] pt-7">
              <h3 className="text-xl font-medium">Optional context</h3>
              <p className="mt-2 text-sm ink-soft">Connect the credential to relevant skills or published work.</p>
              <div className="mt-5 grid gap-6 md:grid-cols-2">
                <label><span className="mono-label muted">Skills</span><input className="field mt-2" maxLength={5000} placeholder="Automation, APIs, AI agents" value={draft.skills} onChange={(event) => updateDraft("skills", event.target.value)} /><span className="mono-meta muted mt-2 block">Separate skills with commas.</span></label>
                <label><span className="mono-label muted">Related project</span><select className="field mt-2" value={draft.relatedProjectId} onChange={(event) => updateDraft("relatedProjectId", event.target.value)}><option value="">None</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select></label>
              </div>
            </section>

            <fieldset className="mt-8 border-t border-[var(--line)] pt-7">
              <legend className="text-xl font-medium">Verification</legend>
              <p className="mt-2 text-sm ink-soft">Add a secure verification link or upload an evidence file.</p>
              <div className="mt-5 grid gap-6">
                <label><span className="mono-label muted">Verification URL (optional)</span><input className="field mt-2" id="credential-verification-url" maxLength={2048} pattern="https://.*" placeholder="https://" type="url" value={draft.verificationUrl} onChange={(event) => updateDraft("verificationUrl", event.target.value)} /></label>
                <label>
                  <span className="mono-label muted">Evidence image or PDF (optional)</span>
                  <input
                    accept="image/jpeg,image/png,image/webp,image/avif,application/pdf,.pdf"
                    aria-describedby={uploadError ? "credential-evidence-help credential-evidence-error" : "credential-evidence-help"}
                    aria-invalid={Boolean(uploadError)}
                    className="field mt-2"
                    disabled={uploading}
                    id="credential-evidence"
                    type="file"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.currentTarget.value = "";
                      void upload(file);
                    }}
                  />
                </label>
                <p className="mono-meta muted -mt-4" id="credential-evidence-help">Images: 8 MB and 2400px maximum. PDFs: 10 MB maximum.</p>

                {uploadFile && uploadPhase !== "idle" && uploadPhase !== "error" ? (
                  <div className="border border-[var(--line)] p-4">
                    <div className="flex items-start justify-between gap-4"><span className="min-w-0 truncate text-sm font-medium">{uploadFile.name}</span><span className="mono-meta muted shrink-0">{fileSize(uploadFile.size)}</span></div>
                    <ol aria-label="Evidence upload progress" className="mt-5 grid grid-cols-3 gap-3">
                      {uploadSteps.map((step, index) => {
                        const complete = currentUploadStep > index;
                        const current = currentUploadStep === index;
                        return <li aria-current={current ? "step" : undefined} key={step}><span aria-hidden="true" className={`block h-0.5 transition-colors duration-200 ${complete || current ? "bg-[var(--accent)]" : "bg-[var(--line)]"}`} /><span className={`mono-meta mt-2 block ${complete || current ? "accent" : "muted"}`}>{step}</span></li>;
                      })}
                    </ol>
                    {uploading ? <div aria-hidden="true" className="mt-4 h-0.5 overflow-hidden bg-[var(--line)]"><span className="operation-progress block h-full w-1/3 bg-[var(--accent)]" /></div> : null}
                    <p aria-atomic="true" aria-live="polite" className={`mono-meta mt-4 ${uploadPhase === "ready" ? "accent" : "muted"}`} role="status">{uploadMessage(uploadPhase)}</p>
                  </div>
                ) : null}
                {uploadError ? <div className="border border-[var(--danger)] p-4" id="credential-evidence-error" role="alert"><p className="mono-label text-[var(--danger)]">Upload stopped</p><p className="mt-2 text-sm">{uploadError} Choose the file again to retry.</p></div> : null}

                {assetId ? (
                  <div className="grid gap-5 border-t border-[var(--line)] pt-6 md:grid-cols-2">
                    <label><span className="mono-label muted">Evidence visibility</span><select className="field mt-2" value={draft.evidenceVisibility} onChange={(event) => updateDraft("evidenceVisibility", event.target.value === "public" ? "public" : "private")}><option value="private">Private</option><option value="public">Public</option></select></label>
                    <div className="flex flex-wrap items-end gap-3"><a className="button-secondary" href={`/api/admin/assets/${assetId}/preview`} target="_blank" rel="noreferrer">Preview file<span className="sr-only"> (opens in a new tab)</span></a><button className="button-secondary" type="button" onClick={() => { setAssetId(""); setEvidenceKind(null); setRedactionConfirmed(false); changed(); }}>Detach</button></div>
                    {draft.evidenceVisibility === "public" && evidenceKind === "image" ? <label className="md:col-span-2"><span className="mono-label muted">Public image description</span><input className="field mt-2" maxLength={500} placeholder="Describe what the credential image shows" value={draft.evidenceAlt} onChange={(event) => updateDraft("evidenceAlt", event.target.value)} /></label> : null}
                    <label className="flex min-h-11 items-start gap-3 md:col-span-2"><input checked={redactionConfirmed} className="mt-1 h-5 w-5 shrink-0" type="checkbox" onChange={(event) => { setRedactionConfirmed(event.target.checked); changed(); }} /><span>I have permission to use this evidence and reviewed or redacted unnecessary certificate numbers, QR codes, addresses, and signatures.</span></label>
                  </div>
                ) : null}
              </div>
            </fieldset>
          </form>

          <section className="module mt-5 p-5">
            <h2 className="text-xl font-medium">Publish credential</h2>
            <p className="mt-2 text-sm leading-6 ink-soft">The draft saves automatically. Publish only after the checklist is complete.</p>
            <ul className="mono-meta muted mt-5 grid gap-3 sm:grid-cols-2">
              <li>{draft.name.trim() && draft.issuer.trim() && draft.issueDate ? "●" : "○"} Required details</li>
              <li>{verificationReady ? "●" : "○"} Verification link or evidence</li>
              <li>{!assetId || redactionConfirmed ? "●" : "○"} Evidence reviewed</li>
              <li>{publicImageAltReady ? "●" : "○"} Public image description</li>
              <li>{!dirty && saveState === "saved" ? "●" : "○"} Saved draft</li>
            </ul>
            <div className="mt-6 flex flex-wrap gap-3">
              {selected.lifecycleState === "published" ? <a className="button-secondary" href={`/credentials/${selected.slug}`} target="_blank" rel="noreferrer">Public page<span className="sr-only"> (opens in a new tab)</span></a> : null}
              <button
                aria-busy={activeAction === "publish"}
                className="button-primary"
                data-operation-state={activeAction === "publish" ? "working" : publishState === "published" ? "complete" : undefined}
                disabled={Boolean(activeAction) || dirty || saveState === "saving" || !publishReady || publishState === "published"}
                type="button"
                onClick={() => void publish()}
              >
                {activeAction === "publish" ? <span className="loading-ring" aria-hidden="true" /> : null}
                {activeAction === "publish" ? "Publishing credential…" : publishState === "published" ? "Published" : publishState === "error" ? "Try publishing again" : selected.lifecycleState === "published" ? "Publish update" : "Publish credential"}
              </button>
              {selected.lifecycleState === "published" ? <button className="button-secondary" disabled={Boolean(activeAction)} type="button" onClick={() => void retryDeploy()}>{activeAction === "deploy" ? <span className="loading-ring" aria-hidden="true" /> : null}{activeAction === "deploy" ? "Requesting deployment…" : "Retry deployment"}</button> : null}
              <button className="button-secondary" disabled={Boolean(activeAction) || dirty || selected.lifecycleState === "archived"} type="button" onClick={() => void archive()}>{activeAction === "archive" ? <span className="loading-ring text-[var(--accent)]" aria-hidden="true" /> : null}{activeAction === "archive" ? "Archiving…" : "Archive"}</button>
            </div>
            {publishState !== "idle" ? <p aria-live="polite" className={`mt-3 text-sm leading-6 ${publishState === "error" ? "text-[var(--danger)]" : "ink-soft"}`} role="status">{publishState === "publishing" ? "Preparing the public credential and its evidence. Keep this page open." : publishDetail}</p> : null}
          </section>

          <details className="module mt-5">
            <summary className="min-h-11 cursor-pointer p-5 font-medium">Preview saved credential</summary>
            <div className="border-t border-[var(--line)] p-5">
              <p className="mono-meta accent">{selected.issuer || "Issuer not set"}</p>
              <h3 className="mt-3 text-2xl font-medium">{selected.name}</h3>
              <p className="mt-3 ink-soft">{selected.issueDate ? `Issued ${selected.issueDate}` : "Issue date not set"}{selected.expiryDate ? ` · Expires ${selected.expiryDate}` : ""}</p>
              {selected.skills.length ? <p className="mt-4">{selected.skills.join(" · ")}</p> : null}
            </div>
          </details>
          {feedback ? <p className={`mono-meta mt-5 ${feedbackIsError ? "text-[var(--danger)]" : "accent"}`} ref={feedbackRef} role={feedbackIsError ? "alert" : "status"} tabIndex={feedbackIsError ? -1 : undefined}>{feedback}</p> : null}
        </div>
      ) : (
        <div className="module p-8"><h2 className="text-2xl font-medium">Add your first credential</h2><p className="mt-3 ink-soft">Create a private draft, then add details at your own pace.</p></div>
      )}
    </div>
  );
}
