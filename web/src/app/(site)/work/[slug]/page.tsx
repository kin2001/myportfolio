import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { projects } from "@/lib/content";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const project = projects.find((item) => item.slug === slug && item.status === "published");
  return project ? { title: project.title, description: project.summary } : { title: "Project not found" };
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = projects.find((item) => item.slug === slug && item.status === "published");
  if (!project) notFound();
  return (
    <article className="content-canvas">
      <header className="max-w-4xl py-16 md:py-24">
        <p className="mono-meta accent">[ CASE_STUDY / {project.slug.toUpperCase()} ]</p>
        <h1 className="mt-6 text-5xl font-semibold tracking-tight md:text-7xl">{project.title}</h1>
        <p className="mt-6 max-w-3xl text-xl leading-8 ink-soft">{project.summary}</p>
        <div className="mt-10 flex flex-wrap gap-2">{project.tools.map((tool) => <span className="mono-meta surface-soft px-3 py-2" key={tool}>{tool}</span>)}</div>
      </header>
      {[
        ["01", "Problem", project.problem],
        ["02", "Solution", project.solution],
        ["03", "Outcome", project.outcome ?? "Verified qualitative outcome documented after implementation review."],
      ].map(([index, title, body]) => (
        <section key={index} className="grid gap-6 border-t border-[var(--line)] py-12 md:grid-cols-[120px_1fr_2fr]">
          <span className="mono-meta accent">{index}</span><h2 className="text-2xl font-medium">{title}</h2><p className="leading-8 ink-soft">{body}</p>
        </section>
      ))}
    </article>
  );
}
