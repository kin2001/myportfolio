import type { Metadata } from "next";
import Link from "next/link";
import { AnimatedHeading } from "@/components/animated-heading";
import { BackButton } from "@/components/back-button";
import { SectionHeader } from "@/components/section-header";

export const metadata: Metadata = {
  title: "Privacy Terms and Conditions",
  description: "How portfolio inquiry data is used, processed, stored, and deleted.",
  alternates: { canonical: "/privacy" },
};

const sections = [
  { id: "data-collected", title: "Data collected", body: "The inquiry and booking forms may collect your name, email address, phone number, optional company, project details, selected appointment time, consent choice, and submission time." },
  { id: "why-it-is-used", title: "Why it is used", body: "Artkin uses this information to understand your request, contact you, ask follow-up questions, arrange a project meeting, and maintain the related business conversation." },
  { id: "where-it-goes", title: "Where it goes", body: "Inquiry submissions are sent to the private portfolio API and stored in Supabase. Booking details are sent to HighLevel to create the contact and appointment and deliver the related notifications. Cloudflare Turnstile processes the form security token. A redacted inquiry message may be sent to the configured NVIDIA AI service, and Resend processes the approved email reply. Hosting providers may process the network logs required to operate the site." },
  { id: "ai-and-human-review", title: "AI and human review", body: "Names, email addresses, company names, and obvious URLs are removed before AI analysis. AI may help summarize the request, classify intent, or prepare a draft. Artkin reviews every reply before it is sent." },
  { id: "retention", title: "Retention", body: "Inquiries are retained for up to 90 days by default. They may be kept longer when an active project conversation requires it, then deleted when no longer needed." },
  { id: "your-choices", title: "Your choices", body: "You may request access, correction, or deletion through the Contact page. Inquiry data is not sold, published, or used for unrelated marketing, and no AI-generated reply is sent automatically." },
] as const;

const summary = [
  ["Scope", "Contact inquiries"],
  ["Purpose", "Replies and project meetings"],
  ["Retention", "Up to 90 days by default"],
  ["AI", "Redacted and human reviewed"],
] as const;

export default function PrivacyPage() {
  return (
    <div className="content-canvas">
      <BackButton />
      <header className="grid gap-10 pb-12 md:pb-16 xl:grid-cols-[minmax(0,3fr)_minmax(280px,2fr)] xl:items-end" data-phone-layout="privacy-hero" data-reveal="page-header">
        <div className="min-w-0">
          <p className="mono-meta accent">[ DATA_HANDLING_PROTOCOL ]</p>
          <AnimatedHeading className="public-display mt-5 max-w-3xl" text="Privacy Terms and Conditions." />
          <p className="public-lead mt-6 max-w-2xl">How inquiry data is collected, processed, retained, and removed.</p>
        </div>

        <aside className="module p-6 sm:p-8" data-phone-compact="privacy-summary" aria-labelledby="privacy-summary-title">
          <p className="mono-label accent">POLICY SUMMARY</p>
          <h2 id="privacy-summary-title" className="public-card-title mt-4">At a glance</h2>
          <dl className="mt-6 divide-y divide-[var(--line)] border-y border-[var(--line)]">
            {summary.map(([term, detail]) => (
              <div className="grid gap-2 py-4 sm:grid-cols-[100px_minmax(0,1fr)]" data-phone-layout="summary-row" key={term}>
                <dt className="mono-label muted">{term}</dt>
                <dd className="public-body">{detail}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </header>

      <div className="grid min-w-0 gap-8 xl:grid-cols-[220px_minmax(0,1fr)]" data-phone-layout="privacy-body">
        <nav className="module self-start p-4 xl:sticky xl:top-8" data-phone-compact="privacy-nav" data-reveal aria-labelledby="privacy-toc-title">
          <h2 id="privacy-toc-title" className="mono-label px-2 pb-3">On this page</h2>
          <ol>
            {sections.map(({ id, title }, index) => (
              <li className="border-t border-[var(--line)]" key={id}>
                <a className="public-index-link flex min-h-11 items-center gap-3 px-2 py-3 text-sm" href={`#${id}`}>
                  <span className="mono-meta accent">0{index + 1}</span>
                  <span>{title}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="min-w-0">
          <SectionHeader index="01" title="Privacy details" meta="06 SECTIONS" />
          <div className="mt-8 space-y-4">
            {sections.map(({ id, title, body }, index) => (
              <section id={id} className="module scroll-mt-24 p-6 sm:p-8" data-phone-compact="privacy-section" data-reveal="record" aria-labelledby={`${id}-title`} key={id}>
                <div className="grid min-w-0 gap-4 sm:grid-cols-[48px_minmax(0,1fr)]" data-phone-layout="indexed-copy">
                  <span className="mono-meta accent" aria-hidden="true">0{index + 1}</span>
                  <div className="min-w-0">
                    <h3 id={`${id}-title`} className="public-card-title">{title}</h3>
                    <p className="public-body mt-4">{body}</p>
                  </div>
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>

      <section className="section-space border-t border-[var(--line)] py-12 md:py-16" data-reveal="actions">
        <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-end" data-phone-layout="action-row">
          <div className="max-w-3xl">
            <p className="mono-label accent">[ DATA_REQUEST ]</p>
            <h2 className="public-section-title mt-5">Questions about your inquiry data?</h2>
            <p className="public-lead mt-5">Use the Contact page to request access, correction, or deletion.</p>
          </div>
          <Link href="/contact" className="button-primary w-full whitespace-nowrap sm:w-auto">Contact Artkin</Link>
        </div>
      </section>
    </div>
  );
}
