import type { Metadata } from "next";
import { SectionHeader } from "@/components/section-header";
import { credentials } from "@/lib/content";

export const metadata: Metadata = { title: "Credentials", description: "Verified credentials connected to applied project evidence." };

export default function CredentialsPage() {
  return (
    <div className="content-canvas">
      <header className="max-w-3xl py-16 md:py-24"><p className="mono-meta accent">[ CREDENTIAL_REGISTRY ]</p><h1 className="mt-5 text-5xl font-semibold tracking-tight md:text-7xl">Supporting evidence, not decoration.</h1><p className="mt-6 text-lg leading-8 ink-soft">Credentials appear only when the issuer, date, verification evidence, and practical application are confirmed.</p></header>
      <SectionHeader index="01" title="Verified credentials" meta={credentials.length.toString().padStart(2, "0") + " VERIFIED RECORDS"} />
      {credentials.length ? <div className="mt-8 grid gap-4 md:grid-cols-2">{credentials.map((credential) => <article className="module p-8" key={credential.name}><span className="mono-label accent">{credential.issuer}</span><h2 className="mt-6 text-2xl font-medium">{credential.name}</h2><p className="mono-meta muted mt-3">ISSUED {credential.date}</p><a href={credential.verificationUrl} className="button-secondary mt-8" target="_blank" rel="noreferrer">Verify credential</a></article>)}</div> : <div className="module mt-8 p-10"><p className="mono-meta accent">REGISTRY_STATUS / AWAITING EVIDENCE</p><p className="mt-5 max-w-2xl leading-7 ink-soft">No sample certificates from the reference design were copied. Artkin&apos;s verified credentials will be added through the admin system.</p></div>}
    </div>
  );
}
