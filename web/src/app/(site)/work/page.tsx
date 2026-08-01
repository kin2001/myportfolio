import type { Metadata } from "next";
import Link from "next/link";
import { SectionHeader } from "@/components/section-header";
import { getPublishedProjects } from "@/lib/public-content";

const description = "Verified workflow automation and AI systems by Artkin Carreon.";

export const metadata: Metadata = {
  title: "Work",
  description,
  alternates: { canonical: "/work" },
  openGraph: {
    type: "website",
    title: "Work | Artkin Carreon",
    description,
    url: "/work",
    images: [{ url: "/artkin-hero.webp", width: 1024, height: 1024, alt: "Artkin Carreon" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Work | Artkin Carreon",
    description,
    images: ["/artkin-hero.webp"],
  },
};

function publicationDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}

export default async function WorkPage() {
  const published = await getPublishedProjects();
  return (
    <div className="content-canvas">
      <header className="max-w-3xl py-16 md:py-24">
        <p className="mono-meta accent">[ WORK_INDEX ]</p>
        <h1 className="mt-5 text-5xl font-semibold tracking-tight md:text-7xl">Systems, not screenshots.</h1>
        <p className="mt-6 text-lg leading-8 ink-soft">Each record contains reviewed documentation about the process, implementation, and available evidence.</p>
      </header>
      <SectionHeader index="01" title="Published case studies" meta={published.length.toString().padStart(2, "0") + " PUBLIC RECORDS"} />
      {published.length ? (
        <div className="mt-8 space-y-6">
          {published.map((project, index) => (
            <article key={project.slug} className="module grid gap-8 p-8 md:grid-cols-[100px_1fr_180px_auto] md:items-start">
              <span className="mono-meta accent">{String(index + 1).padStart(2, "0")}</span>
              <div className="min-w-0 break-words"><h3 className="text-2xl font-medium">{project.title}</h3><p className="mt-3 leading-7 ink-soft">{project.excerpt}</p></div>
              <div><span className="mono-label muted">Published</span><time className="mt-3 block text-sm leading-6" dateTime={project.publishedAt}>{publicationDate(project.publishedAt)}</time></div>
              <Link href={"/work/" + project.slug} className="button-secondary max-w-full break-words text-center" aria-label={`Open ${project.title}`}>Open record</Link>
            </article>
          ))}
        </div>
      ) : (
        <div className="module mt-8 p-8 md:p-12">
          <p className="mono-meta accent">PUBLICATION_STATUS / HOLD</p>
          <h2 className="mt-6 text-3xl font-medium">No unverified claims.</h2>
          <p className="mt-4 max-w-2xl leading-7 ink-soft">Published project documentation will appear here after review. Draft records remain private.</p>
          <Link href="/contact" className="button-primary mt-8">Discuss a workflow</Link>
        </div>
      )}
      <section className="section-space">
        <SectionHeader index="02" title="Documentation can include" />
        <div className="mt-8 grid gap-px border border-[var(--line)] bg-[var(--line)] md:grid-cols-2">
          {["Process context and goals", "Workflow and implementation", "Images and architecture", "Results and reflection"].map((item, index) => (
            <div key={item} className="surface p-8"><span className="mono-meta accent">0{index + 1}</span><h3 className="mt-6 text-xl font-medium">{item}</h3></div>
          ))}
        </div>
      </section>
    </div>
  );
}
