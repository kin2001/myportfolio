import { NewProjectForm } from "@/components/project-editor";

export default function NewProjectPage() {
  return (
    <div className="max-w-6xl">
      <div className="border-b border-[var(--line)] pb-8">
        <p className="mono-meta accent">[ NEW_PROJECT ]</p>
        <h1 className="mt-4 text-4xl font-semibold">Create project draft</h1>
      </div>
      <NewProjectForm />
    </div>
  );
}
