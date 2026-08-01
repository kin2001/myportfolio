import Link from "next/link";
import { ProjectList } from "@/components/project-editor";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ProjectsAdminPage() {
  const supabase = await createSupabaseServerClient();
  const [projectsResult, draftsResult, deploymentResult] = supabase
    ? await Promise.all([
        supabase
          .from("projects")
          .select("id,slug,lifecycle_state,display_order,updated_at")
          .order("display_order")
          .order("updated_at", { ascending: false }),
        supabase.from("project_drafts").select("project_id,title"),
        supabase
          .from("deployment_checks")
          .select("status,checked_at")
          .order("checked_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
        { data: null, error: null },
      ];

  const titles = new Map(
    (draftsResult.data ?? []).map((draft) => [draft.project_id, draft.title]),
  );
  const projects = (projectsResult.data ?? []).map((project) => ({
    id: project.id,
    title: titles.get(project.id) ?? "Untitled project",
    slug: project.slug,
    lifecycleState: project.lifecycle_state as "draft" | "published" | "archived",
    displayOrder: project.display_order,
    updatedAt: project.updated_at,
  }));
  const deployment = deploymentResult.data
    ? {
        status: deploymentResult.data.status,
        checkedAt: deploymentResult.data.checked_at,
      }
    : null;

  return (
    <div className="max-w-6xl">
      <div className="flex flex-col gap-6 border-b border-[var(--line)] pb-8 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mono-meta accent">[ PROJECT_REGISTRY ]</p>
          <h1 className="mt-4 text-4xl font-semibold">Projects</h1>
        </div>
        <Link href="/admin/projects/new" className="button-primary">New project</Link>
      </div>
      <ProjectList projects={projects} deployment={deployment} />
    </div>
  );
}
