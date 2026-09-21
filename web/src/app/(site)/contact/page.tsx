import type { Metadata } from "next";
import Image from "next/image";
import { AnimatedHeading } from "@/components/animated-heading";
import { BackButton } from "@/components/back-button";
import { BookingCalendarPreview } from "@/components/booking-calendar-preview";
import { SectionHeader } from "@/components/section-header";

const description = "Discuss a GoHighLevel workflow, AI automation, or API integration with Artkin Carreon.";

export const metadata: Metadata = {
  title: "Contact",
  description,
  alternates: { canonical: "/contact" },
  openGraph: {
    type: "website",
    title: "Contact | Artkin Carreon",
    description,
    url: "/contact",
    images: [{ url: "/artkin-hero.webp", width: 1024, height: 1024, alt: "Artkin Carreon" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Contact | Artkin Carreon",
    description,
    images: ["/artkin-hero.webp"],
  },
};

export default function ContactPage() {
  return (
    <div className="content-canvas">
      <BackButton />
      <header className="grid gap-10 pb-12 md:grid-cols-[minmax(200px,1fr)_2fr] md:grid-rows-[auto_1fr] md:pb-16" data-phone-layout="contact-hero" data-reveal="page-header">
        <p className="mono-meta accent md:col-start-1 md:row-start-1">[ INQUIRY_TERMINAL ]</p>
        <div className="md:col-start-2 md:row-span-2 md:row-start-1"><AnimatedHeading className="public-display" text="Let’s find a time to talk." /><p className="public-lead mt-7">Choose a time for a focused 50-minute discovery call. We’ll review your workflow, project goals, and where GoHighLevel or AI automation may help.</p></div>
        <Image src="/system-network1.png" alt="Connected automation workflow diagram" width={512} height={286} sizes="(max-width: 767px) 110px, 320px" loading="eager" className="contact-network-art h-auto w-full max-w-[320px] md:col-start-1 md:row-start-2 md:block md:self-end" />
      </header>
      <SectionHeader index="01" title="Book a discovery call" meta="VISUAL PREVIEW" />
      <div className="mt-8" data-reveal><BookingCalendarPreview /></div>
      <div className="mt-8 grid gap-6 md:grid-cols-3" data-phone-layout="service-grid">
        {[["01", "GoHighLevel automation", "Set up CRM workflows, lead routing, follow-up, and appointment processes around the way your business works."], ["02", "AI workflow systems", "Use AI for retrieval, triage, and drafting while keeping important actions under human review."], ["03", "API and data integration", "Connect tools through APIs, webhooks, and custom code so information moves reliably."]].map(([index,title,body]) => <div className="module p-6" data-reveal="record" key={index}><span className="mono-meta accent">{index}</span><h3 className="public-card-title mt-5">{title}</h3><p className="public-body mt-3">{body}</p></div>)}
      </div>
    </div>
  );
}
