import type { Metadata } from "next";
import Link from "next/link";
import { AnimatedHeading } from "@/components/animated-heading";
import { ApproachSection } from "@/components/approach-section";
import { CredentialCard } from "@/components/credential-card";
import { Icon } from "@/components/icons";
import { ThemePortrait } from "@/components/theme-portrait";
import { profile } from "@/lib/content";
import { getSiteUrl } from "@/lib/env";
import { getPublishedCredentials, getPublishedProjects } from "@/lib/public-content";
import styles from "./home.module.css";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

function monthYear(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}

function ActionLabel({ children }: { children: string }) {
  return (
    <>
      <span className={styles.actionLabel}>{children} <Icon name="arrow" className="h-4 w-4" /></span>
      <span aria-hidden="true" className={`${styles.actionLabel} ${styles.ink}`}>
        {children} <Icon name="arrow" className="h-4 w-4" />
      </span>
    </>
  );
}

export default async function HomePage() {
  const [published, credentials] = await Promise.all([
    getPublishedProjects(),
    getPublishedCredentials(),
  ]);
  const siteUrl = getSiteUrl();
  const personSchema = {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": `${siteUrl}/#person`,
    name: "Artkin Carreon",
    url: siteUrl,
    jobTitle: profile.role,
    sameAs: [
      "https://github.com/kin2001",
      "https://www.linkedin.com/in/artkin-carreon-8809b8421",
    ],
  };
  const systemFacts = [
    ["04", "Delivery Phases"],
    ["03", "Core Services"],
    [String(published.length).padStart(2, "0"), "Case Studies"],
    ["OPEN", "Freelance Work"],
  ] as const;
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personSchema).replaceAll("<", "\\u003c") }}
      />
    <div className={`${styles.home} mx-auto max-w-[1100px] space-y-10 px-4 py-8 sm:px-6 md:space-y-14 md:px-8 md:py-12`}>
      <section data-reveal="hero" className={`${styles.hero} grid grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] items-center gap-3 sm:gap-6 md:gap-12`} aria-labelledby="hero-title">
        <div className="order-1 min-w-0 space-y-4 sm:space-y-6 md:space-y-8">
          <div className="space-y-4">
            <p className={`${styles.init} mono-meta uppercase tracking-[.2em] text-[var(--accent)]`}>[ AI_AUTOMATION / GOHIGHLEVEL ]</p>
            <AnimatedHeading
              id="hero-title"
              className="public-display-hero text-[var(--hero-ink)]"
              text={["AI Automation", "& GoHighLevel", "Specialist"]}
            />
            <p className="public-lead max-w-xl">{profile.shortPositioning}</p>
          </div>
          <div className={`${styles.links} flex flex-wrap gap-x-8 gap-y-2`}>
            <Link href="/contact" className="hero-link">Email <Icon name="arrow" /></Link>
            <a href="https://github.com/kin2001" className="hero-link" target="_blank" rel="noreferrer">GitHub <Icon name="arrow" /><span className="sr-only"> (opens in a new tab)</span></a>
            <a href="https://www.linkedin.com/in/artkin-carreon-8809b8421" className="hero-link" target="_blank" rel="noreferrer">LinkedIn <Icon name="arrow" /><span className="sr-only"> (opens in a new tab)</span></a>
          </div>
        </div>
        <div className={`${styles.portrait} order-2 mx-auto flex w-full max-w-[150px] justify-center sm:max-w-[240px] md:max-w-md`}>
          <ThemePortrait source="hero" alt="Portrait of Artkin Carreon" sizes="(max-width: 639px) 150px, (max-width: 767px) 240px, (max-width: 1023px) 360px, 448px" />
          <svg className={styles.circuit} viewBox="0 0 1024 1024" aria-hidden="true" focusable="false">
            <path pathLength="1" vectorEffect="non-scaling-stroke" d="M40 813H110Q118 813 118 805V684H245" />
            <path pathLength="1" vectorEffect="non-scaling-stroke" d="M204 553H320Q328 553 328 561V589Q328 597 336 597H371" />
            <path pathLength="1" vectorEffect="non-scaling-stroke" d="M704 510H827V677" />
            <circle cx="40" cy="813" r="3" /><circle cx="245" cy="684" r="3" />
            <circle cx="204" cy="553" r="3" /><circle cx="371" cy="597" r="3" />
            <circle cx="704" cy="510" r="3" /><circle cx="827" cy="677" r="3" />
          </svg>
        </div>
      </section>

      <section data-reveal data-home-surface="neutral" className={`${styles.factBand} ${styles.revealGroup} grid grid-cols-4 gap-x-2 border-y border-[var(--line)] py-8 sm:gap-x-4 md:gap-x-8`} aria-label="Portfolio system facts">
        {systemFacts.map(([value, label], index) => <div key={label} className={`flex min-w-0 flex-col gap-1 ${index < 3 ? "border-r border-[var(--line)]" : ""} ${index ? "pl-2 sm:pl-4 md:pl-8" : ""}`}><span className="text-2xl font-semibold leading-tight tracking-tight">{value}</span><span className="mono-label muted">{label}</span></div>)}
      </section>

      <section className="space-y-8 md:space-y-10" id="projects">
        <div data-reveal="rule" className={`${styles.sectionHeading} flex items-center justify-between gap-3 border-b border-[var(--line)] pb-4`}><h2 className="mono-label tracking-[.2em]">01 — Projects</h2><Link href="/work" className="hero-link">View all {String(published.length).padStart(2, "0")} projects <Icon name="arrow" /></Link></div>
        {published.length ? (
          <div className={`${styles.recordGrid} grid gap-3 ${published.length > 1 ? "grid-cols-2" : ""} ${published.length > 2 ? "xl:grid-cols-3" : ""}`} data-home-project-grid>
            {published.slice(0, 3).map((project) => (
              <article key={project.slug} data-reveal="record" className="min-w-0">
                <Link
                  href={`/work/${project.slug}`}
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
        ) : <div data-reveal className="grid min-h-56 min-w-0 gap-6 border border-[var(--line)] bg-[var(--paper-pure)] p-6 sm:p-8 md:grid-cols-[180px_1fr] md:gap-8 md:p-10"><p className="mono-meta break-words text-[var(--accent)]">PROJECT_REGISTRY / 000</p><div className="min-w-0"><h3 className="public-card-title">Case studies are being prepared.</h3><p className="public-body mt-4 max-w-2xl">Reviewed project stories will appear here as they become available.</p></div></div>}
      </section>

      <section className="space-y-8 md:space-y-10" data-home-surface="plain" id="credentials">
        <div data-reveal="rule" className={`${styles.sectionHeading} flex items-center justify-between gap-3 border-b border-[var(--line)] pb-4`}><h2 className="mono-label tracking-[.2em]">02 — Credentials</h2>{credentials.length ? <Link href="/credentials" className="hero-link">View all {String(credentials.length).padStart(2, "0")} credentials <Icon name="arrow" /></Link> : null}</div>
        {credentials.length ? (
          <div className={`${styles.recordGrid} grid gap-3 ${credentials.length > 1 ? "grid-cols-2" : ""} ${credentials.length > 2 ? "xl:grid-cols-3" : ""}`} data-home-credential-grid>
            {credentials.slice(0, 3).map((credential) => (
              <article data-reveal="record" className="min-w-0" key={credential.id}>
                <CredentialCard credential={credential} />
              </article>
            ))}
          </div>
        ) : (
          <div data-reveal className="border border-[var(--line)] p-6"><p className="public-body">Credential records will appear here as they become available.</p></div>
        )}
      </section>

      <ApproachSection detailsHref="/about" index="03" />

      <section data-reveal="cta" data-home-surface="tint" className={`${styles.sectionBand} ${styles.closingCta} flex flex-col items-center gap-8 pb-8 pt-12 text-center md:gap-10 md:pb-10 md:pt-16`} id="contact"><div className={`${styles.ctaCopy} max-w-2xl space-y-4`}><p className={`${styles.ctaLabel} mono-label tracking-[.3em] text-[var(--accent)]`}>04 — Project Inquiry</p><h2 className={`${styles.ctaTitle} public-section-title mx-auto`}>Need a cleaner way to manage leads, follow-up, or internal work?</h2></div><Link href="/contact" className={`${styles.action} ${styles.ctaAction} button-primary`}><ActionLabel>Start a project</ActionLabel></Link></section>

      <footer className="flex flex-col items-center justify-between gap-8 border-t border-[var(--line)] py-12 text-center md:flex-row md:text-left"><div><p className="mono-label">AI AUTOMATION / GOHIGHLEVEL</p><p className="mono-meta muted mt-4">© 2026 ARTKIN CARREON / ALL RIGHTS RESERVED</p></div><div className="flex flex-wrap justify-center gap-6 sm:gap-8"><Link className="mono-meta muted underline" href="/privacy">Privacy Policy</Link><Link className="mono-meta muted underline" href="/contact">Project inquiry</Link></div></footer>
    </div>
    </>
  );
}
