import type { Metadata } from "next";
import Link from "next/link";
import { AnimatedHeading } from "@/components/animated-heading";
import { BackButton } from "@/components/back-button";
import { CredentialCard } from "@/components/credential-card";
import { SectionHeader } from "@/components/section-header";
import { getPublishedCredentials } from "@/lib/public-content";

const description = "Published credentials from Artkin Carreon, with issuer details, dates, and links to applied project work where available.";

export const metadata: Metadata = {
  title: "Credentials",
  description,
  alternates: { canonical: "/credentials" },
  openGraph: {
    type: "website",
    title: "Credentials | Artkin Carreon",
    description,
    url: "/credentials",
    images: [{ url: "/artkin-hero.webp", width: 1024, height: 1024, alt: "Artkin Carreon" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Credentials | Artkin Carreon",
    description,
    images: ["/artkin-hero.webp"],
  },
};

export default async function CredentialsPage() {
  const credentials = await getPublishedCredentials();

  return (
    <div className="content-canvas">
      <BackButton />
      <header className="max-w-3xl pb-12 md:pb-16" data-reveal="page-header">
        <p className="mono-meta accent">[ CREDENTIAL_REGISTRY ]</p>
        <AnimatedHeading className="public-display mt-5" text="Credentials that support the work." />
        <p className="public-lead mt-6">Review published credentials with issuer details, dates, and links to applied projects when available.</p>
      </header>

      <SectionHeader
        index="01"
        title="Published credentials"
        meta={`${credentials.length.toString().padStart(2, "0")} PUBLIC RECORDS`}
      />

      {credentials.length ? (
        <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-3" data-phone-layout="card-grid" data-credential-index-grid>
          {credentials.map((credential) => (
            <article className="min-w-0" data-reveal="record" key={credential.id}>
              <CredentialCard
                credential={credential}
                ariaLabel={`View credential: ${credential.name}`}
              />
            </article>
          ))}
        </div>
      ) : (
        <div className="module mt-8 p-8 md:p-12" data-reveal>
          <p className="mono-meta accent">CREDENTIAL_INDEX / 000</p>
          <h3 className="public-section-title mt-6">Published credentials will appear here.</h3>
          <p className="public-body mt-4 max-w-2xl">There are no public credential records yet. Explore the current case studies to see available project evidence.</p>
          <Link href="/work" className="button-primary mt-8">View case studies</Link>
        </div>
      )}
    </div>
  );
}
