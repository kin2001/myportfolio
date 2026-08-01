"use client";

import { useEffect, useRef, useState, useTransition } from "react";
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

const linkKinds: ProjectLink["kind"][] = [
  "github",
  "demo",
  "video",
  "file",
  "documentation",
  "other",
];

function id() {
  return crypto.randomUUID();
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

export function NewProjectForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [error, setError] = useState<MutationError | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="module mt-8 max-w-2xl p-7"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await createProjectAction(title);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          router.push(`/admin/projects/${result.data.projectId}`);
        });
      }}
    >
      <ErrorSummary error={error} />
      <label className="mt-6 block">
        <span className="mono-label">Project title</span>
        <input
          aria-describedby={error?.fieldErrors?.title ? "project-error-summary" : undefined}
          aria-invalid={Boolean(error?.fieldErrors?.title)}
          autoFocus
          className="field mt-3"
          id="project-title"
          maxLength={160}
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>
      <p className="mono-meta muted mt-4">
        The private draft is created now. Documentation and images are added next.
      </p>
      <button className="button-primary mt-7" disabled={pending} type="submit">
        {pending ? "Creating…" : "Create draft"}
      </button>
    </form>
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
  const [mediaPermission, setMediaPermission] = useState(false);
  const [error, setError] = useState<MutationError | null>(null);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const hasMedia =
    Boolean(coverAssetId) || blocks.some((block) => block.type === "image");

  useEffect(() => {
    if (!dirty) return;
    const prompt = "Leave without saving your project changes?";
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
    setDirty(true);
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

  function save() {
    startTransition(async () => {
      const result = await saveProjectAction({
        projectId: initial.projectId,
        expectedLockVersion: lockVersion,
        title,
        document: blocks,
        coverAssetId,
        coverAlt,
        links,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError(null);
      setLockVersion(result.data.lockVersion);
      setDirty(false);
      setMessage(`Draft saved ${formatDate(result.data.updatedAt)}.`);
      router.refresh();
    });
  }

  function publish() {
    startTransition(async () => {
      const result = await publishProjectAction({
        projectId: initial.projectId,
        expectedLockVersion: lockVersion,
        mediaPermissionConfirmed: mediaPermission,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError(null);
      setMessage(
        result.data.deploymentTriggered
          ? "Published snapshot created. A production build was started."
          : "Published snapshot created, but the production build could not be started.",
      );
      router.refresh();
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
        <div className="flex flex-wrap gap-3">
          <button
            className="button-secondary"
            type="button"
            onClick={() => window.open(`/admin/projects/${initial.projectId}/preview`, "_blank", "noopener,noreferrer")}
          >
            Preview saved draft
          </button>
          <button className="button-primary" disabled={pending || !dirty} type="button" onClick={save}>
            {pending ? "Working…" : "Save draft"}
          </button>
        </div>
      </div>

      <div className="mt-8 space-y-5">
        <ErrorSummary error={error} />
        {message ? <p className="mono-meta accent" role="status">{message}</p> : null}
        {dirty ? <p className="mono-meta text-[var(--danger)]" role="status">UNSAVED CHANGES</p> : null}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_300px]">
        <div className="space-y-8">
          <section className="module p-7">
            <h2 className="mono-label">Project identity</h2>
            <label className="mt-7 block">
              <span className="mono-label muted">Title</span>
              <input
                aria-describedby={error?.fieldErrors?.title ? "project-error-summary" : undefined}
                aria-invalid={Boolean(error?.fieldErrors?.title)}
                className="field mt-2"
                id="project-title"
                maxLength={160}
                required
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  changed();
                }}
              />
            </label>
          </section>

          <section id="project-document">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="mono-label">Documentation</h2>
                <p className="mono-meta muted mt-2">At least one nonempty text block is required to publish.</p>
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
                  Add text
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
                        Move up
                      </button>
                      <button
                        aria-label={`Move ${block.type} block ${index + 1} down`}
                        className="button-secondary"
                        disabled={index === blocks.length - 1}
                        type="button"
                        onClick={() => moveBlock(index, 1)}
                      >
                        Move down
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
                        <span className="mono-label muted">Heading (optional)</span>
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
                        <span className="mono-label muted">Format</span>
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
                          <option value="paragraph">Paragraph</option>
                          <option value="bullets">Bullets</option>
                          <option value="numbered">Numbered</option>
                          <option value="code">Code</option>
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
                        <span className="mono-label muted">Body</span>
                        <textarea
                          aria-describedby={error?.fieldErrors?.document ? "project-error-summary" : undefined}
                          aria-invalid={Boolean(error?.fieldErrors?.document)}
                          className="field mt-2 min-h-40"
                          maxLength={100000}
                          value={block.body}
                          onChange={(event) => updateBlock(index, { ...block, body: event.target.value })}
                        />
                      </label>
                    </div>
                  ) : (
                    <div className="mt-5 grid gap-5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        alt=""
                        className="max-h-80 w-full border border-[var(--line)] object-contain"
                        src={`/api/admin/assets/${block.assetId}/preview`}
                      />
                      <label>
                        <span className="mono-label muted">Alt text</span>
                        <input
                          aria-invalid={Boolean(error?.fieldErrors?.document && !block.alt.trim())}
                          className="field mt-2"
                          maxLength={300}
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
                label="Add documentation image"
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
                <h2 className="mono-label">Optional links</h2>
                <p className="mono-meta muted mt-2">Only labeled HTTPS links are accepted.</p>
              </div>
              <button
                className="button-secondary"
                type="button"
                onClick={() => {
                  setLinks((current) => [
                    ...current,
                    { id: id(), label: "", url: "https://", kind: "other" },
                  ]);
                  changed();
                }}
              >
                Add link
              </button>
            </div>
            <div className="mt-5 space-y-4">
              {links.map((link, index) => (
                <div className="grid gap-4 border-t border-[var(--line)] pt-5 xl:grid-cols-[1fr_1.5fr_160px_auto]" key={link.id}>
                  <label>
                    <span className="mono-label muted">Label</span>
                    <input
                      aria-describedby={error?.fieldErrors?.links ? "project-error-summary" : undefined}
                      className="field mt-2"
                      maxLength={100}
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
                  <label>
                    <span className="mono-label muted">Kind</span>
                    <select
                      className="field mt-2"
                      value={link.kind}
                      onChange={(event) => {
                        setLinks((current) => current.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, kind: event.target.value as ProjectLink["kind"] }
                            : item,
                        ));
                        changed();
                      }}
                    >
                      {linkKinds.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
                    </select>
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
          <div className="module p-5" id="project-cover">
            <ProjectUpload
              label="Optional cover image"
                onReady={(assetId) => {
                  setCoverAssetId(assetId);
                  setCoverAlt("");
                  changed();
                }}
            />
            {coverAssetId ? (
              <div className="mt-5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt={coverAlt}
                  className="max-h-56 w-full border border-[var(--line)] object-contain"
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
          <div className="module p-5">
            <h2 className="mono-label">Publish gate</h2>
            <ul className="mono-meta muted mt-5 space-y-3">
              <li>{title.trim() ? "●" : "○"} Project title</li>
              <li>{blocks.some((block) => block.type === "text" && block.body.trim()) ? "●" : "○"} Documentation text</li>
              <li>{blocks.every((block) => block.type !== "image" || block.alt.trim()) ? "●" : "○"} Image alt text</li>
              <li>{!coverAssetId || coverAlt.trim() ? "●" : "○"} Cover alt text</li>
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
              className="button-primary mt-6 w-full"
              disabled={
                pending ||
                dirty ||
                (hasMedia && !mediaPermission) ||
                Boolean(coverAssetId && !coverAlt.trim())
              }
              type="button"
              onClick={publish}
            >
              Publish
            </button>
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
                startTransition(async () => {
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
                });
              }}
            >
              Archive project
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
