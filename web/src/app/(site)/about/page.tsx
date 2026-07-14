import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { SectionHeader } from "@/components/section-header";

const description = "Meet Artkin Carreon, a Computer Engineering graduate who builds practical AI and workflow automation with n8n, APIs, webhooks, and custom code.";

export const metadata: Metadata = {
  title: { absolute: "About Artkin Carreon | AI Automation Specialist" },
  description,
  alternates: { canonical: "/about" },
  openGraph: {
    type: "profile",
    firstName: "Artkin",
    lastName: "Carreon",
    title: "About Artkin Carreon | AI Automation Specialist",
    description,
    url: "/about",
    images: [{ url: "/artkin-about.webp", width: 1024, height: 1024, alt: "Artkin Carreon in graduation attire" }],
  },
};

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const personStructuredData = {
  "@context": "https://schema.org",
  "@type": "Person",
  "@id": `${siteUrl}/#person`,
  name: "Artkin Carreon",
  url: `${siteUrl}/about`,
  image: `${siteUrl}/artkin-about.webp`,
  jobTitle: "AI Automation Specialist",
  alumniOf: { "@type": "CollegeOrUniversity", name: "Jose Rizal Memorial State University" },
  sameAs: ["https://github.com/kin2001", "https://www.linkedin.com/in/artkin-carreon-8809b8421"],
  knowsAbout: ["Workflow automation", "n8n", "AI agents", "Retrieval-augmented generation", "Webhooks", "REST APIs", "Custom code", "Data preparation"],
};

const focusAreas = [
  ["contact", "Inquiries and appointments", "Respond to questions and manage appointment actions."],
  ["signal", "Reminders and follow-ups", "Send useful messages at the right point in a workflow."],
  ["link", "APIs and webhooks", "Move data between tools with reliable connections."],
] as const;

const clinicFunctions = [
  ["contact", "Facebook Page inquiries", "Reply to questions and collect appointment details."],
  ["experience", "Appointment management", "Book, cancel, reschedule, or update information."],
  ["signal", "Email reminders", "Notify the client 24 hours before the appointment."],
] as const;

const toolGroups = [
  ["systems", "Workflow automation", ["n8n", "Webhooks", "Scheduled triggers", "Cron triggers"]],
  ["work", "Google Workspace", ["Google Drive", "Google Docs", "Google Sheets", "Gmail", "Google Calendar"]],
  ["signal", "AI and data", ["AI agents", "RAG", "OpenAI", "Gemini", "JSON", "Data mapping", "Data preparation"]],
  ["link", "Connected platforms", ["Facebook Pages", "Messenger", "Airtable", "Notion", "Supabase"]],
  ["terminal", "Development", ["HTTP requests", "REST APIs", "Custom code", "API implementation"]],
] as const;

export default function AboutPage() {
  return (
    <div className="content-canvas">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(personStructuredData).replace(/</g, "\\u003c") }} />

      <header className="grid min-w-0 items-center gap-10 py-12 md:grid-cols-[minmax(0,1.1fr)_minmax(240px,.9fr)] md:py-20">
        <div className="min-w-0">
          <p className="mono-meta accent" aria-hidden="true">[ ABOUT_ARTKIN / 001 ]</p>
          <h1 className="mt-5 text-[42px] font-semibold leading-[1.08] tracking-tight sm:text-5xl xl:text-6xl">I build practical automation.</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 ink-soft">I am Artkin Carreon, a Computer Engineering graduate from Jose Rizal Memorial State University. I build workflow automations, API integrations, and custom tools for small businesses.</p>
        </div>

        <figure className="module mx-auto w-full max-w-[320px] p-4 sm:p-6 md:max-w-[380px]">
          <Image src="/artkin-about.webp" alt="Artkin Carreon in graduation attire" width={1024} height={1024} sizes="(max-width: 767px) 288px, 340px" priority className="hero-portrait aspect-square h-auto w-full object-cover object-center" />
          <figcaption className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-4">
            <span className="mono-meta">PROFILE / 001</span>
            <span className="mono-meta accent flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[var(--accent)]" aria-hidden="true" />OPEN TO FREELANCE</span>
          </figcaption>
        </figure>
      </header>

      <dl className="grid grid-cols-2 gap-px border border-[var(--line)] bg-[var(--line)] xl:grid-cols-4" aria-label="Profile facts">
        <div className="surface min-w-0 p-5"><dt className="mono-label muted">Degree</dt><dd className="mt-3 break-words font-medium">Computer Engineering</dd></div>
        <div className="surface min-w-0 p-5"><dt className="mono-label muted">University</dt><dd className="mt-3 break-words font-medium">JRMSU, Dapitan City</dd></div>
        <div className="surface min-w-0 p-5"><dt className="mono-label muted">Graduated</dt><dd className="mt-3 font-medium"><time dateTime="2026-06-25">June 25, 2026</time></dd></div>
        <div className="surface min-w-0 p-5"><dt className="mono-label muted">Availability</dt><dd className="mt-3 break-words font-medium">Freelance projects</dd></div>
      </dl>

      <section className="section-space">
        <SectionHeader index="01" title="Approach" meta="PROCESS FIRST" />
        <div className="mt-8 grid min-w-0 gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(320px,.9fr)]">
          <p className="text-2xl font-medium leading-9">My Computer Engineering background helps me see automation as one connected system. I map the process and data flow first, then use n8n, APIs, or custom code where each one fits. I also check failure points and keep human review for important decisions.</p>
          <ul className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
            {focusAreas.map(([icon, title, body]) => (
              <li className="grid grid-cols-[44px_minmax(0,1fr)] gap-4 py-4" key={title}>
                <span className="flex h-11 w-11 items-center justify-center border border-[var(--line)] bg-[var(--paper-soft)]"><Icon name={icon} className="h-5 w-5" /></span>
                <div className="min-w-0"><h3 className="font-medium">{title}</h3><p className="mt-1 text-sm leading-6 ink-soft">{body}</p></div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section-space">
        <SectionHeader index="02" title="Selected system" meta="CLINIC RECEPTIONIST AGENT" />
        <div className="module mt-8 grid min-w-0 gap-8 p-6 sm:p-8 xl:grid-cols-[minmax(0,1fr)_minmax(320px,.9fr)]">
          <div className="min-w-0">
            <p className="mono-meta accent">SYSTEM_RECORD / 001</p>
            <h3 className="mt-5 text-3xl font-medium">Clinic receptionist agent</h3>
            <p className="mt-5 leading-8 ink-soft">I built an agent that handles Facebook Page inquiries, appointment changes, and email reminders for a clinic workflow.</p>
          </div>
          <ul className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
            {clinicFunctions.map(([icon, title, body]) => (
              <li className="grid grid-cols-[44px_minmax(0,1fr)] gap-4 py-4" key={title}>
                <span className="flex h-11 w-11 items-center justify-center border border-[var(--line)] bg-[var(--paper-soft)]"><Icon name={icon} className="h-5 w-5" /></span>
                <div className="min-w-0"><h4 className="font-medium">{title}</h4><p className="mt-1 text-sm leading-6 ink-soft">{body}</p></div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section-space">
        <SectionHeader index="03" title="Toolkit" meta="TOOLS I HAVE USED" />
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {toolGroups.map(([icon, title, tools]) => (
            <article className="module min-w-0 p-6" key={title}>
              <div className="flex items-center gap-3"><Icon name={icon} className="h-5 w-5 accent" /><h3 className="mono-label">{title}</h3></div>
              <ul className="mt-6 flex min-w-0 flex-wrap gap-2" aria-label={`${title} tools`}>
                {tools.map((tool) => <li className="mono-meta max-w-full break-words bg-[var(--paper-soft)] px-3 py-2" key={tool}>{tool}</li>)}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="section-space border-t border-[var(--line)] py-12 md:py-16">
        <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div className="max-w-3xl">
            <p className="mono-label accent">[ CURRENT_DIRECTION ]</p>
            <h2 className="mt-5 text-4xl font-semibold leading-tight sm:text-5xl">Better data flow. Less repetitive work.</h2>
            <p className="mt-5 text-lg leading-8 ink-soft">I am improving my data preparation skills and building smoother data flows between connected tools. I am available for freelance automation projects.</p>
          </div>
          <Link href="/contact" className="button-primary whitespace-nowrap">Discuss your workflow</Link>
        </div>
      </section>
    </div>
  );
}
