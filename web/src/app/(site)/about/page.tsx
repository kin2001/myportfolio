import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { SectionHeader } from "@/components/section-header";
import { SystemDiagram } from "@/components/system-diagram";
import { processSteps } from "@/lib/content";

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
    images: [{ url: "/artkin-hero.webp", width: 1024, height: 1024, alt: "Portrait of Artkin Carreon" }],
  },
};

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const personStructuredData = {
  "@context": "https://schema.org",
  "@type": "Person",
  "@id": `${siteUrl}/#person`,
  name: "Artkin Carreon",
  url: `${siteUrl}/about`,
  image: `${siteUrl}/artkin-hero.webp`,
  jobTitle: "AI Automation Specialist",
  alumniOf: { "@type": "CollegeOrUniversity", name: "Jose Rizal Memorial State University" },
  sameAs: ["https://github.com/kin2001", "https://www.linkedin.com/in/artkin-carreon-8809b8421"],
  knowsAbout: ["Workflow automation", "n8n", "AI agents", "Webhooks", "REST APIs", "Custom code", "Data preparation"],
};

const focusAreas = [
  ["contact", "Customer inquiries and appointments", "Workflows that respond to questions, collect the right details, and manage appointment actions."],
  ["signal", "Reminders and follow-ups", "Scheduled messages that keep clients informed before an appointment or follow-up."],
  ["link", "API and webhook integrations", "Connections that move data between apps through APIs, webhooks, and custom code."],
] as const;

const clinicFunctions = [
  ["contact", "Facebook Page inquiries", "Reply to questions and collect the information needed for an appointment."],
  ["experience", "Appointment management", "Book, cancel, reschedule, or update appointment details."],
  ["signal", "Email reminders", "Notify the client 24 hours before the scheduled appointment."],
] as const;

const toolGroups = [
  ["systems", "Workflow automation", ["n8n", "Webhooks", "Scheduled triggers", "Cron triggers"]],
  ["work", "Google Workspace", ["Google Drive", "Google Docs", "Google Sheets", "Gmail", "Google Calendar"]],
  ["signal", "AI and data", ["AI agents", "OpenAI", "Gemini", "JSON", "Data mapping", "Data preparation"]],
  ["link", "Connected platforms", ["Facebook Pages", "Messenger", "Airtable", "Notion", "Supabase"]],
  ["terminal", "Development", ["HTTP requests", "REST APIs", "Custom code", "API implementation"]],
] as const;

export default function AboutPage() {
  return (
    <div className="content-canvas">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(personStructuredData).replace(/</g, "\\u003c") }} />
      <header className="grid min-w-0 items-center gap-12 py-12 md:grid-cols-[minmax(0,1.15fr)_minmax(240px,.85fr)] md:py-20">
        <div className="min-w-0">
          <p className="mono-meta accent" aria-hidden="true">[ ABOUT_ARTKIN / 001 ]</p>
          <h1 className="mt-5 text-[42px] font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-5xl xl:text-6xl">Computer Engineering graduate building useful automation.</h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 ink-soft">I am Artkin Carreon. I graduated with a degree in Computer Engineering from Jose Rizal Memorial State University in Dapitan City on June 25, 2026. I started exploring automation during university and now focus on systems that reduce repetitive work for small businesses.</p>
        </div>

        <figure className="module mx-auto w-full max-w-[320px] p-4 sm:p-6 md:max-w-[380px]">
          <Image src="/artkin-hero.webp" alt="Artkin Carreon" width={1024} height={1024} sizes="(max-width: 767px) 288px, 340px" className="hero-portrait aspect-square h-auto w-full object-cover object-center" />
          <figcaption className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-4">
            <span className="mono-meta">PROFILE / 001</span>
            <span className="mono-meta accent flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[var(--accent)]" aria-hidden="true" />OPEN TO FREELANCE</span>
          </figcaption>
        </figure>
      </header>

      <dl className="grid grid-cols-2 gap-px border border-[var(--line)] bg-[var(--line)] sm:grid-cols-2 xl:grid-cols-4" aria-label="Profile facts">
        <div className="surface min-w-0 p-5 sm:p-6"><dt className="mono-label muted">Degree</dt><dd className="mt-3 break-words font-medium">Computer Engineering</dd></div>
        <div className="surface min-w-0 p-5 sm:p-6"><dt className="mono-label muted">Graduated</dt><dd className="mt-3 font-medium"><time dateTime="2026-06-25">June 25, 2026</time></dd></div>
        <div className="surface min-w-0 p-5 sm:p-6"><dt className="mono-label muted">Focus</dt><dd className="mt-3 break-words font-medium">Workflow automation</dd></div>
        <div className="surface min-w-0 p-5 sm:p-6"><dt className="mono-label muted">Availability</dt><dd className="mt-3 break-words font-medium">Freelance projects</dd></div>
      </dl>

      <section className="section-space">
        <SectionHeader index="01" title="Background" />
        <div className="mt-8 grid gap-8 md:grid-cols-2">
          <p className="text-2xl font-medium leading-9">Repetitive tasks take time away from work that needs human attention. That drew me to automation. I want to build systems that handle routine processes consistently while keeping people in control of important decisions.</p>
          <aside className="module p-6 sm:p-8">
            <p className="mono-label accent">CURRENT_FOCUS</p>
            <h3 className="mt-5 text-2xl font-medium">Cleaner data. Smoother handoffs.</h3>
            <p className="mt-4 leading-7 ink-soft">I am improving how I prepare data and move it between connected tools. Clean inputs and clear handoffs make an automation easier to test and maintain.</p>
          </aside>
        </div>
      </section>

      <section className="section-space">
        <SectionHeader index="02" title="Engineering approach" meta="PROCESS FIRST" />
        <div className="mt-8 grid min-w-0 items-center gap-10 xl:grid-cols-[minmax(0,1fr)_minmax(320px,.9fr)]">
          <div className="min-w-0">
            <p className="text-2xl font-medium leading-9">My Computer Engineering background helps me view automation as one connected system instead of a set of separate tools.</p>
            <p className="mt-6 leading-8 ink-soft">I pay attention to how information moves, where errors can occur, and when the workflow needs human review. That foundation also helps me implement custom code and APIs when a standard connector cannot handle the job.</p>
          </div>
          <figure className="mx-auto w-full max-w-[420px]">
            <SystemDiagram />
            <figcaption className="mono-meta muted mt-3 border-t border-[var(--line)] pt-3">The process is mapped before automation, AI review, and verification are connected.</figcaption>
          </figure>
        </div>
      </section>

      <section className="section-space">
        <SectionHeader index="03" title="Problems I focus on" />
        <div className="mt-8 grid gap-px border border-[var(--line)] bg-[var(--line)] md:grid-cols-3">
          {focusAreas.map(([icon, title, body], index) => (
            <article className="surface min-w-0 p-6 sm:p-8" key={title}>
              <div className="flex items-center justify-between"><span className="flex h-11 w-11 items-center justify-center border border-[var(--line)] bg-[var(--paper-soft)]"><Icon name={icon} className="h-5 w-5" /></span><span className="mono-meta accent">0{index + 1}</span></div>
              <h3 className="mt-6 text-xl font-medium">{title}</h3>
              <p className="mt-4 text-sm leading-6 ink-soft">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-space">
        <SectionHeader index="04" title="Selected system" meta="CLINIC RECEPTIONIST AGENT" />
        <div className="module mt-8 grid min-w-0 gap-10 p-6 sm:p-8 xl:grid-cols-[minmax(0,1fr)_minmax(320px,.9fr)] xl:p-10">
          <div className="min-w-0">
            <p className="mono-meta accent">SYSTEM_RECORD / 001</p>
            <h3 className="mt-5 text-3xl font-medium">Clinic receptionist agent</h3>
            <p className="mt-5 max-w-2xl leading-8 ink-soft">I built a clinic receptionist agent for Facebook Page inquiries. It replies to questions, books appointments, and lets a user cancel, reschedule, or update appointment details. The workflow also emails the client 24 hours before the appointment.</p>
          </div>
          <ul className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
            {clinicFunctions.map(([icon, title, body]) => (
              <li className="grid grid-cols-[44px_minmax(0,1fr)] gap-4 py-5" key={title}>
                <span className="flex h-11 w-11 items-center justify-center border border-[var(--line)] bg-[var(--paper-soft)]"><Icon name={icon} className="h-5 w-5" /></span>
                <div className="min-w-0"><h4 className="font-medium">{title}</h4><p className="mt-2 text-sm leading-6 ink-soft">{body}</p></div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section-space">
        <SectionHeader index="05" title="Toolkit" meta="TOOLS I HAVE USED" />
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

      <section className="section-space">
        <SectionHeader index="06" title="How I work" />
        <p className="mt-8 max-w-3xl text-lg leading-8 ink-soft">I begin with the current process. I identify who uses it, what data moves through it, where errors can occur, and which decisions need human review. Then I map the workflow, build a useful first version, and test normal and failure paths.</p>
        <ol className="mt-8">
          {processSteps.map(([index, title, description]) => (
            <li className="grid gap-4 border-t border-[var(--line)] py-8 md:grid-cols-[80px_1fr_2fr]" key={index}>
              <span className="mono-meta accent" aria-hidden="true">{index}</span>
              <h3 className="text-2xl font-medium">{title}</h3>
              <p className="leading-7 ink-soft">{description}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="section-space border-t border-[var(--line)] py-12 md:py-16">
        <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div className="max-w-3xl">
            <p className="mono-label accent">[ AVAILABLE_FOR_FREELANCE ]</p>
            <h2 className="mt-5 text-4xl font-semibold leading-tight sm:text-5xl">Have a repetitive process that needs a better system?</h2>
            <p className="mt-5 text-lg leading-8 ink-soft">I am looking for freelance projects where automation can remove routine work or connect an existing process more clearly.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/contact" className="button-primary whitespace-nowrap">Discuss your workflow</Link>
            <Link href="/work" className="button-secondary whitespace-nowrap">Explore projects</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
