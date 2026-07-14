import type { Metadata } from "next";
import Image from "next/image";
import { ContactForm } from "@/components/contact-form";
import { SectionHeader } from "@/components/section-header";

export const metadata: Metadata = { title: "Contact", description: "Discuss a workflow automation or AI-assisted system with Artkin Carreon." };

export default function ContactPage() {
  return (
    <div className="content-canvas">
      <header className="grid gap-10 pb-16 md:grid-cols-[minmax(200px,1fr)_2fr] md:grid-rows-[auto_1fr] lg:py-24">
        <p className="mono-meta accent md:col-start-1 md:row-start-1">[ INQUIRY_TERMINAL ]</p>
        <div className="md:col-start-2 md:row-span-2 md:row-start-1"><h1 className="text-5xl font-semibold tracking-tight md:text-7xl">Start with the process.</h1><p className="mt-7 max-w-2xl text-lg leading-8 ink-soft">Describe the repetitive work, the tools involved, and what a better outcome would look like. You do not need to know the technical solution.</p></div>
        <Image src="/system-network1.png" alt="Connected automation workflow diagram" width={512} height={286} sizes="(max-width: 767px) 1px, 320px" className="hidden h-auto w-full max-w-[320px] md:col-start-1 md:row-start-2 md:block md:self-end" />
      </header>
      <SectionHeader index="01" title="Project inquiry" meta="HUMAN REVIEW REQUIRED" />
      <div className="mt-8"><ContactForm /></div>
      <div className="mt-8 grid gap-6 md:grid-cols-3">
        {[["01", "Workflow automation", "Reduce repetitive steps and connect handoffs into a reliable process."], ["02", "API integration", "Connect tools through APIs, webhooks, and custom code so information moves smoothly."], ["03", "AI-assisted systems", "Use AI for retrieval, classification, and drafting, with human review where it matters."]].map(([index,title,body]) => <div className="module p-6" key={index}><span className="mono-meta accent">{index}</span><h2 className="mt-5 text-xl font-medium">{title}</h2><p className="mt-3 text-sm leading-6 ink-soft">{body}</p></div>)}
      </div>
    </div>
  );
}
