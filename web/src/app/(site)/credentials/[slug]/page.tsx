import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AnimatedHeading } from "@/components/animated-heading";
import { BackButton } from "@/components/back-button";
import { Icon } from "@/components/icons";
import { getSiteUrl } from "@/lib/env";
import {
  getPublishedCredential,
  getPublishedCredentials,
  getPublishedProjects,
  publicAssetUrl,
} from "@/lib/public-content";

type PageProps = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

function date(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));
}

export async function generateStaticParams() {
  return (await getPublishedCredentials()).map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const credential = await getPublishedCredential((await params).slug);
  if (!credential) return {};
  const description = `${credential.name}, issued by ${credential.issuer}.`;
  const path = `/credentials/${credential.slug}`;

  return {
    title: credential.name,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      title: `${credential.name} | Artkin Carreon`,
      description,
      url: path,
      images: [{ url: "/artkin-hero.webp", width: 1024, height: 1024, alt: "Artkin Carreon" }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${credential.name} | Artkin Carreon`,
      description,
      images: ["/artkin-hero.webp"],
    },
  };
}

export default async function CredentialPage({ params }: PageProps) {
  const credential = await getPublishedCredential((await params).slug);
  if (!credential) notFound();

  const evidenceUrl =
    credential.evidenceVisibility === "public" && credential.evidence
      ? publicAssetUrl(credential.evidence.objectKey)
      : null;
  const evidenceIsImage = Boolean(
    evidenceUrl &&
    credential.evidence?.mimeType.startsWith("image/") &&
    credential.evidence.width &&
    credential.evidence.height,
  );
  const evidenceIsPdf = Boolean(
    evidenceUrl && credential.evidence?.mimeType === "application/pdf",
  );
  const embeddedEvidenceUrl = evidenceIsPdf
    ? `${evidenceUrl}#view=FitH&toolbar=0&navpanes=0`
    : null;
  const evidenceLabel = evidenceIsImage
    ? "Public image"
    : evidenceIsPdf
      ? "Public PDF"
      : evidenceUrl
        ? "Public document"
        : "Not displayed";
  const relatedProject = credential.relatedProjectId
    ? (await getPublishedProjects()).find(({ id }) => id === credential.relatedProjectId)
    : null;
  const siteUrl = getSiteUrl();
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "EducationalOccupationalCredential",
        name: credential.name,
        description: `${credential.name}, issued by ${credential.issuer}.`,
        url: `${siteUrl}/credentials/${credential.slug}`,
        dateCreated: credential.issueDate,
        recognizedBy: { "@type": "Organization", name: credential.issuer },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Credentials",
            item: `${siteUrl}/credentials`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: credential.name,
            item: `${siteUrl}/credentials/${credential.slug}`,
          },
        ],
      },
    ],
  };

  return (
    <article className="content-canvas">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replaceAll("<", "\\u003c") }}
      />

      <BackButton />
      <nav aria-label="Breadcrumb">
        <ol className="mono-meta flex flex-wrap items-center gap-2">
          <li><Link className="text-link" href="/credentials">Credentials</Link></li>
          <li aria-hidden="true">/</li>
          <li className="muted" aria-current="page">{credential.name}</li>
        </ol>
      </nav>

      <header className="max-w-4xl pb-10 pt-6 md:pb-14 md:pt-8" data-reveal="page-header">
        <p className="mono-meta accent">[ PUBLISHED_CREDENTIAL ]</p>
        <AnimatedHeading className="public-display mt-5" text={credential.name} />

        <dl className={`module mt-8 grid gap-px bg-[var(--line)] ${credential.expiryDate ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3"}`} data-phone-layout={credential.expiryDate ? "facts-four" : "facts-three"}>
          <div className="min-w-0 bg-[var(--paper-pure)] p-5">
            <dt className="mono-label muted">Issuer</dt>
            <dd className="public-body mt-2">{credential.issuer}</dd>
          </div>
          <div className="bg-[var(--paper-pure)] p-5">
            <dt className="mono-label muted">Issued</dt>
            <dd className="public-body mt-2"><time dateTime={credential.issueDate}>{date(credential.issueDate)}</time></dd>
          </div>
          {credential.expiryDate ? (
            <div className="bg-[var(--paper-pure)] p-5">
              <dt className="mono-label muted">Expires</dt>
              <dd className="public-body mt-2"><time dateTime={credential.expiryDate}>{date(credential.expiryDate)}</time></dd>
            </div>
          ) : null}
          <div className="bg-[var(--paper-pure)] p-5">
            <dt className="mono-label muted">Evidence</dt>
            <dd className="public-body mt-2">{evidenceLabel}</dd>
          </div>
        </dl>
      </header>

      <section aria-labelledby="credential-evidence-heading" className="border-t border-[var(--line)] py-10 md:py-14" data-reveal="evidence">
        <div className="section-heading">
          <h2 id="credential-evidence-heading" className="public-card-title">Credential evidence</h2>
          {evidenceUrl ? (
            <a className="hero-link" href={evidenceUrl} target="_blank" rel="noreferrer">
              Open original <Icon name="arrow" /><span className="sr-only"> evidence (opens in a new tab)</span>
            </a>
          ) : null}
        </div>

        <div className="module mt-6 overflow-hidden">
          {evidenceIsImage && credential.evidence && evidenceUrl ? (
            <div className="flex min-h-80 items-center justify-center bg-[var(--paper-soft)] p-4 sm:p-8">
              <img
                src={evidenceUrl}
                alt={credential.evidence.alt ?? ""}
                width={credential.evidence.width ?? undefined}
                height={credential.evidence.height ?? undefined}
                className="h-auto max-h-[760px] w-full object-contain"
              />
            </div>
          ) : embeddedEvidenceUrl ? (
            <object
              aria-label={`${credential.name} evidence document`}
              className="block h-[300px] w-full bg-[var(--paper-soft)] sm:h-[68vh] sm:min-h-[520px] sm:max-h-[760px]"
              data={embeddedEvidenceUrl}
              type="application/pdf"
            >
              <div className="p-8 sm:p-12">
                <p className="public-body">This browser could not display the evidence document inline.</p>
                <a className="button-secondary mt-6" href={evidenceUrl ?? undefined} target="_blank" rel="noreferrer">
                  Open evidence document<span className="sr-only"> (opens in a new tab)</span>
                </a>
              </div>
            </object>
          ) : evidenceUrl ? (
            <div className="p-8 sm:p-12">
              <p className="public-body">This file type needs to be opened in its original viewer.</p>
              <a className="button-secondary mt-6" href={evidenceUrl} target="_blank" rel="noreferrer">
                Open evidence document<span className="sr-only"> (opens in a new tab)</span>
              </a>
            </div>
          ) : (
            <p className="public-body p-8 sm:p-12">Evidence is not publicly displayed.</p>
          )}
        </div>
      </section>

      {credential.skills.length || relatedProject ? (
        <section aria-labelledby="credential-record-heading" className="grid gap-8 border-t border-[var(--line)] py-10 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-14" data-phone-layout="credential-record" data-reveal="record">
          <div>
            <h2 id="credential-record-heading" className="public-card-title">Credential record</h2>
            <p className="public-body mt-3">Published skills and project connections attached to this record.</p>
          </div>

          <div className={`grid gap-8 ${relatedProject && credential.skills.length ? "sm:grid-cols-2" : ""}`} data-phone-layout={relatedProject && credential.skills.length ? "card-grid" : undefined}>
            {credential.skills.length ? (
              <div>
                <h3 className="mono-label muted">Skills demonstrated</h3>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {credential.skills.map((skill) => <li className="mono-meta surface-soft px-3 py-2" key={skill}>{skill}</li>)}
                </ul>
              </div>
            ) : null}
            {relatedProject ? (
              <div className="border-t border-[var(--line)] pt-6 sm:border-l sm:border-t-0 sm:pl-8 sm:pt-0">
                <h3 className="mono-label muted">Related project</h3>
                <Link className="hero-link mt-3" href={`/work/${relatedProject.slug}`}>{relatedProject.title} <Icon name="arrow" /></Link>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {credential.verificationUrl ? (
        <footer className="flex justify-end border-t border-[var(--line)] py-10" data-reveal="actions">
          <a
            className="button-primary text-center"
            href={credential.verificationUrl}
            target="_blank"
            rel="noreferrer"
          >
            Verify credential<span className="sr-only"> (opens in a new tab)</span>
          </a>
        </footer>
      ) : null}
    </article>
  );
}
