import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { capabilities, profile, projects } from "@/lib/content";

const systemFacts = [
  ["04", "Delivery Phases"],
  ["03", "Core Capabilities"],
  ["02+", "Case Studies"],
  ["100%", "Human Approval"],
] as const;

export default function HomePage() {
  const published = projects.filter((project) => project.status === "published");
  return (
    <div className="mx-auto max-w-[1100px] space-y-16 px-4 py-10 sm:px-6 md:space-y-24 md:px-8 md:py-12">
      <section className="grid min-h-[60vh] items-center gap-12 md:grid-cols-2" aria-labelledby="hero-title">
        <div className="order-2 space-y-8 md:order-1">
          <div className="space-y-4">
            <p className="mono-meta uppercase tracking-[.2em] text-[var(--accent)]">[ SYSTEM_BUILDER_INIT ]</p>
            <h1 id="hero-title" className="text-[42px] font-semibold leading-[1.05] tracking-[-.02em] sm:text-[48px] md:text-[56px]">
              <span className="text-[var(--ink-soft)]">AI Automation<br className="hidden md:block" /> Specialist</span>
            </h1>
            <p className="max-w-lg text-lg leading-[1.6] text-[var(--ink-soft)]">{profile.shortPositioning}</p>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-4">
            <Link href="/work" className="hero-link">Projects <Icon name="arrow" /></Link>
            <Link href="/about" className="hero-link">About <Icon name="arrow" /></Link>
            <Link href="/contact" className="hero-link">Email <Icon name="arrow" /></Link>
            <Link href="/about" className="hero-link text-[var(--accent)]">Resume <Icon name="arrow" /></Link>
          </div>
        </div>
        <div className="order-1 mx-auto flex w-full max-w-[280px] justify-center sm:max-w-[360px] md:order-2 md:max-w-md">
          <Image src="/artkin-hero.webp" alt="Portrait of Artkin Carreon" width={1024} height={1024} sizes="(max-width: 639px) 280px, (max-width: 1023px) 360px, 436px" priority className="hero-portrait aspect-square h-auto w-full object-cover object-center" />
        </div>
      </section>

      <section className="grid grid-cols-2 gap-x-4 gap-y-8 border-y border-[var(--line)] py-8 sm:gap-x-8 md:grid-cols-4" aria-label="Portfolio system facts">
        {systemFacts.map(([value, label], index) => <div key={label} className={`flex flex-col gap-1 ${index < 3 ? "md:border-r md:border-[var(--line)]" : ""} ${index ? "md:pl-8" : ""}`}><span className="text-2xl font-bold leading-tight">{value}</span><span className="mono-label muted">{label}</span></div>)}
      </section>

      <section className="space-y-12" id="projects">
        <div className="flex flex-col items-start gap-3 border-b border-[var(--line)] pb-4 sm:flex-row sm:items-end sm:justify-between"><h2 className="mono-label tracking-[.2em]">01 — Projects</h2><Link href="/work" className="mono-meta muted">VIEW ALL_{String(published.length).padStart(2, "0")} PROJECTS</Link></div>
        {published.length ? <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-3">{published.slice(0, 3).map((project, index) => <article key={project.slug} className="flex min-w-0 flex-col justify-between border border-[var(--line)] bg-[var(--paper-pure)] p-6 sm:min-h-[450px]"><div><div className="flex flex-wrap items-start justify-between gap-3"><span className="mono-meta border border-[var(--line)] px-2 py-1">PROJECT_{String(index + 1).padStart(3, "0")}</span><span className="mono-meta text-[var(--accent)]">● LIVE</span></div><h3 className="mt-6 text-2xl font-medium leading-tight">{project.title}</h3><div className="mt-6 space-y-4 border-t border-[var(--line)] pt-4"><div><span className="mono-label muted">Problem</span><p className="mt-1 text-sm">{project.problem}</p></div><div><span className="mono-label muted">Solution</span><p className="mt-1 text-sm">{project.solution}</p></div></div></div><Link href={`/work/${project.slug}`} className="button-secondary mt-8 w-full">Explore schematics</Link></article>)}</div> : <div className="grid min-h-56 min-w-0 gap-6 border border-[var(--line)] bg-[var(--paper-pure)] p-6 sm:p-8 md:grid-cols-[180px_1fr] md:gap-8 md:p-10"><p className="mono-meta break-words text-[var(--accent)]">PROJECT_REGISTRY / 000</p><div className="min-w-0"><h3 className="text-2xl font-medium">Verified system records will appear here.</h3><p className="mt-4 max-w-2xl leading-7 text-[var(--ink-soft)]">No fictional projects from the Stitch sample are being published. This module will keep the exact project-card system once Artkin&apos;s real case studies and outcomes are supplied.</p></div></div>}
      </section>

      <section className="space-y-12" id="systems">
        <div className="border-b border-[var(--line)] pb-4"><h2 className="mono-label tracking-[.2em]">02 — Systems Capability</h2></div>
        <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-3">{capabilities.map((item) => <article key={item.code} className="min-w-0 space-y-6 border border-[var(--line)] bg-[var(--paper-soft)] p-6 sm:p-8"><h3 className="mono-label inline-block border-b border-[var(--line)] pb-2">{item.title}</h3><p className="leading-7 text-[var(--ink-soft)]">{item.description}</p></article>)}</div>
      </section>

      <section className="space-y-12" id="signal">
        <div className="flex flex-wrap items-end gap-3 border-b border-[var(--line)] pb-4"><h2 className="mono-label tracking-[.2em]">03 — AI Signal</h2><span className="mono-meta text-[var(--accent)]">[ HUMAN REVIEW ACTIVE ]</span></div>
        <div className="grid min-w-0 gap-8 md:grid-cols-2"><article className="min-w-0 border border-[var(--line)] bg-[var(--paper-pure)] p-5 sm:p-6"><div className="mb-4 flex flex-wrap gap-3"><span className="mono-meta bg-[var(--accent)] px-2 py-1 text-white">OPERATING_RULE</span><span className="mono-meta muted">SIGNAL_001</span></div><h3 className="text-2xl font-medium">Automation should reduce friction, not hide it.</h3><p className="mt-4 text-sm leading-6 text-[var(--ink-soft)]">Every workflow begins with the current process, its failure points, and the people responsible for decisions.</p></article><article className="min-w-0 border border-[var(--line)] bg-[var(--paper-pure)] p-5 sm:p-6"><div className="mb-4 flex flex-wrap gap-3"><span className="mono-meta bg-[var(--accent)] px-2 py-1 text-white">SAFETY_RULE</span><span className="mono-meta muted">SIGNAL_002</span></div><h3 className="text-2xl font-medium">AI drafts; a person approves.</h3><p className="mt-4 text-sm leading-6 text-[var(--ink-soft)]">High-impact messages and operational decisions remain behind explicit human review.</p></article></div>
      </section>

      <section className="space-y-12" id="credentials">
        <div className="border-b border-[var(--line)] pb-4"><h2 className="mono-label tracking-[.2em]">04 — Credentials</h2></div>
        <div className="border border-[var(--line)] p-6"><p className="mono-meta muted">CREDENTIAL_REGISTRY / AWAITING VERIFIED RECORDS</p></div>
      </section>

      <section className="flex flex-col items-center space-y-10 border-t border-[var(--line)] pb-20 pt-12 text-center md:pb-24" id="contact"><div className="max-w-2xl space-y-4"><p className="mono-label tracking-[.3em] text-[var(--accent)]">06 — System Access</p><h2 className="text-4xl font-semibold leading-tight sm:text-5xl">Have a process worth automating? Let&apos;s discuss building a smarter system.</h2></div><div className="flex w-full max-w-md flex-col gap-4 sm:flex-row sm:gap-6"><Link href="/contact" className="button-primary flex-1">Contact me</Link><Link href="/contact" className="button-secondary flex-1">Start a project</Link></div></section>

      <footer className="flex flex-col items-center justify-between gap-8 border-t border-[var(--line)] py-12 text-center md:flex-row md:text-left"><div><p className="mono-label">AI Systems Laboratory</p><p className="mono-meta muted mt-4">© 2026 ARTKIN CARREON / ALL RIGHTS RESERVED</p></div><div className="flex flex-wrap justify-center gap-6 sm:gap-8"><Link className="mono-meta muted underline" href="/privacy">Privacy Policy</Link><Link className="mono-meta muted underline" href="/contact">System Access</Link></div></footer>
    </div>
  );
}
