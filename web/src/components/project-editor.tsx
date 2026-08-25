"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  archiveProjectAction,
  createProjectAction,
  publishProjectAction,
  reorderProjectsAction,
  retryProjectDeploymentAction,
  saveProjectAction,
} from "@/app/admin/(protected)/projects/actions";
import { ProjectUpload } from "@/components/project-upload";
import type {
  MutationError,
  ProjectDocumentBlock,
  ProjectLink,
} from "@/lib/portfolio-types";

type EditorProject = {
  projectId: string;
  slug: string;
  title: string;
  document: ProjectDocumentBlock[];
  coverAssetId: string | null;
  coverAlt: string;
  links: ProjectLink[];
  lockVersion: number;
  lifecycleState: "draft" | "published" | "archived";
  updatedAt: string;
};

type ListedProject = {
  id: string;
  title: string;
  slug: string;
  lifecycleState: "draft" | "published" | "archived";
  displayOrder: number;
  updatedAt: string;
};

type SaveState = "saved" | "unsaved" | "saving" | "blocked" | "error";
type PublishState = "idle" | "publishing" | "published" | "error";
type EditorAction = "publish" | "archive" | null;

function id() {
  return crypto.getRandomValues(new Uint32Array(4)).join("-");
}

function isHttpsUrl(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function canAutosaveDraft(draft: { title: string; links: ProjectLink[] }) {
  return Boolean(draft.title.trim()) && draft.links.every(
    (link) => Boolean(link.label.trim()) && isHttpsUrl(link.url),
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(new Date(value));
}

function ErrorSummary({ error }: { error: MutationError | null }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error) ref.current?.focus();
  }, [error]);
  if (!error) return null;
  return (
    <div
      className="module border-[var(--danger)] p-5"
      id="project-error-summary"
      ref={ref}
      role="alert"
      tabIndex={-1}
    >
      <p className="mono-label text-[var(--danger)]">Could not complete the action</p>
      <p className="mt-3">{error.message}</p>
      {error.fieldErrors ? (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
          {Object.entries(error.fieldErrors).map(([field, message]) => (
            <li key={field}>
              <a className="underline" href={`#project-${field}`}>{message}</a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function ProjectImagePreview({
  alt,
  className,
  src,
}: {
  alt: string;
  className: string;
  src: string;
}) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  return (
    <div className="relative flex min-h-48 items-center justify-center overflow-hidden border border-[var(--line)] bg-[var(--paper)]">
      {state === "loading" ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="loading-ring text-[var(--accent)]" aria-hidden="true" />
        </div>
      ) : null}
      {state === "error" ? (
        <p className="p-5 text-center text-sm text-[var(--danger)]" role="alert">
          Preview unavailable. The image is still attached.
        </p>
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt={alt}
        className={`${className} transition-opacity duration-200 motion-reduce:transition-none ${
          state === "ready" ? "opacity-100" : "opacity-0"
        }`}
        src={src}
        onError={() => setState("error")}
        onLoad={() => setState("ready")}
      />
      <span aria-live="polite" className="sr-only" role="status">
        {state === "loading"
          ? "Loading image preview"
          : state === "ready"
            ? "Image preview loaded"
            : ""}
      </span>
    </div>
  );
}

export function NewProjectButton() {
  const router = useRouter();
  const [error, setError] = useState<MutationError | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-start gap-2 md:items-end">
      <button
        className="button-primary"
        disabled={pending}
        type="button"
        onClick={() => {
          setError(null);
        startTransition(async () => {
          const result = await createProjectAction("Untitled project");
          if (!result.ok) {
            setError(result.error);
            return;
          }
          router.push(`/admin/projects/${result.data.projectId}`);
        });
        }}
      >
        {pending ? "Opening editor…" : "New project"}
      </button>
      {error ? (
        <p className="max-w-xs text-sm text-[var(--danger)]" role="alert">
          {error.message}
        </p>
      ) : null}
    </div>
  );
}

export function ProjectList({
  projects,
  deployment,
}: {
  projects: ListedProject[];
  deployment: { status: string; checkedAt: string | null } | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<MutationError | null>(null);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  const publishedProjects = projects.filter((project) => project.lifecycleState === "published");

  function move(projectId: string, direction: -1 | 1) {
    const currentIndex = publishedProjects.findIndex((project) => project.id === projectId);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= publishedProjects.length) return;
    const orderedProjectIds = publishedProjects.map((project) => project.id);
    [orderedProjectIds[currentIndex], orderedProjectIds[targetIndex]] = [
      orderedProjectIds[targetIndex],
      orderedProjectIds[currentIndex],
    ];
    startTransition(async () => {
      setMessage("");
      const result = await reorderProjectsAction({ orderedProjectIds });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError(null);
      setMessage(
        result.data.deploymentTriggered
          ? "Order saved. A production build was started."
          : "Order saved, but the production build could not be started.",
      );
      router.refresh();
    });
  }

  return (
    <div className="mt-8 space-y-5">
      <ErrorSummary error={error} />
      {message ? <p className="mono-meta accent" role="status">{message}</p> : null}
      <div className="module flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="mono-label">Latest deployment check</p>
          <p className="mono-meta muted mt-2">
            {deployment
              ? `${deployment.status.toUpperCase()}${deployment.checkedAt ? ` / ${formatDate(deployment.checkedAt)}` : ""}`
              : "UNAVAILABLE"}
          </p>
        </div>
        {!deployment || deployment.status !== "success" ? (
          <button
            className="button-secondary"
            disabled={pending}
            type="button"
            onClick={() =>
              startTransition(async () => {
                const result = await retryProjectDeploymentAction();
                if (!result.ok) setError(result.error);
                else {
                  setError(null);
                  setMessage("A production build was started.");
                }
              })
            }
          >
            Retry deployment
          </button>
        ) : null}
      </div>
      {!projects.length ? (
        <div className="module p-10">
          <p className="mono-meta accent">REGISTRY / EMPTY</p>
          <h2 className="mt-6 text-2xl font-medium">Add the first verified project.</h2>
          <p className="mt-3 max-w-2xl leading-7 ink-soft">
            Drafts stay private until you explicitly publish them.
          </p>
        </div>
      ) : (
        <ol className="space-y-4">
          {projects.map((project) => (
            <li className="module grid gap-5 p-5 md:grid-cols-[1fr_auto] md:items-center" key={project.id}>
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-xl font-medium">{project.title}</h2>
                  <span className="mono-meta accent">{project.lifecycleState.toUpperCase()}</span>
                </div>
                <p className="mono-meta muted mt-2">
                  /{project.slug} · Updated {formatDate(project.updatedAt)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  aria-label={`Move ${project.title} up`}
                  className="button-secondary"
                  disabled={
                    pending ||
                    project.lifecycleState !== "published" ||
                    publishedProjects.findIndex((item) => item.id === project.id) === 0
                  }
                  type="button"
                  onClick={() => move(project.id, -1)}
                >
                  Move up
                </button>
                <button
                  aria-label={`Move ${project.title} down`}
                  className="button-secondary"
                  disabled={
                    pending ||
                    project.lifecycleState !== "published" ||
                    publishedProjects.findIndex((item) => item.id === project.id) ===
                      publishedProjects.length - 1
                  }
                  type="button"
                  onClick={() => move(project.id, 1)}
                >
                  Move down
                </button>
                <a className="button-primary" href={`/admin/projects/${project.id}`}>Edit</a>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function ProjectEditor({ initial }: { initial: EditorProject }) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [blocks, setBlocks] = useState<ProjectDocumentBlock[]>(
    initial.document.length
      ? initial.document
      : [{ id: id(), type: "text", body: "", format: "paragraph" }],
  );
  const [coverAssetId, setCoverAssetId] = useState(initial.coverAssetId);
  const [coverAlt, setCoverAlt] = useState(initial.coverAlt);
  const [links, setLinks] = useState(initial.links);
  const [lockVersion, setLockVersion] = useState(initial.lockVersion);
  const [dirty, setDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(initial.updatedAt);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [publishState, setPublishState] = useState<PublishState>("idle");
  const [publishDetail, setPublishDetail] = useState("");
  const [activeAction, setActiveAction] = useState<EditorAction>(null);
  const [mediaPermission, setMediaPermission] = useState(false);
  const [error, setError] = useState<MutationError | null>(null);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const dirtyRef = useRef(false);
  const editRevisionRef = useRef(0);
  const saveInFlightRef = useRef(false);
  const lockVersionRef = useRef(initial.lockVersion);
  const draftRef = useRef({ title, blocks, coverAssetId, coverAlt, links });
  const hasMedia =
    Boolean(coverAssetId) || blocks.some((block) => block.type === "image");
  const hasTitle = Boolean(title.trim());
  const hasDocumentation = blocks.some(
    (block) => block.type === "text" && block.body.trim(),
  );
  const imageAltsReady = blocks.every(
    (block) => block.type !== "image" || block.alt.trim(),
  );
  const coverReady = !coverAssetId || Boolean(coverAlt.trim());
  const linksReady = links.every(
    (link) => Boolean(link.label.trim()) && isHttpsUrl(link.url),
  );
  const draftCanAutosave = hasTitle && linksReady;
  const publishReady =
    hasTitle && hasDocumentation && imageAltsReady && coverReady && linksReady;

  useEffect(() => {
    draftRef.current = { title, blocks, coverAssetId, coverAlt, links };
  }, [blocks, coverAlt, coverAssetId, links, title]);

  const save = useCallback(async () => {
    if (!dirtyRef.current) return;
    if (!canAutosaveDraft(draftRef.current)) {
      setSaveState("blocked");
      return;
    }
    if (saveInFlightRef.current) {
      return;
    }
    const revision = editRevisionRef.current;
    const draft = draftRef.current;
    let needsAnotherSave = false;
    saveInFlightRef.current = true;
    setSaveState("saving");

    try {
      const result = await saveProjectAction({
        projectId: initial.projectId,
        expectedLockVersion: lockVersionRef.current,
        title: draft.title,
        document: draft.blocks,
        coverAssetId: draft.coverAssetId,
        coverAlt: draft.coverAlt,
        links: draft.links,
      });
      if (!result.ok) {
        setError(result.error);
        setSaveState("error");
        return;
      }

      lockVersionRef.current = result.data.lockVersion;
      setLockVersion(result.data.lockVersion);
      setLastSavedAt(result.data.updatedAt);
      setError(null);
      if (editRevisionRef.current === revision) {
        dirtyRef.current = false;
        setDirty(false);
        setSaveState("saved");
      } else {
        needsAnotherSave = true;
      }
    } catch {
      setError({
        code: "autosave_failed",
        message: "The draft could not save. Check your connection and retry.",
      });
      setSaveState("error");
    } finally {
      saveInFlightRef.current = false;
      if (needsAnotherSave && dirtyRef.current) {
        queueMicrotask(() => void save());
      }
    }
  }, [initial.projectId]);

  useEffect(() => {
    if (!dirty || saveState === "saving") return;
    if (!draftCanAutosave) {
      setSaveState("blocked");
      return;
    }
    const timer = window.setTimeout(() => void save(), 800);
    return () => window.clearTimeout(timer);
  }, [blocks, coverAlt, coverAssetId, dirty, draftCanAutosave, links, save, saveState, title]);

  useEffect(() => {
    const saveWhenHidden = () => {
      if (document.visibilityState === "hidden") void save();
    };
    document.addEventListener("visibilitychange", saveWhenHidden);
    return () => document.removeEventListener("visibilitychange", saveWhenHidden);
  }, [save]);

  useEffect(() => {
    if (!dirty) return;
    const prompt = "Your latest changes are still saving. Leave anyway?";
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
    globalThis.document.addEventListener("click", beforeNavigation, true);
    globalThis.document.addEventListener("submit", beforeSubmit, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("popstate", beforeHistory);
      globalThis.document.removeEventListener("click", beforeNavigation, true);
      globalThis.document.removeEventListener("submit", beforeSubmit, true);
    };
  }, [dirty]);

  function changed() {
    dirtyRef.current = true;
    editRevisionRef.current += 1;
    setDirty(true);
    setSaveState("unsaved");
    if (activeAction !== "publish") {
      setPublishState("idle");
      setPublishDetail("");
    }
    setError(null);
    setMessage("");
  }

  function updateBlock(index: number, block: ProjectDocumentBlock) {
    setBlocks((current) => current.map((item, itemIndex) => itemIndex === index ? block : item));
    changed();
  }

  function moveBlock(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;
    const label = blocks[index].type === "text"
      ? blocks[index].heading?.trim() || `Text block ${index + 1}`
      : blocks[index].caption?.trim() || `Image block ${index + 1}`;
    setBlocks((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    changed();
    setMessage(`${label} moved to position ${target + 1}.`);
  }

  function publish() {
    const revision = editRevisionRef.current;
    setActiveAction("publish");
    setPublishState("publishing");
    setPublishDetail("");
    setError(null);
    startTransition(async () => {
      try {
        const result = await publishProjectAction({
          projectId: initial.projectId,
          expectedLockVersion: lockVersion,
          mediaPermissionConfirmed: mediaPermission,
        });
        if (!result.ok) {
          setError(result.error);
          setPublishState("error");
          setPublishDetail("Publishing stopped. Review the issue above and try again.");
          return;
        }
        setError(null);
        if (editRevisionRef.current === revision) {
          setPublishState("published");
          setPublishDetail(
            result.data.deploymentTriggered
              ? "The public snapshot is ready. A production build was started."
              : "The public snapshot is ready, but the production build could not be started.",
          );
        } else {
          setPublishState("idle");
          setPublishDetail("");
          setMessage("The previous snapshot was published. Your newer changes remain in the draft.");
        }
        router.refresh();
      } catch {
        setError({
          code: "publish_failed",
          message: "The project could not be published. Check your connection and try again.",
        });
        setPublishState("error");
        setPublishDetail("Publishing stopped. Review the issue above and try again.");
      } finally {
        setActiveAction(null);
      }
    });
  }

  return (
    <div className="max-w-6xl">
      <div className="flex flex-col gap-6 border-b border-[var(--line)] pb-8 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mono-meta accent">[ PROJECT_EDITOR ]</p>
          <h1 className="mt-4 text-4xl font-semibold">{title || "Untitled project"}</h1>
          <p className="mono-meta muted mt-3">
            {initial.lifecycleState.toUpperCase()} · /{initial.slug}
          </p>
        </div>
        <div className="flex flex-col items-start gap-3 md:items-end">
          <p
            className={`mono-meta ${saveState === "error" || saveState === "blocked" ? "text-[var(--danger)]" : saveState === "saved" ? "accent" : "muted"}`}
            role="status"
          >
            {saveState === "saving"
              ? "SAVING DRAFT…"
              : saveState === "error"
                ? "AUTOSAVE NEEDS ATTENTION"
                : saveState === "blocked"
                  ? "COMPLETE REQUIRED FIELDS TO SAVE"
                  : dirty
                  ? "AUTOSAVE PENDING"
                  : `SAVED / ${formatDate(lastSavedAt)}`}
          </p>
          <div className="flex flex-wrap gap-3">
            {saveState === "error" ? (
              <button className="button-secondary" type="button" onClick={() => void save()}>
                Retry save
              </button>
            ) : null}
            <button
              className="button-secondary"
              disabled={dirty || saveState === "saving"}
              type="button"
              onClick={() => window.open(`/admin/projects/${initial.projectId}/preview`, "_blank", "noopener,noreferrer")}
            >
              Preview
            </button>
          </div>
        </div>
      </div>

      <div className="mt-8 space-y-5">
        <ErrorSummary error={error} />
        {message ? <p className="mono-meta accent" role="status">{message}</p> : null}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_300px]">
        <div className="space-y-8">
          <section className="module scroll-mt-24 p-7" id="project-details">
            <p className="mono-meta accent">01 / DETAILS</p>
            <h2 className="mt-3 text-2xl font-medium">Name the project</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 ink-soft">
              Use a clear name. The draft saves automatically while you work.
            </p>
            <label className="mt-6 block">
              <span className="mono-label muted">Project title</span>
              <input
                aria-describedby={error?.fieldErrors?.title ? "project-error-summary" : undefined}
                aria-invalid={Boolean(error?.fieldErrors?.title)}
                autoFocus={initial.title === "Untitled project"}
                className="field mt-2"
                id="project-title"
                maxLength={160}
                placeholder="Example: Clinic receptionist automation"
                required
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  changed();
                }}
              />
            </label>
          </section>

          <section className="scroll-mt-24" id="project-document">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="mono-meta accent">02 / PROJECT STORY</p>
                <h2 className="mt-3 text-2xl font-medium">Explain what you built</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 ink-soft">
                  Describe the problem, your approach, how the system works, and the result. Add another section only when it improves the story.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  className="button-secondary"
                  type="button"
                  onClick={() => {
                    setBlocks((current) => [
                      ...current,
                      { id: id(), type: "text", body: "", format: "paragraph" },
                    ]);
                    changed();
                  }}
                >
                  Add section
                </button>
              </div>
            </div>
            <div className="mt-5 space-y-4">
              {blocks.map((block, index) => (
                <article className="module p-5" key={block.id}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="mono-label">
                      {String(index + 1).padStart(2, "0")} / {block.type.toUpperCase()}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        aria-label={`Move ${block.type} block ${index + 1} up`}
                        className="button-secondary"
                        disabled={index === 0}
                        type="button"
                        onClick={() => moveBlock(index, -1)}
                      >
                        Move earlier
                      </button>
                      <button
                        aria-label={`Move ${block.type} block ${index + 1} down`}
                        className="button-secondary"
                        disabled={index === blocks.length - 1}
                        type="button"
                        onClick={() => moveBlock(index, 1)}
                      >
                        Move later
                      </button>
                      <button
                        aria-label={`Remove ${block.type} block ${index + 1}`}
                        className="button-secondary"
                        disabled={blocks.length === 1}
                        type="button"
                        onClick={() => {
                          setBlocks((current) => current.filter((item) => item.id !== block.id));
                          changed();
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  {block.type === "text" ? (
                    <div className="mt-5 grid gap-5">
                      <label>
                        <span className="mono-label muted">Section heading (optional)</span>
                        <input
                          className="field mt-2"
                          maxLength={160}
                          value={block.heading ?? ""}
                          onChange={(event) =>
                            updateBlock(index, { ...block, heading: event.target.value || undefined })
                          }
                        />
                      </label>
                      <label>
                        <span className="mono-label muted">Content style</span>
                        <select
                          className="field mt-2"
                          value={block.format}
                          onChange={(event) =>
                            updateBlock(index, {
                              ...block,
                              format: event.target.value as Extract<ProjectDocumentBlock, { type: "text" }>["format"],
                            })
                          }
                        >
                          <option value="paragraph">Normal text</option>
                          <option value="bullets">Bullet list</option>
                          <option value="numbered">Numbered list</option>
                          <option value="code">Code block</option>
                        </select>
                      </label>
                      {block.format === "code" ? (
                        <label>
                          <span className="mono-label muted">Language (optional)</span>
                          <input
                            className="field mt-2"
                            maxLength={50}
                            value={block.language ?? ""}
                            onChange={(event) =>
                              updateBlock(index, { ...block, language: event.target.value || undefined })
                            }
                          />
                        </label>
                      ) : null}
                      <label>
                        <span className="mono-label muted">
                          {index === 0 ? "Project documentation" : "Section content"}
                        </span>
                        <textarea
                          aria-describedby={error?.fieldErrors?.document ? "project-error-summary" : undefined}
                          aria-invalid={Boolean(error?.fieldErrors?.document)}
                          className="field mt-2 min-h-40"
                          maxLength={100000}
                          placeholder="Describe the challenge, workflow, implementation, and what changed."
                          value={block.body}
                          onChange={(event) => updateBlock(index, { ...block, body: event.target.value })}
                        />
                      </label>
                    </div>
                  ) : (
                    <div className="mt-5 grid gap-5">
                      <ProjectImagePreview
                        alt=""
                        className="max-h-80 w-full object-contain"
                        src={`/api/admin/assets/${block.assetId}/preview`}
                      />
                      <label>
                        <span className="mono-label muted">Image description</span>
                        <input
                          aria-invalid={Boolean(error?.fieldErrors?.document && !block.alt.trim())}
                          className="field mt-2"
                          maxLength={300}
                          placeholder="Describe what the image shows"
                          required
                          value={block.alt}
                          onChange={(event) => updateBlock(index, { ...block, alt: event.target.value })}
                        />
                      </label>
                      <label>
                        <span className="mono-label muted">Caption (optional)</span>
                        <input
                          className="field mt-2"
                          maxLength={500}
                          value={block.caption ?? ""}
                          onChange={(event) =>
                            updateBlock(index, { ...block, caption: event.target.value || undefined })
                          }
                        />
                      </label>
                    </div>
                  )}
                </article>
              ))}
            </div>
            <div className="module mt-4 p-5">
              <ProjectUpload
                label="Add project image"
                resetKey={blocks.filter((item) => item.type === "image").length}
                onReady={(assetId) => {
                  setBlocks((current) => [...current, { id: id(), type: "image", assetId, alt: "" }]);
                  changed();
                }}
              />
            </div>
          </section>

          <section className="module p-7" id="project-links">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="mono-meta accent">03 / LINKS</p>
                <h2 className="mt-3 text-xl font-medium">Add a link only if it helps</h2>
                <p className="mt-2 text-sm leading-6 ink-soft">
                  This section is optional. Use a short label and a secure HTTPS address.
                </p>
              </div>
              <button
                className="button-secondary"
                type="button"
                onClick={() => {
                  setLinks((current) => [
                    ...current,
                    { id: id(), label: "", url: "", kind: "other" },
                  ]);
                  changed();
                }}
              >
                Add link
              </button>
            </div>
            <div className="mt-5 space-y-4">
              {links.map((link, index) => (
                <div className="grid gap-4 border-t border-[var(--line)] pt-5 xl:grid-cols-[1fr_1.5fr_auto]" key={link.id}>
                  <label>
                    <span className="mono-label muted">Label</span>
                    <input
                      aria-describedby={error?.fieldErrors?.links ? "project-error-summary" : undefined}
                      className="field mt-2"
                      maxLength={100}
                      placeholder="Live project"
                      value={link.label}
                      onChange={(event) => {
                        setLinks((current) => current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, label: event.target.value } : item,
                        ));
                        changed();
                      }}
                    />
                  </label>
                  <label>
                    <span className="mono-label muted">HTTPS URL</span>
                    <input
                      aria-invalid={Boolean(error?.fieldErrors?.links)}
                      className="field mt-2"
                      maxLength={2048}
                      pattern="https://.*"
                      placeholder="https://example.com"
                      type="url"
                      value={link.url}
                      onChange={(event) => {
                        setLinks((current) => current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, url: event.target.value } : item,
                        ));
                        changed();
                      }}
                    />
                  </label>
                  <button
                    aria-label={`Remove link ${index + 1}`}
                    className="button-secondary self-end"
                    type="button"
                    onClick={() => {
                      setLinks((current) => current.filter((item) => item.id !== link.id));
                      changed();
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <div className="module scroll-mt-24 p-5" id="project-cover">
            <p className="mono-meta accent">03 / MEDIA</p>
            <h2 className="mt-3 text-xl font-medium">Cover image</h2>
            <p className="mt-2 text-sm leading-6 ink-soft">
              Optional. It appears at the top of the full project page.
            </p>
            <div className="mt-5">
              <ProjectUpload
                label={coverAssetId ? "Replace cover image" : "Choose cover image"}
                resetKey={coverAssetId ?? "empty-cover"}
                onReady={(assetId) => {
                  setCoverAssetId(assetId);
                  setCoverAlt("");
                  changed();
                }}
              />
            </div>
            {coverAssetId ? (
              <div className="mt-5">
                <ProjectImagePreview
                  alt={coverAlt}
                  className="max-h-56 w-full object-contain"
                  key={coverAssetId}
                  src={`/api/admin/assets/${coverAssetId}/preview`}
                />
                <label className="mt-4 block">
                  <span className="mono-label muted">Cover alt text</span>
                  <input
                    aria-describedby={error?.fieldErrors?.cover ? "project-error-summary" : undefined}
                    aria-invalid={Boolean(error?.fieldErrors?.cover && !coverAlt.trim())}
                    className="field mt-2"
                    maxLength={300}
                    required
                    value={coverAlt}
                    onChange={(event) => {
                      setCoverAlt(event.target.value);
                      changed();
                    }}
                  />
                </label>
                <button
                  className="button-secondary mt-3 w-full"
                  type="button"
                  onClick={() => {
                    setCoverAssetId(null);
                    setCoverAlt("");
                    changed();
                  }}
                >
                  Remove cover
                </button>
              </div>
            ) : null}
          </div>
          <div className="module scroll-mt-24 p-5" id="project-publish">
            <p className="mono-meta accent">04 / PUBLISH</p>
            <h2 className="mt-3 text-xl font-medium">Ready to publish?</h2>
            <p className="mt-2 text-sm leading-6 ink-soft">
              Complete the checklist. Publishing creates the public snapshot.
            </p>
            <ul className="mono-meta muted mt-5 space-y-3">
              <li>{hasTitle ? "●" : "○"} Project title</li>
              <li>{hasDocumentation ? "●" : "○"} Project documentation</li>
              <li>{imageAltsReady ? "●" : "○"} Image descriptions</li>
              <li>{coverReady ? "●" : "○"} Cover description</li>
              <li>{linksReady ? "●" : "○"} Optional links complete</li>
              <li>{dirty ? "○" : "●"} Saved draft</li>
            </ul>
            {hasMedia ? (
              <label className="mt-6 flex gap-3 text-sm leading-6">
                <input
                  aria-describedby={error?.fieldErrors?.mediaPermission ? "project-error-summary" : undefined}
                  checked={mediaPermission}
                  className="mt-1 h-5 w-5 shrink-0"
                  id="project-mediaPermission"
                  type="checkbox"
                  onChange={(event) => setMediaPermission(event.target.checked)}
                />
                <span>I confirm I have permission to publish these project images.</span>
              </label>
            ) : null}
            <button
              aria-busy={activeAction === "publish"}
              className="button-primary mt-6 w-full"
              data-operation-state={
                activeAction === "publish"
                  ? "working"
                  : publishState === "published"
                    ? "complete"
                    : undefined
              }
              disabled={
                pending ||
                dirty ||
                !publishReady ||
                (hasMedia && !mediaPermission) ||
                saveState === "saving" ||
                publishState === "published"
              }
              type="button"
              onClick={publish}
            >
              {activeAction === "publish" ? (
                <>
                  <span className="loading-ring" aria-hidden="true" />
                  Publishing project…
                </>
              )
                : publishState === "published"
                  ? "Published"
                  : publishState === "error"
                    ? "Try publishing again"
                    : "Publish project"}
            </button>
            {publishState !== "idle" ? (
              <p
                aria-live="polite"
                className={`mt-3 text-sm leading-6 ${
                  publishState === "error" ? "text-[var(--danger)]" : "ink-soft"
                }`}
                role="status"
              >
                {publishState === "publishing"
                  ? "Preparing the public project and its images. Keep this page open."
                  : publishDetail}
              </p>
            ) : null}
          </div>
          <div className="module p-5">
            <h2 className="mono-label">Archive</h2>
            <p className="mono-meta muted mt-3">Archived projects are retained and removed from public listings after deployment.</p>
            <button
              className="button-secondary mt-5 w-full"
              disabled={pending || dirty || initial.lifecycleState === "archived"}
              type="button"
              onClick={() => {
                if (!window.confirm("Archive this project? It will be retained.")) return;
                setActiveAction("archive");
                startTransition(async () => {
                  try {
                    const result = await archiveProjectAction(initial.projectId);
                    if (!result.ok) setError(result.error);
                    else {
                      setError(null);
                      setMessage(
                        result.data.deploymentTriggered
                          ? "Project archived. A production build was started."
                          : "Project archived, but the production build could not be started.",
                      );
                      router.refresh();
                    }
                  } finally {
                    setActiveAction(null);
                  }
                });
              }}
            >
              {activeAction === "archive" ? "Archiving project…" : "Archive project"}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
