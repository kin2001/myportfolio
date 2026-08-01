import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProjectDocument } from "@/components/project-document";
import { getSiteUrl } from "@/lib/env";
import {
  getPublishedProject,
  getPublishedProjects,
  publicAssetUrl,
} from "@/lib/public-content";

export const dynamicParams = false;

export async function generateStaticParams() {
  return (await getPublishedProjects()).map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const project = await getPublishedProject(slug);
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

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = await getPublishedProject(slug);
  if (!project) notFound();
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
    "@type": "CreativeWork",
    name: project.title,
    description: project.excerpt,
    url: `${siteUrl}/work/${project.slug}`,
    datePublished: project.publishedAt,
    author: { "@id": `${siteUrl}/#person` },
    image: coverUrl ?? `${siteUrl}/artkin-hero.webp`,
  };

  return (
    <article className="content-canvas">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replaceAll("<", "\\u003c") }}
      />
      <header className="max-w-4xl py-16 md:py-24">
        <p className="mono-meta accent">[ CASE_STUDY / {project.slug.toUpperCase()} ]</p>
        <h1 className="mt-6 text-5xl font-semibold tracking-tight md:text-7xl">{project.title}</h1>
        <p className="mt-6 max-w-3xl text-xl leading-8 ink-soft">{project.excerpt}</p>
      </header>

      {coverUrl && project.cover?.width && project.cover.height ? (
        <figure className="border-t border-[var(--line)] py-12">
          <img
            src={coverUrl}
            alt={project.cover.alt ?? ""}
            width={project.cover.width}
            height={project.cover.height}
            className="h-auto w-full object-cover"
          />
        </figure>
      ) : null}

      <ProjectDocument blocks={project.document} assets={renderedAssets} />

      {project.links.length ? (
        <section className="border-t border-[var(--line)] py-12">
          <h2 className="mono-label tracking-[.2em]">Project links</h2>
          <div className="mt-6 flex flex-wrap gap-4">
            {project.links.map((link) => (
              <a key={link.id} href={link.url} className="button-secondary" target="_blank" rel="noreferrer">
                {link.label}<span className="sr-only"> (opens in a new tab)</span>
              </a>
            ))}
          </div>
        </section>
      ) : null}

      <div className="border-t border-[var(--line)] py-12">
        <Link href="/work" className="button-secondary">Back to projects</Link>
      </div>
    </article>
  );
}
