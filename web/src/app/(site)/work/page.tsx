import type { Metadata } from "next";
import Link from "next/link";
import { AnimatedHeading } from "@/components/animated-heading";
import { BackButton } from "@/components/back-button";
import { SectionHeader } from "@/components/section-header";
import { getPublishedProjects } from "@/lib/public-content";

const title = "AI Automation Projects and Case Studies";
const description = "Review published automation case studies by Artkin Carreon, with clear project summaries, implementation details, and available evidence.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/work" },
  openGraph: {
    type: "website",
    title,
    description,
    url: "/work",
    images: [{ url: "/artkin-hero.webp", width: 1024, height: 1024, alt: "Artkin Carreon" }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/artkin-hero.webp"],
  },
};

function monthYear(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}

export default async function WorkPage() {
  const published = await getPublishedProjects();
  return (
    <div className="content-canvas">
      <BackButton />
      <header className="max-w-3xl pb-12 md:pb-16" data-reveal="page-header">
        <p className="mono-meta accent">[ AUTOMATION_WORK_INDEX ]</p>
        <AnimatedHeading className="public-display mt-5" text="Automation systems, documented clearly." />
        <p className="public-lead mt-6">See how each system was planned, connected, and tested, with the available evidence and tradeoffs documented.</p>
      </header>
      <SectionHeader
        index="01"
        title="Published case studies"
        meta={`${published.length.toString().padStart(2, "0")} PUBLIC RECORDS`}
      />
      {published.length ? (
        <div className="mt-8 grid grid-cols-2 gap-3" data-phone-layout="project-grid" data-project-index-grid>
          {published.map((project) => (
            <article className="min-w-0" key={project.slug} data-reveal="record">
              <Link
                href={"/work/" + project.slug}
                className="project-card-surface module public-record-link flex h-full min-h-[196px] min-w-0 flex-col rounded-[16px] p-4 sm:min-h-[216px] sm:p-6"
                data-project-index-card
                aria-label={project.title}
              >
                <h3 className="public-card-title break-words">{project.title}</h3>
                <p className="public-body mt-3 line-clamp-4 break-words">{project.excerpt}</p>
                <p className="public-body muted mt-auto pt-6">
                  <time dateTime={project.publishedAt}>{monthYear(project.publishedAt)}</time>
                </p>
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <div className="module mt-8 p-8 md:p-12" data-reveal>
          <p className="mono-meta accent">CASE_STUDY_INDEX / 000</p>
          <h2 className="public-section-title mt-6">Case studies are being prepared.</h2>
          <p className="public-body mt-4 max-w-2xl">Reviewed project stories will appear here as they become available. You can still get in touch to discuss a workflow.</p>
          <Link href="/contact" className="button-primary mt-8">Discuss a workflow</Link>
        </div>
      )}
    </div>
  );
}
