import type { Metadata } from "next";
import Link from "next/link";
import { AnimatedHeading } from "@/components/animated-heading";
import { ApproachSection } from "@/components/approach-section";
import { BackButton } from "@/components/back-button";
import { Icon } from "@/components/icons";
import { ThemePortrait } from "@/components/theme-portrait";
import { SectionHeader } from "@/components/section-header";
import { getSiteUrl } from "@/lib/env";

const description = "Meet Artkin Carreon, an AI Automation and GoHighLevel Specialist who builds connected workflows with n8n, APIs, webhooks, and custom code.";

export const metadata: Metadata = {
  title: { absolute: "About Artkin Carreon | AI Automation & GoHighLevel Specialist" },
  description,
  alternates: { canonical: "/about" },
  openGraph: {
    type: "profile",
    firstName: "Artkin",
    lastName: "Carreon",
    title: "About Artkin Carreon | AI Automation & GoHighLevel Specialist",
    description,
    url: "/about",
    images: [{ url: "/artkin-about.webp", width: 1024, height: 1024, alt: "Artkin Carreon in graduation attire" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "About Artkin Carreon | AI Automation & GoHighLevel Specialist",
    description,
    images: ["/artkin-about.webp"],
  },
};

const siteUrl = getSiteUrl();
const personStructuredData = {
  "@context": "https://schema.org",
  "@type": "Person",
  "@id": `${siteUrl}/#person`,
  name: "Artkin Carreon",
  url: `${siteUrl}/about`,
  image: `${siteUrl}/artkin-about.webp`,
  jobTitle: "AI Automation & GoHighLevel Specialist",
  alumniOf: { "@type": "CollegeOrUniversity", name: "Jose Rizal Memorial State University" },
  sameAs: ["https://github.com/kin2001", "https://www.linkedin.com/in/artkin-carreon-8809b8421"],
  knowsAbout: ["GoHighLevel", "Workflow automation", "n8n", "AI agents", "Retrieval-augmented generation", "Webhooks", "REST APIs", "Custom code", "Data preparation"],
};

const clinicFunctions = [
  ["contact", "Facebook Page inquiries", "Reply to questions and collect appointment details."],
  ["experience", "Appointment management", "Book, cancel, reschedule, or update information."],
  ["signal", "Email reminders", "Notify the client 24 hours before the appointment."],
] as const;

const toolGroups = [
  ["systems", "Workflow automation", ["n8n", "Webhooks", "Scheduled triggers", "Cron triggers"]],
  ["work", "Google Workspace", ["Google Drive", "Google Docs", "Google Sheets", "Gmail", "Google Calendar"]],
  ["signal", "AI and data", ["AI agents", "RAG", "OpenAI", "Gemini", "JSON", "Data mapping", "Data preparation"]],
  ["link", "Connected platforms", ["GoHighLevel", "Facebook Pages", "Messenger", "Airtable", "Notion", "Supabase"]],
  ["terminal", "Development", ["HTTP requests", "REST APIs", "Custom code", "API implementation"]],
] as const;

export default function AboutPage() {
  return (
    <div className="content-canvas">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(personStructuredData).replace(/</g, "\\u003c") }} />

      <BackButton />
      <header className="grid min-w-0 items-start gap-10 pb-10 md:grid-cols-[minmax(0,1.1fr)_minmax(240px,.9fr)] md:pb-16 lg:items-center" data-phone-layout="about-hero" data-reveal="page-header">
        <div className="min-w-0">
          <p className="mono-meta accent" aria-hidden="true">[ ABOUT_ARTKIN / 001 ]</p>
          <AnimatedHeading className="public-display mt-5" text="Automation that keeps operations moving." />
          <p className="public-lead mt-6">I am Artkin Carreon, a Computer Engineering graduate focused on AI automation, GoHighLevel systems, API integrations, and custom workflow tools for small businesses.</p>
        </div>

        <figure className="module mx-auto w-full max-w-[320px] p-4 sm:p-6 md:max-w-[380px]" data-phone-compact="portrait-card">
          <ThemePortrait source="about" alt="Artkin Carreon in graduation attire" sizes="(max-width: 767px) 288px, 340px" />
          <figcaption className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-4">
            <span className="mono-meta">PROFILE / 001</span>
            <span className="mono-meta accent flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[var(--accent)]" aria-hidden="true" />OPEN TO FREELANCE</span>
          </figcaption>
        </figure>
      </header>

      <dl className="grid grid-cols-2 gap-px border border-[var(--line)] bg-[var(--line)] xl:grid-cols-4" data-phone-layout="fact-row" data-reveal aria-label="Profile facts">
        <div className="surface min-w-0 p-5"><dt className="mono-label muted">Degree</dt><dd className="mt-3 break-words font-medium">Computer Engineering</dd></div>
        <div className="surface min-w-0 p-5"><dt className="mono-label muted">University</dt><dd className="mt-3 break-words font-medium">JRMSU, Dapitan City</dd></div>
        <div className="surface min-w-0 p-5"><dt className="mono-label muted">Graduated</dt><dd className="mt-3 font-medium"><time dateTime="2026-06-25">June 25, 2026</time></dd></div>
        <div className="surface min-w-0 p-5"><dt className="mono-label muted">Availability</dt><dd className="mt-3 break-words font-medium">Freelance projects</dd></div>
      </dl>

      <ApproachSection index="01" />

      <section className="section-space" data-reveal="record">
        <SectionHeader index="02" title="Selected system" meta="CLINIC RECEPTIONIST AGENT" />
        <div className="module mt-8 grid min-w-0 gap-8 p-6 sm:p-8 xl:grid-cols-[minmax(0,1fr)_minmax(320px,.9fr)]" data-phone-layout="content-pair">
          <div className="min-w-0">
            <p className="mono-meta accent">SYSTEM_RECORD / 001</p>
            <h3 className="public-card-title mt-5">Clinic receptionist agent</h3>
            <p className="public-body mt-5">I built an agent that handles Facebook Page inquiries, appointment changes, and email reminders for a clinic workflow.</p>
          </div>
          <ul className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
            {clinicFunctions.map(([icon, title, body]) => (
              <li className="grid grid-cols-[44px_minmax(0,1fr)] gap-4 py-4" key={title}>
                <span className="flex h-11 w-11 items-center justify-center text-[var(--ink-soft)]"><Icon name={icon} className="h-5 w-5" /></span>
                <div className="min-w-0"><h4 className="font-medium">{title}</h4><p className="public-body mt-1">{body}</p></div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section-space" data-reveal="record">
        <SectionHeader index="03" title="Toolkit" meta="TOOLS I HAVE USED" />
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-phone-layout="toolkit-grid">
          {toolGroups.map(([icon, title, tools]) => (
            <article className="module min-w-0 p-6" data-phone-compact="tool-card" key={title}>
              <div className="flex items-center gap-3"><Icon name={icon} className="h-5 w-5 accent" /><h3 className="mono-label">{title}</h3></div>
              <ul className="mt-6 flex min-w-0 flex-wrap gap-2" aria-label={`${title} tools`}>
                {tools.map((tool) => <li className="mono-meta max-w-full break-words bg-[var(--paper-soft)] px-3 py-2" key={tool}>{tool}</li>)}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="section-space border-t border-[var(--line)] py-12 md:py-16" data-reveal="actions">
        <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-end" data-phone-layout="action-row">
          <div className="max-w-3xl">
            <p className="mono-label accent">[ CURRENT_DIRECTION ]</p>
            <h2 className="public-section-title mt-5">Cleaner data flow. More reliable follow-up.</h2>
            <p className="public-lead mt-5">My current focus is GoHighLevel workflow design and reliable data flow between connected tools. I am available for freelance automation projects.</p>
          </div>
          <Link href="/contact" className="button-primary justify-self-end whitespace-nowrap">Discuss your workflow</Link>
        </div>
      </section>
    </div>
  );
}
