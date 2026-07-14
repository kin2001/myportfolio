import type { Metadata } from "next";
import Link from "next/link";
import { SectionHeader } from "@/components/section-header";

export const metadata: Metadata = {
  title: "Privacy Terms and Conditions",
  description: "How portfolio inquiry data is used, processed, stored, and deleted.",
  alternates: { canonical: "/privacy" },
};

const sections = [
  { id: "data-collected", title: "Data collected", body: "The inquiry form collects your name, email address, optional company, project type, message, consent choice, and submission time." },
  { id: "why-it-is-used", title: "Why it is used", body: "Artkin uses this information to understand your request, contact you, ask follow-up questions, arrange a project meeting, and maintain the related business conversation." },
  { id: "where-it-goes", title: "Where it goes", body: "Your submission is sent to the private portfolio API and stored in Supabase. Cloudflare Turnstile processes the form security token. A redacted message may be sent to the configured NVIDIA AI service, and Resend processes the approved email reply. Hosting providers may process the network logs required to operate the site." },
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
      <header className="grid gap-10 py-16 xl:grid-cols-[minmax(0,3fr)_minmax(280px,2fr)] xl:items-end xl:py-24">
        <div className="min-w-0">
          <p className="mono-meta accent">[ DATA_HANDLING_PROTOCOL ]</p>
          <h1 className="mt-5 max-w-3xl text-5xl font-semibold tracking-tight sm:text-6xl xl:text-7xl">Privacy Terms and Conditions.</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 ink-soft">What is collected, where it goes, and how you stay in control when you submit a portfolio inquiry.</p>
        </div>

        <aside className="module p-6 sm:p-8" aria-labelledby="privacy-summary-title">
          <p className="mono-label accent">POLICY SUMMARY</p>
          <h2 id="privacy-summary-title" className="mt-4 text-2xl font-medium">At a glance</h2>
          <dl className="mt-6 divide-y divide-[var(--line)] border-y border-[var(--line)]">
            {summary.map(([term, detail]) => (
              <div className="grid gap-2 py-4 sm:grid-cols-[100px_minmax(0,1fr)]" key={term}>
                <dt className="mono-label muted">{term}</dt>
                <dd className="text-sm leading-6">{detail}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </header>

      <div className="grid min-w-0 gap-8 xl:grid-cols-[220px_minmax(0,1fr)]">
        <nav className="module self-start p-4 xl:sticky xl:top-8" aria-labelledby="privacy-toc-title">
          <h2 id="privacy-toc-title" className="mono-label px-2 pb-3">On this page</h2>
          <ol>
            {sections.map(({ id, title }, index) => (
              <li className="border-t border-[var(--line)]" key={id}>
                <a className="flex min-h-11 items-center gap-3 px-2 py-3 text-sm transition-colors hover:text-[var(--accent)]" href={`#${id}`}>
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
              <section id={id} className="module scroll-mt-24 p-6 sm:p-8" aria-labelledby={`${id}-title`} key={id}>
                <div className="grid min-w-0 gap-4 sm:grid-cols-[48px_minmax(0,1fr)]">
                  <span className="mono-meta accent" aria-hidden="true">0{index + 1}</span>
                  <div className="min-w-0">
                    <h3 id={`${id}-title`} className="text-2xl font-medium">{title}</h3>
                    <p className="mt-4 leading-7 ink-soft">{body}</p>
                  </div>
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>

      <section className="section-space border-t border-[var(--line)] py-12 md:py-16">
        <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div className="max-w-3xl">
            <p className="mono-label accent">[ DATA_REQUEST ]</p>
            <h2 className="mt-5 text-4xl font-semibold leading-tight sm:text-5xl">Questions about your inquiry data?</h2>
            <p className="mt-5 text-lg leading-8 ink-soft">Use the Contact page to request access, correction, or deletion.</p>
          </div>
          <Link href="/contact" className="button-primary w-full whitespace-nowrap sm:w-auto">Contact Artkin</Link>
        </div>
      </section>
    </div>
  );
}
