import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
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
  const evidenceUrl =
    credential.evidenceVisibility === "public" && credential.evidence?.mimeType.startsWith("image/")
      ? publicAssetUrl(credential.evidence.objectKey)
      : null;
  const image = evidenceUrl ?? "/artkin-hero.webp";
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
      images: [{
        url: image,
        ...(evidenceUrl && credential.evidence?.width ? { width: credential.evidence.width } : { width: 1024 }),
        ...(evidenceUrl && credential.evidence?.height ? { height: credential.evidence.height } : { height: 1024 }),
        alt: evidenceUrl ? credential.evidence?.alt ?? "" : "Artkin Carreon",
      }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${credential.name} | Artkin Carreon`,
      description,
      images: [image],
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
  const evidenceIsImage =
    evidenceUrl &&
    credential.evidence?.mimeType.startsWith("image/") &&
    credential.evidence.width &&
    credential.evidence.height;
  const relatedProject = credential.relatedProjectId
    ? (await getPublishedProjects()).find(({ id }) => id === credential.relatedProjectId)
    : null;
  const siteUrl = getSiteUrl();
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "EducationalOccupationalCredential",
    name: credential.name,
    description: `${credential.name}, issued by ${credential.issuer}.`,
    url: `${siteUrl}/credentials/${credential.slug}`,
    dateCreated: credential.issueDate,
    recognizedBy: { "@type": "Organization", name: credential.issuer },
    credentialCategory: "Certificate",
  };

  return (
    <article className="content-canvas">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replaceAll("<", "\\u003c") }}
      />
      <header className="max-w-4xl py-16 md:py-24">
        <p className="mono-meta accent">[ VERIFIED_CREDENTIAL ]</p>
        <h1 className="mt-5 text-5xl font-semibold tracking-tight md:text-7xl">{credential.name}</h1>
        <p className="mt-6 text-lg leading-8 ink-soft">{credential.issuer}</p>
      </header>

      <div className="grid gap-8 border-t border-[var(--line)] py-10 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div>
          {evidenceIsImage && credential.evidence ? (
            <img
              src={evidenceUrl}
              alt={credential.evidence.alt ?? ""}
              width={credential.evidence.width}
              height={credential.evidence.height}
              className="h-auto w-full border border-[var(--line)] object-contain"
            />
          ) : evidenceUrl ? (
            <a className="button-secondary" href={evidenceUrl} target="_blank" rel="noreferrer">
              View published evidence<span className="sr-only"> (opens in a new tab)</span>
            </a>
          ) : (
            <p className="ink-soft">Verification evidence is kept private.</p>
          )}
        </div>

        <dl className="module space-y-6 p-6">
          <div><dt className="mono-label muted">Issued</dt><dd className="mt-2">{date(credential.issueDate)}</dd></div>
          {credential.expiryDate ? <div><dt className="mono-label muted">Expires</dt><dd className="mt-2">{date(credential.expiryDate)}</dd></div> : null}
          {credential.skills.length ? <div><dt className="mono-label muted">Skills</dt><dd className="mt-2">{credential.skills.join(", ")}</dd></div> : null}
          {relatedProject ? <div><dt className="mono-label muted">Related project</dt><dd className="mt-2"><Link className="text-link" href={`/work/${relatedProject.slug}`}>{relatedProject.title}</Link></dd></div> : null}
          {credential.verificationUrl ? <div><a className="button-secondary w-full" href={credential.verificationUrl} target="_blank" rel="noreferrer">Verify with issuer<span className="sr-only"> (opens in a new tab)</span></a></div> : null}
        </dl>
      </div>
    </article>
  );
}
