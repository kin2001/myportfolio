import type { Metadata } from "next";
import { ContactForm } from "@/components/contact-form";
import { SectionHeader } from "@/components/section-header";

export const metadata: Metadata = { title: "Contact", description: "Discuss a workflow automation or AI-assisted system with Artkin Carreon." };

export default function ContactPage() {
  return (
    <div className="content-canvas">
      <header className="grid gap-10 py-16 md:grid-cols-[1fr_2fr] md:py-24">
        <p className="mono-meta accent">[ INQUIRY_TERMINAL ]</p>
        <div><h1 className="text-5xl font-semibold tracking-tight md:text-7xl">Start with the process.</h1><p className="mt-7 max-w-2xl text-lg leading-8 ink-soft">Describe the repetitive work, the tools involved, and what a better outcome would look like. You do not need to know the technical solution.</p></div>
      </header>
      <SectionHeader index="01" title="Project inquiry" meta="HUMAN REVIEW REQUIRED" />
      <div className="mt-8"><ContactForm /></div>
      <div className="mt-8 grid gap-6 md:grid-cols-3">
        {[["01", "Record", "Your inquiry is stored before any automation runs."], ["02", "Triage", "AI may classify a redacted message and prepare a draft."], ["03", "Review", "Artkin reviews and approves every reply before sending."]].map(([index,title,body]) => <div className="module p-6" key={index}><span className="mono-meta accent">{index}</span><h2 className="mt-5 text-xl font-medium">{title}</h2><p className="mt-3 text-sm leading-6 ink-soft">{body}</p></div>)}
      </div>
    </div>
  );
}
