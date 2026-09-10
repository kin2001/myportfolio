import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AnimatedHeading } from "@/components/animated-heading";
import { BackButton } from "@/components/back-button";
import { CredentialCard } from "@/components/credential-card";
import { ProjectDocument } from "@/components/project-document";
import { getSiteUrl } from "@/lib/env";
import {
  getPublishedCredentials,
  getPublishedProjects,
  publicAssetUrl,
} from "@/lib/public-content";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const project = (await getPublishedProjects()).find((item) => item.slug === slug);
  if (!project) return { title: "Project not found" };

  const cover = project.cover;
  const coverUrl = cover && publicAssetUrl(cover.objectKey);
  const path = `/work/${project.slug}`;
  const image = coverUrl
    ? {
        url: coverUrl,
        ...(cover.width ? { width: cover.width } : {}),
        ...(cover.height ? { height: cover.height } : {}),
        alt: cover.alt ?? "",
      }
    : { url: "/artkin-hero.webp", width: 1024, height: 1024, alt: "Artkin Carreon" };
  return {
    title: project.title,
    description: project.excerpt,
    alternates: { canonical: path },
    openGraph: {
      type: "article",
      title: `${project.title} | Artkin Carreon`,
      description: project.excerpt,
      url: path,
      publishedTime: project.publishedAt,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: `${project.title} | Artkin Carreon`,
      description: project.excerpt,
      images: [image.url],
    },
  };
}

function date(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [projects, credentials] = await Promise.all([
    getPublishedProjects(),
    getPublishedCredentials(),
  ]);
  const projectIndex = projects.findIndex((item) => item.slug === slug);
  const project = projectIndex >= 0 ? projects[projectIndex] : null;
  if (!project) notFound();
  const previousProject = projects[projectIndex - 1] ?? null;
  const nextProject = projects[projectIndex + 1] ?? null;
  const relatedCredentials = credentials.filter(
    (credential) => credential.relatedProjectId === project.id,
  );
  const siteUrl = getSiteUrl();
  const coverUrl = project.cover && publicAssetUrl(project.cover.objectKey);
  const renderedAssets = Object.fromEntries(
    Object.entries(project.assetManifest).flatMap(([assetId, asset]) => {
      const url = publicAssetUrl(asset.objectKey);
      return url && asset.width && asset.height
        ? [[assetId, { url, width: asset.width, height: asset.height }]]
        : [];
    }),
  );
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CreativeWork",
        name: project.title,
        description: project.excerpt,
        url: `${siteUrl}/work/${project.slug}`,
        datePublished: project.publishedAt,
        author: { "@id": `${siteUrl}/#person` },
        image: coverUrl ?? `${siteUrl}/artkin-hero.webp`,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Projects",
            item: `${siteUrl}/work`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: project.title,
            item: `${siteUrl}/work/${project.slug}`,
          },
        ],
      },
    ],
  };

  return (
    <article className="content-canvas detail-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replaceAll("<", "\\u003c") }}
      />
      <BackButton />
      <header className="border-b border-[var(--line)] pb-10 md:pb-16" data-reveal="page-header">
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-2 mono-meta ink-soft">
            <li><Link href="/work" className="hero-link">Projects</Link></li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="min-w-0 truncate">{project.title}</li>
          </ol>
        </nav>
        <div className="detail-project-intro mt-8 grid gap-8" data-phone-layout="project-hero">
          <div className="max-w-4xl">
            <p className="mono-meta accent">[ PUBLISHED_CASE_STUDY ]</p>
            <AnimatedHeading className="public-display mt-5" text={project.title} />
            <p className="public-lead mt-6 max-w-[65ch]">{project.excerpt}</p>
          </div>
          <dl className="detail-facts grid grid-cols-2 gap-5 border border-[var(--line)] p-5 mono-meta ink-soft" data-phone-compact="project-meta">
            <div>
              <dt className="muted">Status</dt>
              <dd className="mt-1 text-[var(--ink)]">Published</dd>
            </div>
            <div>
              <dt className="muted">Published</dt>
              <dd className="mt-1 text-[var(--ink)]"><time dateTime={project.publishedAt}>{date(project.publishedAt)}</time></dd>
            </div>
          </dl>
        </div>
      </header>

      {coverUrl && project.cover?.width && project.cover.height ? (
        <figure className="py-10 md:py-14" data-reveal="media">
          <div className="module overflow-hidden">
            <img
              src={coverUrl}
              alt={project.cover.alt ?? ""}
              width={project.cover.width}
              height={project.cover.height}
              className="mx-auto max-h-[680px] h-auto w-full object-contain"
            />
          </div>
        </figure>
      ) : null}

      <ProjectDocument blocks={project.document} assets={renderedAssets} />

      {relatedCredentials.length ? (
        <section className="border-t border-[var(--line)] py-12" data-reveal="record">
          <div className="max-w-3xl">
            <h2 className="public-card-title">Related credentials</h2>
            <p className="public-body mt-3 max-w-[65ch]">
              Published credentials connected to this project.
            </p>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2" data-phone-layout="card-grid">
            {relatedCredentials.map((credential) => (
              <article className="min-w-0" key={credential.id}>
                <CredentialCard credential={credential} />
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {project.links.length ? (
        <section className="border-t border-[var(--line)] py-12" data-reveal="record">
          <h2 className="public-card-title">Related links</h2>
          <div className="mt-6 flex flex-wrap gap-4">
            {project.links.map((link) => (
              <a key={link.id} href={link.url} className="button-secondary" target="_blank" rel="noreferrer">
                {link.label}<span className="sr-only"> (opens in a new tab)</span>
              </a>
            ))}
          </div>
        </section>
      ) : null}

      <footer className="border-t border-[var(--line)] py-12" data-reveal="actions">
        <div className="detail-inquiry module p-6 md:flex md:items-center md:justify-between md:gap-8 md:p-8" data-phone-layout="action-row">
          <div>
            <h2 className="public-card-title">Discuss a similar automation</h2>
            <p className="public-body mt-3 max-w-[55ch]">
              Share the current process, the tools involved, and where work slows down.
            </p>
          </div>
          <Link href="/contact" className="button-primary mt-6 w-full md:mt-0 md:w-auto">
            Start an inquiry
          </Link>
        </div>

        <nav aria-label="Project navigation" className="mt-8 grid gap-4 sm:grid-cols-2" data-phone-layout="nav-pair">
          {previousProject ? (
            <Link href={`/work/${previousProject.slug}`} className="button-secondary min-w-0 justify-start text-left">
              <span aria-hidden="true">←</span>
              <span className="truncate">Previous: {previousProject.title}</span>
            </Link>
          ) : <span aria-hidden="true" />}
          {nextProject ? (
            <Link href={`/work/${nextProject.slug}`} className="button-secondary min-w-0 justify-end text-right sm:col-start-2">
              <span className="truncate">Next: {nextProject.title}</span>
              <span aria-hidden="true">→</span>
            </Link>
          ) : null}
        </nav>

      </footer>
    </article>
  );
}
