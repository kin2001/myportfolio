import Link from "next/link";

export default function ProjectsAdminPage() {
  return (
    <div className="max-w-6xl">
      <div className="flex flex-col gap-6 border-b border-[var(--line)] pb-8 md:flex-row md:items-end md:justify-between"><div><p className="mono-meta accent">[ PROJECT_REGISTRY ]</p><h1 className="mt-4 text-4xl font-semibold">Projects</h1></div><Link href="/admin/projects/new" className="button-primary">New project</Link></div>
      <div className="module mt-8 p-10"><p className="mono-meta accent">REGISTRY / EMPTY</p><h2 className="mt-6 text-2xl font-medium">Add the first verified project.</h2><p className="mt-3 max-w-2xl leading-7 ink-soft">Drafts stay private. Publishing will require the problem, context, workflow, implementation, outcome, reflection, and evidence permissions.</p></div>
    </div>
  );
}
