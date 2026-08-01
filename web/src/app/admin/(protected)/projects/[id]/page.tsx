import { notFound } from "next/navigation";
import { ProjectEditor } from "@/components/project-editor";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ProjectDocumentBlock, ProjectLink } from "@/lib/portfolio-types";

export default async function ProjectEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  if (!supabase) notFound();

  const [projectResult, draftResult] = await Promise.all([
    supabase
      .from("projects")
      .select("id,slug,lifecycle_state")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("project_drafts")
      .select("project_id,title,document,cover_asset_id,cover_alt,links,lock_version,updated_at")
      .eq("project_id", id)
      .maybeSingle(),
  ]);
  if (!projectResult.data || !draftResult.data) notFound();

  return (
    <ProjectEditor
      initial={{
        projectId: projectResult.data.id,
        slug: projectResult.data.slug,
        title: draftResult.data.title,
        document: draftResult.data.document as ProjectDocumentBlock[],
        coverAssetId: draftResult.data.cover_asset_id,
        coverAlt: draftResult.data.cover_alt ?? "",
        links: draftResult.data.links as ProjectLink[],
        lockVersion: draftResult.data.lock_version,
        lifecycleState: projectResult.data.lifecycle_state as "draft" | "published" | "archived",
        updatedAt: draftResult.data.updated_at,
      }}
    />
  );
}
