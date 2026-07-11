import type { Metadata } from "next";
import Link from "next/link";
import { SectionHeader } from "@/components/section-header";
import { processSteps, profile } from "@/lib/content";

export const metadata: Metadata = { title: "About", description: "How Artkin Carreon approaches workflow automation and AI-assisted systems." };

export default function AboutPage() {
  return (
    <div className="content-canvas">
      <header className="grid gap-10 py-16 md:grid-cols-[1fr_2fr] md:py-24"><p className="mono-meta accent">[ OPERATOR_PROFILE ]</p><div><h1 className="text-5xl font-semibold tracking-tight md:text-7xl">Clear systems.<br />Useful automation.</h1><p className="mt-8 max-w-2xl text-xl leading-8 ink-soft">{profile.shortPositioning}</p></div></header>
      <section className="section-space"><SectionHeader index="01" title="Working principles" /><div className="mt-8 grid gap-px border border-[var(--line)] bg-[var(--line)] md:grid-cols-3">{[["Evidence before claims", "If an outcome cannot be verified, it is described honestly and qualitatively."], ["Human control", "AI assists classification and drafting; people retain approval over consequential actions."], ["Reliability over novelty", "The right automation is maintainable, observable, and appropriate for the business."]].map(([title, body], index) => <article className="surface p-8" key={title}><span className="mono-meta accent">0{index + 1}</span><h2 className="mt-6 text-2xl font-medium">{title}</h2><p className="mt-4 leading-7 ink-soft">{body}</p></article>)}</div></section>
      <section className="section-space"><SectionHeader index="02" title="Method" /><ol className="mt-8">{processSteps.map(([index,title,description]) => <li className="grid gap-4 border-t border-[var(--line)] py-8 md:grid-cols-[100px_1fr_2fr]" key={index}><span className="mono-meta accent">{index}</span><h3 className="text-2xl font-medium">{title}</h3><p className="leading-7 ink-soft">{description}</p></li>)}</ol></section>
      <div className="mt-20"><Link href="/contact" className="button-primary">Discuss your workflow</Link></div>
    </div>
  );
}
