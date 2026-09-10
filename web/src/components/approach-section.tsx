import Link from "next/link";
import { Icon } from "@/components/icons";
import { SectionHeader } from "@/components/section-header";

const focusAreas = [
  ["contact", "GoHighLevel CRM & workflows", "Lead capture, pipeline updates, follow-ups, and appointment booking."],
  ["systems", "AI-powered workflows", "Organize inquiries and draft responses, with human review for important actions."],
  ["link", "n8n, APIs & webhooks", "Connect your tools and keep workflow data in sync."],
] as const;

export function ApproachSection({ index, detailsHref }: { index: string; detailsHref?: string }) {
  return (
    <section className="section-space" data-reveal="approach">
      <SectionHeader
        action={detailsHref ? (
          <Link className="hero-link" href={detailsHref}>
            View more details <Icon name="arrow" />
          </Link>
        ) : undefined}
        index={index}
        meta="PROCESS FIRST"
        title="Approach"
      />
      <div className="mt-6 grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,.9fr)]" data-approach-grid>
        <div data-approach-copy>
          <h3 className="public-section-title specialty-title">
            <span className="accent">GoHighLevel workflows.</span>{" "}
            <span className="accent">AI automation.</span>{" "}
            <span>Built around your business.</span>
          </h3>
          <p className="public-body mt-4 max-w-[52ch]">
            I turn lead capture, follow-up, and booking into connected workflows. GoHighLevel handles the CRM; AI, n8n, and APIs connect the work around it. I map the process first and test how each step works together.
          </p>
        </div>
        <ul className="divide-y divide-[var(--line)] border-y border-[var(--line)]" data-approach-list>
          {focusAreas.map(([icon, title, body]) => (
            <li className="grid grid-cols-[44px_minmax(0,1fr)] gap-4 py-4" data-approach-item key={title}>
              <span className="flex h-11 w-11 items-center justify-center text-[var(--ink-soft)]">
                <Icon name={icon} className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h3 className="font-medium">{title}</h3>
                <p className="public-body mt-1">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
