import type { Metadata } from "next";
import { SectionHeader } from "@/components/section-header";

export const metadata: Metadata = { title: "Privacy", description: "How portfolio inquiries and AI-assisted drafting are handled." };

const sections = [
  ["Data collected", "The inquiry form collects your name, email address, optional company, project type, message, and consent timestamp."],
  ["Why it is used", "The information is used to understand your request, manage the inquiry, prepare a response, and maintain a record of communication."],
  ["AI-assisted processing", "Before AI analysis, direct identifiers and obvious URLs are removed. AI may summarize the request, classify intent, and prepare a draft. Artkin reviews every draft."],
  ["Retention", "Inquiries are retained for up to 90 days by default, then deleted unless an active business conversation requires continued retention."],
  ["Your choices", "You may request access to or deletion of your inquiry. Submitting the form is optional and no reply is sent automatically."],
] as const;

export default function PrivacyPage() {
  return (
    <div className="content-canvas">
      <header className="max-w-3xl py-16 md:py-24"><p className="mono-meta accent">[ DATA_HANDLING_PROTOCOL ]</p><h1 className="mt-5 text-5xl font-semibold tracking-tight md:text-7xl">Plain-language privacy.</h1><p className="mt-6 text-lg leading-8 ink-soft">This policy describes the intended v1 behavior. It must be reviewed against the final providers, domain, and applicable law before public launch.</p></header>
      <SectionHeader index="01" title="Inquiry data" />
      <div className="mt-8">{sections.map(([title, body], index) => <section className="grid gap-5 border-t border-[var(--line)] py-8 md:grid-cols-[100px_1fr_2fr]" key={title}><span className="mono-meta accent">0{index + 1}</span><h2 className="text-xl font-medium">{title}</h2><p className="leading-7 ink-soft">{body}</p></section>)}</div>
    </div>
  );
}
