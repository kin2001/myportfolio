import type { Metadata } from "next";
import Link from "next/link";
import { SectionHeader } from "@/components/section-header";
import { getPublishedCredentials, publicAssetUrl } from "@/lib/public-content";

const description = "Verified credentials connected to applied project evidence.";

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

function date(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}

export default async function CredentialsPage() {
  const credentials = await getPublishedCredentials();
  return (
    <div className="content-canvas">
      <header className="max-w-3xl py-16 md:py-24"><p className="mono-meta accent">[ CREDENTIAL_REGISTRY ]</p><h1 className="mt-5 text-5xl font-semibold tracking-tight md:text-7xl">Supporting evidence, not decoration.</h1><p className="mt-6 text-lg leading-8 ink-soft">Credentials appear only after their issuer, date, and verification evidence are confirmed.</p></header>
      <SectionHeader index="01" title="Verified credentials" meta={credentials.length.toString().padStart(2, "0") + " VERIFIED RECORDS"} />
      {credentials.length ? (
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {credentials.map((credential) => {
            const evidenceUrl = credential.evidenceVisibility === "public" && credential.evidence
              ? publicAssetUrl(credential.evidence.objectKey)
              : null;
            const publicImage = evidenceUrl && credential.evidence?.mimeType.startsWith("image/") && credential.evidence.width && credential.evidence.height;
            return (
              <article className="module flex min-w-0 flex-col break-words p-8" key={credential.id}>
                {publicImage && credential.evidence ? <img src={evidenceUrl} alt={credential.evidence.alt ?? ""} width={credential.evidence.width} height={credential.evidence.height} className="mb-8 h-auto w-full border border-[var(--line)] object-contain" loading="lazy" /> : null}
                <span className="mono-label accent">{credential.issuer}</span>
                <h3 className="mt-6 text-2xl font-medium">{credential.name}</h3>
                <p className="mono-meta muted mt-3">ISSUED <time dateTime={credential.issueDate}>{date(credential.issueDate)}</time>{credential.expiryDate ? <> / EXPIRES <time dateTime={credential.expiryDate}>{date(credential.expiryDate)}</time></> : null}</p>
                {credential.skills.length ? <ul className="mt-6 flex flex-wrap gap-2" aria-label="Skills demonstrated">{credential.skills.map((skill) => <li className="mono-meta surface-soft px-3 py-2" key={skill}>{skill}</li>)}</ul> : null}
                <div className="mt-auto flex flex-wrap gap-3 pt-8">
                  <Link href={`/credentials/${credential.slug}`} className="button-secondary max-w-full break-words text-center" aria-label={`Open ${credential.name}`}>Open record</Link>
                  {credential.verificationUrl ? <a href={credential.verificationUrl} className="button-secondary" target="_blank" rel="noreferrer">Verify credential<span className="sr-only"> (opens in a new tab)</span></a> : null}
                  {evidenceUrl ? <a href={evidenceUrl} className="button-secondary" target="_blank" rel="noreferrer">View evidence<span className="sr-only"> (opens in a new tab)</span></a> : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : <div className="module mt-8 p-10"><p className="mono-meta accent">REGISTRY_STATUS / AWAITING EVIDENCE</p><p className="mt-5 max-w-2xl leading-7 ink-soft">No sample certificates from the reference design were copied. Artkin&apos;s verified credentials will be added through the admin system.</p></div>}
    </div>
  );
}
