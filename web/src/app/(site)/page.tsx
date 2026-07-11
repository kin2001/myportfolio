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
    <div className="mx-auto max-w-[1100px] space-y-24 px-6 py-12 md:px-8">
      <section className="grid min-h-[60vh] items-center gap-12 md:grid-cols-2" aria-labelledby="hero-title">
        <div className="order-2 space-y-8 md:order-1">
          <div className="space-y-4">
            <p className="mono-meta uppercase tracking-[.2em] text-[var(--accent)]">[ SYSTEM_BUILDER_INIT ]</p>
            <h1 id="hero-title" className="text-[48px] font-semibold leading-[1.05] tracking-[-.02em] md:text-[56px]">
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
        <div className="order-1 flex justify-center md:order-2">
          <Image src="/system-network.png" alt="Isometric technical diagram representing connected AI and automation systems" width={512} height={512} priority className="aspect-square w-full max-w-md object-contain" />
        </div>
      </section>

      <section className="grid grid-cols-2 gap-8 border-y border-[var(--line)] py-8 md:grid-cols-4" aria-label="Portfolio system facts">
        {systemFacts.map(([value, label], index) => <div key={label} className={`flex flex-col ${index < 3 ? "md:border-r md:border-[var(--line)]" : ""} ${index ? "md:pl-8" : ""}`}><span className="text-2xl font-bold leading-tight">{value}</span><span className="mono-label muted">{label}</span></div>)}
      </section>

      <section className="space-y-12" id="projects">
        <div className="flex items-end justify-between border-b border-[var(--line)] pb-4"><h2 className="mono-label tracking-[.2em]">01 — Projects</h2><Link href="/work" className="mono-meta muted">VIEW ALL_{String(published.length).padStart(2, "0")} PROJECTS</Link></div>
        {published.length ? <div className="grid gap-8 md:grid-cols-3">{published.slice(0, 3).map((project, index) => <article key={project.slug} className="flex h-[450px] flex-col justify-between border border-[var(--line)] bg-[var(--paper-pure)] p-6"><div><div className="flex items-start justify-between"><span className="mono-meta border border-[var(--line)] px-2 py-1">PROJECT_{String(index + 1).padStart(3, "0")}</span><span className="mono-meta text-[var(--accent)]">● LIVE</span></div><h3 className="mt-6 text-2xl font-medium leading-tight">{project.title}</h3><div className="mt-6 space-y-4 border-t border-[var(--line)] pt-4"><div><span className="mono-label muted">Problem</span><p className="mt-1 text-sm">{project.problem}</p></div><div><span className="mono-label muted">Solution</span><p className="mt-1 text-sm">{project.solution}</p></div></div></div><Link href={`/work/${project.slug}`} className="button-secondary w-full">Explore schematics</Link></article>)}</div> : <div className="grid min-h-56 gap-8 border border-[var(--line)] bg-[var(--paper-pure)] p-8 md:grid-cols-[220px_1fr] md:p-10"><p className="mono-meta text-[var(--accent)]">PROJECT_REGISTRY / 000</p><div><h3 className="text-2xl font-medium">Verified system records will appear here.</h3><p className="mt-4 max-w-2xl leading-7 text-[var(--ink-soft)]">No fictional projects from the Stitch sample are being published. This module will keep the exact project-card system once Artkin&apos;s real case studies and outcomes are supplied.</p></div></div>}
      </section>

      <section className="space-y-12" id="systems">
        <div className="border-b border-[var(--line)] pb-4"><h2 className="mono-label tracking-[.2em]">02 — Systems Capability</h2></div>
        <div className="grid gap-8 md:grid-cols-3">{capabilities.map((item) => <article key={item.code} className="space-y-6 border border-[var(--line)] bg-[var(--paper-soft)] p-8"><h3 className="mono-label inline-block border-b border-[var(--line)] pb-2">{item.title}</h3><p className="leading-7 text-[var(--ink-soft)]">{item.description}</p></article>)}</div>
      </section>

      <section className="space-y-12" id="signal">
        <div className="flex items-end border-b border-[var(--line)] pb-4"><h2 className="mono-label tracking-[.2em]">03 — AI Signal</h2><span className="mono-meta ml-4 text-[var(--accent)]">[ HUMAN REVIEW ACTIVE ]</span></div>
        <div className="grid gap-8 md:grid-cols-2"><article className="border border-[var(--line)] bg-[var(--paper-pure)] p-6"><div className="mb-4 flex gap-4"><span className="mono-meta bg-[var(--accent)] px-2 py-1 text-white">OPERATING_RULE</span><span className="mono-meta muted">SIGNAL_001</span></div><h3 className="text-2xl font-medium">Automation should reduce friction, not hide it.</h3><p className="mt-4 text-sm leading-6 text-[var(--ink-soft)]">Every workflow begins with the current process, its failure points, and the people responsible for decisions.</p></article><article className="border border-[var(--line)] bg-[var(--paper-pure)] p-6"><div className="mb-4 flex gap-4"><span className="mono-meta bg-[var(--accent)] px-2 py-1 text-white">SAFETY_RULE</span><span className="mono-meta muted">SIGNAL_002</span></div><h3 className="text-2xl font-medium">AI drafts; a person approves.</h3><p className="mt-4 text-sm leading-6 text-[var(--ink-soft)]">High-impact messages and operational decisions remain behind explicit human review.</p></article></div>
      </section>

      <section className="space-y-12" id="credentials">
        <div className="border-b border-[var(--line)] pb-4"><h2 className="mono-label tracking-[.2em]">04 — Credentials</h2></div>
        <div className="border border-[var(--line)] p-6"><p className="mono-meta muted">CREDENTIAL_REGISTRY / AWAITING VERIFIED RECORDS</p></div>
      </section>

      <section className="flex flex-col items-center space-y-10 border-t border-[var(--line)] pb-24 pt-12 text-center" id="contact"><div className="max-w-2xl space-y-4"><p className="mono-label tracking-[.3em] text-[var(--accent)]">06 — System Access</p><h2 className="text-5xl font-semibold leading-tight">Have a process worth automating? Let&apos;s discuss building a smarter system.</h2></div><div className="flex w-full max-w-md flex-col gap-6 md:flex-row"><Link href="/contact" className="button-primary flex-1">Contact me</Link><Link href="/contact" className="button-secondary flex-1">Start a project</Link></div></section>

      <footer className="flex flex-col items-center justify-between gap-8 border-t border-[var(--line)] py-12 md:flex-row"><div><p className="mono-label">AI Systems Laboratory</p><p className="mono-meta muted mt-4">© 2026 ARTKIN CARREON / ALL RIGHTS RESERVED</p></div><div className="flex gap-8"><Link className="mono-meta muted underline" href="/privacy">Privacy Policy</Link><Link className="mono-meta muted underline" href="/contact">System Access</Link></div></footer>
    </div>
  );
}
