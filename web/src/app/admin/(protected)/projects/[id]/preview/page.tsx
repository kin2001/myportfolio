import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProjectDocument } from "@/components/project-document";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ProjectDocumentBlock, ProjectLink } from "@/lib/portfolio-types";

export const metadata: Metadata = {
  title: "Project draft preview",
  robots: { index: false, follow: false },
};

export default async function ProjectPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  if (!supabase) notFound();
  const { data: draft } = await supabase
    .from("project_drafts")
    .select("title,document,cover_asset_id,cover_alt,links,updated_at")
    .eq("project_id", id)
    .maybeSingle();
  if (!draft) notFound();

  const document = draft.document as ProjectDocumentBlock[];
  const links = draft.links as ProjectLink[];
  const assetIds = [
    draft.cover_asset_id,
    ...document.flatMap((block) => block.type === "image" ? [block.assetId] : []),
  ].filter((assetId): assetId is string => Boolean(assetId));
  const { data: assetRows } = assetIds.length
    ? await supabase.from("assets").select("id,width,height").in("id", assetIds)
    : { data: [] };
  const assets = Object.fromEntries(
    (assetRows ?? []).flatMap((asset) =>
      asset.width && asset.height
        ? [[asset.id, {
            url: `/api/admin/assets/${asset.id}/preview`,
            width: asset.width,
            height: asset.height,
          }]]
        : [],
    ),
  );
  const cover = draft.cover_asset_id ? assets[draft.cover_asset_id] : null;
  return (
    <article className="content-canvas">
      <header className="border-b border-[var(--line)] pb-8">
        <p className="mono-meta accent">[ PRIVATE_DRAFT_PREVIEW ]</p>
        <h1 className="mt-5 text-4xl font-semibold md:text-6xl">{draft.title}</h1>
        <p className="mono-meta muted mt-4">Saved {new Date(draft.updated_at).toLocaleString()}</p>
      </header>
      {cover ? (
        <img
          alt={draft.cover_alt ?? ""}
          className="mt-8 h-auto w-full border border-[var(--line)] object-contain"
          src={cover.url}
          width={cover.width}
          height={cover.height}
        />
      ) : null}
      <div className="mt-12"><ProjectDocument blocks={document} assets={assets} /></div>
      {links.length ? (
        <section className="mt-12 border-t border-[var(--line)] pt-8">
          <h2 className="mono-label">Project links</h2>
          <ul className="mt-5 flex flex-wrap gap-3">
            {links.map((link) => (
              <li key={link.id}>
                <a className="button-secondary" href={link.url} rel="noreferrer" target="_blank">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
