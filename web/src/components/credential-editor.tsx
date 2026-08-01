"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import type { MutationResult } from "@/lib/portfolio-types";

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
  evidenceVisibility: "private" | "public";
  evidenceAlt: string | null;
  redactionConfirmed: boolean;
  lifecycleState: "draft" | "published" | "archived";
  lockVersion: number;
};

export type CredentialInput = Omit<CredentialRecord, "slug" | "lifecycleState">;
type AssetUpload = { assetId: string; uploadUrl: string; headers?: Record<string, string> };

async function uploadEvidence(file: File): Promise<string> {
  const image = ["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type);
  const pdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const mimeType = file.type || (pdf ? "application/pdf" : "");
  const purpose = image ? "credential_image" : "credential_pdf";
  const limit = image ? 8 * 1024 * 1024 : 10 * 1024 * 1024;
  if ((!image && !pdf) || file.size > limit) {
    throw new Error(image ? "Use an image no larger than 8 MB." : "Use a PDF no larger than 10 MB.");
  }
  const initiate = await fetch("/api/admin/assets/initiate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      purpose,
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
  const put = await fetch(upload.uploadUrl, { method: "PUT", headers: upload.headers, body: file });
  if (!put.ok) throw new Error("Could not upload the evidence.");
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
    throw new Error(finalized.ok ? "Could not validate the evidence." : finalized.error.message);
  }
  return upload.assetId;
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
  publishCredential: (id: string, lockVersion: number) => Promise<MutationResult>;
  archiveCredential: (id: string) => Promise<MutationResult>;
  retryDeployment: () => Promise<MutationResult>;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);
  const [messageField, setMessageField] = useState("");
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [assetId, setAssetId] = useState(selected?.evidenceAssetId ?? "");
  const [redactionConfirmed, setRedactionConfirmed] = useState(
    selected?.redactionConfirmed ?? false,
  );
  const [dirty, setDirty] = useState(false);
  const feedbackRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!dirty) return;
    const prompt = "Leave without saving your credential changes?";
    let restoringHistory = false;
    const beforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    const beforeNavigation = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest("a");
      if (
        !anchor ||
        anchor.target === "_blank" ||
        anchor.origin !== window.location.origin ||
        anchor.href === window.location.href
      ) return;
      if (!window.confirm(prompt)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const beforeHistory = () => {
      if (restoringHistory) {
        restoringHistory = false;
        return;
      }
      if (!window.confirm(prompt)) {
        restoringHistory = true;
        window.history.forward();
      }
    };
    const beforeSubmit = (event: SubmitEvent) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement) || new URL(form.action).pathname !== "/auth/logout") return;
      if (!window.confirm(prompt)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("popstate", beforeHistory);
    document.addEventListener("click", beforeNavigation, true);
    document.addEventListener("submit", beforeSubmit, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("popstate", beforeHistory);
      document.removeEventListener("click", beforeNavigation, true);
      document.removeEventListener("submit", beforeSubmit, true);
    };
  }, [dirty]);

  function report(text: string, error = false, field = "") {
    setMessage(text);
    setMessageIsError(error);
    setMessageField(field);
    if (error) requestAnimationFrame(() => feedbackRef.current?.focus());
  }

  function create(formData: FormData) {
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return report("Enter a credential name.", true, "new-credential-name");
    startTransition(async () => {
      const result = await createCredential(name);
      if (!result.ok) return report(result.error.message, true);
      router.replace(`/admin/credentials?id=${result.data.id}`);
      router.refresh();
    });
  }

  function save(formData: FormData) {
    if (!selected) return;
    const name = String(formData.get("name") ?? "").trim();
    const issuer = String(formData.get("issuer") ?? "").trim();
    const issueDate = String(formData.get("issueDate") ?? "") || null;
    const expiryDate = String(formData.get("expiryDate") ?? "") || null;
    const verificationUrl = String(formData.get("verificationUrl") ?? "").trim() || null;
    const evidenceVisibility = formData.get("evidenceVisibility") === "public" ? "public" : "private";
    const evidenceAlt = String(formData.get("evidenceAlt") ?? "").trim() || null;
    const skills = String(formData.get("skills") ?? "").split(",").map((item) => item.trim()).filter(Boolean);
    const relatedProjectId = String(formData.get("relatedProjectId") ?? "") || null;
    if (!name) return report("Credential name is required.", true, "credential-name");
    if (!issuer) return report("Credential issuer is required.", true, "credential-issuer");
    if (!issueDate) return report("Issue date is required.", true, "credential-issue-date");
    if (verificationUrl && !verificationUrl.startsWith("https://")) return report("Verification URL must use HTTPS.", true, "credential-verification-url");
    if (!verificationUrl && !assetId) return report("Add a verification URL or upload evidence.", true, "credential-evidence");
    if (evidenceVisibility === "public" && assetId && !evidenceAlt) {
      const input = document.querySelector<HTMLInputElement>("#credential-evidence");
      if (input?.files?.[0]?.type.startsWith("image/")) return report("Public images require alt text.", true, "credential-evidence-alt");
    }
    startTransition(async () => {
      const result = await saveCredential({
        id: selected.id,
        lockVersion: selected.lockVersion,
        name,
        issuer,
        issueDate,
        expiryDate,
        skills,
        relatedProjectId,
        verificationUrl,
        evidenceAssetId: assetId || null,
        evidenceVisibility,
        evidenceAlt,
        redactionConfirmed,
      });
      report(result.ok ? "Draft saved." : result.error.message, !result.ok);
      if (result.ok) {
        setDirty(false);
        router.refresh();
      }
    });
  }

  function upload(file: File | undefined) {
    if (!file || uploading) return;
    setUploading(true);
    report("Uploading and validating evidence…");
    startTransition(async () => {
      try {
        setAssetId(await uploadEvidence(file));
        setRedactionConfirmed(false);
        setDirty(true);
        report("Evidence ready. Save the draft to attach it.");
      } catch (error) {
        report(error instanceof Error ? error.message : "Evidence upload failed.", true, "credential-evidence");
      } finally {
        setUploading(false);
      }
    });
  }

  function publish() {
    if (!selected) return;
    report("Publishing credential…");
    startTransition(async () => {
      const result = await publishCredential(selected.id, selected.lockVersion);
      report(result.ok ? "Credential published. Deployment requested." : result.error.message, !result.ok);
      if (result.ok) router.refresh();
    });
  }

  function archive() {
    if (!selected) return;
    if (!window.confirm("Archive this credential? It will be retained and removed from the public site after deployment.")) return;
    startTransition(async () => {
      const result = await archiveCredential(selected.id);
      report(result.ok ? "Credential archived. Deployment requested." : result.error.message, !result.ok);
      if (result.ok) router.refresh();
    });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
      <aside className="space-y-5">
        <form action={create} className="module p-5">
          <label>
            <span className="mono-label muted">New credential</span>
            <input className="field mt-2" id="new-credential-name" name="name" maxLength={180} required placeholder="Credential name" />
          </label>
          <button className="button-primary mt-5 w-full" type="submit" disabled={pending}>Create draft</button>
        </form>
        <nav className="module p-3" aria-label="Credential drafts">
          {credentials.length === 0 ? <p className="p-3 ink-soft">No credentials recorded.</p> : (
            <ul className="space-y-1">
              {credentials.map((credential) => (
                <li key={credential.id}>
                  <a
                    className={`block min-h-11 border-r-2 p-3 ${selected?.id === credential.id ? "border-[var(--accent)] text-[var(--accent)]" : "border-transparent"}`}
                    href={`/admin/credentials?id=${credential.id}`}
                    aria-current={selected?.id === credential.id ? "page" : undefined}
                  >
                    <span className="block font-medium">{credential.name}</span>
                    <span className="mono-meta muted">{credential.lifecycleState}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </nav>
      </aside>

      {selected ? (
        <div>
          <form action={save} className="module p-6" onChange={() => setDirty(true)}>
            <div className="flex flex-col gap-3 border-b border-[var(--line)] pb-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="mono-meta accent">DRAFT / {selected.lifecycleState.toUpperCase()}</p>
                <h2 className="mt-2 text-2xl font-medium">{selected.name}</h2>
              </div>
              <button className="button-primary" type="submit" disabled={pending}>Save draft</button>
            </div>
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <label><span className="mono-label muted">Name</span><input className="field mt-2" id="credential-name" name="name" defaultValue={selected.name} required /></label>
              <label><span className="mono-label muted">Issuer</span><input className="field mt-2" id="credential-issuer" name="issuer" defaultValue={selected.issuer} required /></label>
              <label><span className="mono-label muted">Issue date</span><input className="field mt-2" id="credential-issue-date" name="issueDate" type="date" defaultValue={selected.issueDate ?? ""} required /></label>
              <label><span className="mono-label muted">Expiry date (optional)</span><input className="field mt-2" name="expiryDate" type="date" defaultValue={selected.expiryDate ?? ""} /></label>
              <label className="md:col-span-2"><span className="mono-label muted">Skills (comma separated)</span><input className="field mt-2" name="skills" defaultValue={selected.skills.join(", ")} /></label>
              <label><span className="mono-label muted">Related published project (optional)</span><select className="field mt-2" name="relatedProjectId" defaultValue={selected.relatedProjectId ?? ""}><option value="">None</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select></label>
              <label><span className="mono-label muted">Verification URL (optional)</span><input className="field mt-2" id="credential-verification-url" name="verificationUrl" type="url" pattern="https://.*" defaultValue={selected.verificationUrl ?? ""} /></label>
              <label><span className="mono-label muted">Evidence image or PDF</span><input id="credential-evidence" className="field mt-2" type="file" accept="image/jpeg,image/png,image/webp,image/avif,application/pdf" disabled={uploading} onChange={(event) => upload(event.target.files?.[0])} /></label>
              <label><span className="mono-label muted">Evidence visibility</span><select className="field mt-2" name="evidenceVisibility" defaultValue={selected.evidenceVisibility}><option value="private">Private</option><option value="public">Public</option></select></label>
              <label className="md:col-span-2"><span className="mono-label muted">Public image alt text</span><input className="field mt-2" id="credential-evidence-alt" name="evidenceAlt" defaultValue={selected.evidenceAlt ?? ""} /></label>
              {assetId ? <p className="mono-meta accent md:col-span-2">Evidence attached · <a className="underline" href={`/api/admin/assets/${assetId}/preview`} target="_blank" rel="noreferrer">Preview private file<span className="sr-only"> (opens in a new tab)</span></a></p> : null}
              {assetId ? (
                <button
                  className="button-secondary justify-self-start md:col-span-2"
                  type="button"
                  onClick={() => {
                    setAssetId("");
                    setDirty(true);
                  }}
                >
                  Detach evidence
                </button>
              ) : null}
              <label className="flex min-h-11 items-start gap-3 md:col-span-2">
                <input
                  checked={redactionConfirmed}
                  className="mt-1 h-5 w-5 shrink-0"
                  name="redactionConfirmed"
                  type="checkbox"
                  onChange={(event) => {
                    setRedactionConfirmed(event.target.checked);
                    setDirty(true);
                  }}
                />
                <span>I have permission to use this evidence and reviewed or redacted unnecessary certificate numbers, QR codes, addresses, and signatures.</span>
              </label>
            </div>
          </form>

          <section className="module mt-5 flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="mono-label">Preview and publication</p>
              <p className="mt-2 ink-soft">Save first. Publishing validates the saved version and keeps each publication immutable.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {selected.lifecycleState === "published" ? (
                <a className="button-secondary" href={`/credentials/${selected.slug}`} target="_blank" rel="noreferrer">Public page<span className="sr-only"> (opens in a new tab)</span></a>
              ) : null}
              <button className="button-primary" type="button" disabled={pending || dirty} onClick={publish}>Publish</button>
              {selected.lifecycleState === "published" ? (
                <button
                  className="button-secondary"
                  type="button"
                  disabled={pending}
                  onClick={() => startTransition(async () => {
                    const result = await retryDeployment();
                    report(result.ok ? "Deployment requested." : result.error.message, !result.ok);
                  })}
                >
                  Retry deployment
                </button>
              ) : null}
              <button className="button-secondary" type="button" disabled={pending || selected.lifecycleState === "archived"} onClick={archive}>Archive</button>
            </div>
          </section>
          {dirty ? <p className="mono-meta mt-4 text-[var(--danger)]" role="status">UNSAVED CHANGES · Save before publishing.</p> : null}
          <details className="module mt-5">
            <summary className="min-h-11 cursor-pointer p-5 font-medium">Preview saved credential</summary>
            <div className="border-t border-[var(--line)] p-5">
              <p className="mono-meta accent">{selected.issuer || "Issuer not set"}</p>
              <h3 className="mt-3 text-2xl font-medium">{selected.name}</h3>
              <p className="mt-3 ink-soft">
                {selected.issueDate ? `Issued ${selected.issueDate}` : "Issue date not set"}
                {selected.expiryDate ? ` · Expires ${selected.expiryDate}` : ""}
              </p>
              {selected.skills.length ? <p className="mt-4">{selected.skills.join(" · ")}</p> : null}
            </div>
          </details>
          {message ? (
            <p
              className={`mono-meta mt-5 ${messageIsError ? "text-[var(--danger)]" : ""}`}
              ref={feedbackRef}
              role={messageIsError ? "alert" : "status"}
              tabIndex={messageIsError ? -1 : undefined}
            >
              {messageField ? <a className="underline" href={`#${messageField}`}>{message}</a> : message}
            </p>
          ) : null}
        </div>
      ) : (
        <div>
          <div className="module p-8"><p className="ink-soft">Create or select a credential to edit it.</p></div>
          {message ? (
            <p
              className={`mono-meta mt-5 ${messageIsError ? "text-[var(--danger)]" : ""}`}
              ref={feedbackRef}
              role={messageIsError ? "alert" : "status"}
              tabIndex={messageIsError ? -1 : undefined}
            >
              {messageField ? <a className="underline" href={`#${messageField}`}>{message}</a> : message}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
