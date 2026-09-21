import type { Metadata } from "next";
import { AnimatedHeading } from "@/components/animated-heading";
import { BackButton } from "@/components/back-button";
import { BookingCalendarPreview } from "@/components/booking-calendar-preview";

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
      <header className="pb-12 md:pb-16" data-reveal="page-header">
        <AnimatedHeading className="public-display" text="Let’s find a time to talk." />
        <p className="public-lead mt-7">Choose a time for a focused 50-minute discovery call. We’ll review your workflow, project goals, and where GoHighLevel or AI automation may help.</p>
      </header>
      <div data-reveal><BookingCalendarPreview /></div>
    </div>
  );
}
