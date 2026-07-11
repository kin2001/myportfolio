import type { Metadata } from "next";
import Link from "next/link";
import { SectionHeader } from "@/components/section-header";
import { projects } from "@/lib/content";

export const metadata: Metadata = { title: "Work", description: "Verified workflow automation and AI systems by Artkin Carreon." };

export default function WorkPage() {
  const published = projects.filter((project) => project.status === "published");
  return (
    <div className="content-canvas">
      <header className="max-w-3xl py-16 md:py-24">
        <p className="mono-meta accent">[ WORK_INDEX ]</p>
        <h1 className="mt-5 text-5xl font-semibold tracking-tight md:text-7xl">Systems, not screenshots.</h1>
        <p className="mt-6 text-lg leading-8 ink-soft">Each record documents the original process, constraints, automation design, implementation, verified outcome, and lessons learned.</p>
      </header>
      <SectionHeader index="01" title="Published case studies" meta={published.length.toString().padStart(2, "0") + " PUBLIC RECORDS"} />
      {published.length ? (
        <div className="mt-8 space-y-6">
          {published.map((project, index) => (
            <article key={project.slug} className="module grid gap-8 p-8 md:grid-cols-[100px_1fr_1fr_auto] md:items-start">
              <span className="mono-meta accent">{String(index + 1).padStart(2, "0")}</span>
              <div><h2 className="text-2xl font-medium">{project.title}</h2><p className="mt-3 leading-7 ink-soft">{project.summary}</p></div>
              <div><span className="mono-label muted">Verified outcome</span><p className="mt-3 text-sm leading-6">{project.outcome ?? "Qualitative outcome documented in the full case study."}</p></div>
              <Link href={"/work/" + project.slug} className="button-secondary">Open record</Link>
            </article>
          ))}
        </div>
      ) : (
        <div className="module mt-8 p-8 md:p-12">
          <p className="mono-meta accent">PUBLICATION_STATUS / HOLD</p>
          <h2 className="mt-6 text-3xl font-medium">No unverified claims.</h2>
          <p className="mt-4 max-w-2xl leading-7 ink-soft">Case studies will be published after Artkin supplies the real project context, tools, permissions, and outcomes. The portfolio intentionally does not display the fictional projects included in the Stitch reference.</p>
          <Link href="/contact" className="button-primary mt-8">Discuss a workflow</Link>
        </div>
      )}
      <section className="section-space">
        <SectionHeader index="02" title="Publication standard" />
        <div className="mt-8 grid gap-px border border-[var(--line)] bg-[var(--line)] md:grid-cols-2">
          {["Problem and operational context", "Previous workflow and bottlenecks", "Architecture and implementation", "Verified outcome and tradeoffs"].map((item, index) => (
            <div key={item} className="surface p-8"><span className="mono-meta accent">0{index + 1}</span><h3 className="mt-6 text-xl font-medium">{item}</h3></div>
          ))}
        </div>
      </section>
    </div>
  );
}
