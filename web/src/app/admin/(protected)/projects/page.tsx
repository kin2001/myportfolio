import { NewProjectButton, ProjectList } from "@/components/project-editor";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ProjectsAdminPage() {
  const supabase = await createSupabaseServerClient();
  const [projectsResult, deploymentResult] = supabase
    ? await Promise.all([
        supabase
          .from("projects")
          .select("id,slug,lifecycle_state,display_order,updated_at,draft:project_drafts(title)")
          .order("display_order")
          .order("updated_at", { ascending: false }),
        supabase
          .from("deployment_checks")
          .select("status,checked_at")
          .order("checked_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])
    : [
        { data: [], error: null },
        { data: null, error: null },
      ];

  const projects = (projectsResult.data ?? []).map((project) => {
    const draft = project.draft as unknown as { title: string } | { title: string }[] | null;
    return {
      id: project.id,
      title: (Array.isArray(draft) ? draft[0]?.title : draft?.title) ?? "Untitled project",
      slug: project.slug,
      lifecycleState: project.lifecycle_state as "draft" | "published" | "archived",
      displayOrder: project.display_order,
      updatedAt: project.updated_at,
    };
  });
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
        <NewProjectButton />
      </div>
      <ProjectList projects={projects} deployment={deployment} />
    </div>
  );
}
