import type { Metadata } from "next";
import { SectionHeader } from "@/components/section-header";

export const metadata: Metadata = { title: "Privacy", description: "How portfolio inquiry data is used, processed, stored, and deleted." };

const sections = [
  ["Data collected", "The inquiry form collects your name, email address, optional company, project type, message, consent choice, and submission time."],
  ["Why it is used", "Artkin uses this information to understand your request, contact you, ask follow-up questions, arrange a project meeting, and maintain the related business conversation."],
  ["Where it goes", "Your submission is sent to the private portfolio API and stored in Supabase. Cloudflare Turnstile processes the form security token. A redacted message may be sent to the configured NVIDIA AI service, and Resend processes the approved email reply. Hosting providers may process the network logs required to operate the site."],
  ["AI and human review", "Names, email addresses, company names, and obvious URLs are removed before AI analysis. AI may help summarize the request, classify intent, or prepare a draft. Artkin reviews every reply before it is sent."],
  ["Retention", "Inquiries are retained for up to 90 days by default. They may be kept longer when an active project conversation requires it, then deleted when no longer needed."],
  ["Your choices", "You may request access, correction, or deletion through the Contact page. Inquiry data is not sold, published, or used for unrelated marketing, and no AI-generated reply is sent automatically."],
] as const;

export default function PrivacyPage() {
  return (
    <div className="content-canvas">
      <header className="max-w-3xl py-16 md:py-24"><p className="mono-meta accent">[ DATA_HANDLING_PROTOCOL ]</p><h1 className="mt-5 text-5xl font-semibold tracking-tight md:text-7xl">Plain-language privacy.</h1><p className="mt-6 text-lg leading-8 ink-soft">This notice explains what happens to the information you submit through the portfolio contact form.</p></header>
      <SectionHeader index="01" title="Inquiry data" />
      <div className="mt-8">{sections.map(([title, body], index) => <section className="grid gap-5 border-t border-[var(--line)] py-8 md:grid-cols-[100px_1fr_2fr]" key={title}><span className="mono-meta accent">0{index + 1}</span><h2 className="text-xl font-medium">{title}</h2><p className="leading-7 ink-soft">{body}</p></section>)}</div>
    </div>
  );
}
