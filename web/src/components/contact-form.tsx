"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

type FormStatus = "idle" | "sending" | "success" | "error";

export function ContactForm() {
  const [status, setStatus] = useState<FormStatus>("idle");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    if (data.get("website")) return;
    const payload = {
      name: String(data.get("name") ?? ""),
      email: String(data.get("email") ?? ""),
      company: String(data.get("company") ?? ""),
      project_type: String(data.get("project_type") ?? ""),
      message: String(data.get("message") ?? ""),
      consent: data.get("consent") === "on",
      turnstile_token: String(data.get("cf-turnstile-response") ?? ""),
    };
    if (!payload.name || !payload.email || !payload.project_type || payload.message.length < 30 || !payload.consent) {
      setStatus("error");
      setMessage("Complete the required fields and describe the workflow in at least 30 characters.");
      return;
    }
    const api = process.env.NEXT_PUBLIC_API_URL;
    if (!api) {
      setStatus("error");
      setMessage("The inquiry API is not connected yet. Your message has not been sent.");
      return;
    }
    setStatus("sending");
    try {
      const response = await fetch(api + "/api/v1/inquiries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Request failed");
      form.reset();
      setStatus("success");
      setMessage("Your inquiry is recorded. Artkin will review it before any reply is sent.");
    } catch {
      setStatus("error");
      setMessage("The inquiry could not be delivered. Please try again later.");
    }
  }

  return (
    <form onSubmit={submit} className="module p-7 md:p-10" noValidate>
      <div className="grid gap-8 md:grid-cols-2">
        <label className="block"><span className="mono-label">Name *</span><input className="field mt-2" name="name" autoComplete="name" required /></label>
        <label className="block"><span className="mono-label">Email *</span><input className="field mt-2" name="email" type="email" autoComplete="email" required /></label>
        <label className="block"><span className="mono-label">Company</span><input className="field mt-2" name="company" autoComplete="organization" /></label>
        <label className="block"><span className="mono-label">Project type *</span><select className="field mt-2" name="project_type" defaultValue="" required><option value="" disabled>Select one</option><option>Workflow automation</option><option>AI-assisted operation</option><option>Systems integration</option><option>Automation audit</option><option>Other</option></select></label>
      </div>
      <label className="mt-8 block"><span className="mono-label">What would you like to automate? *</span><textarea className="field mt-2 min-h-36 resize-y" name="message" minLength={30} required placeholder="Describe the current process, the tools involved, and where it gets stuck." /></label>
      <label className="absolute -left-[9999px]" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      <div className="mt-8 min-h-16 border border-dashed border-[var(--line)] p-4 mono-meta muted">
        CLOUDFLARE TURNSTILE / ENABLED AFTER PRODUCTION KEYS ARE CONFIGURED
      </div>
      <div className="mt-6 grid grid-cols-[20px_minmax(0,1fr)] items-start gap-3">
        <input id="inquiry-consent" className="mt-1 h-5 w-5 accent-[var(--accent)]" type="checkbox" name="consent" required />
        <div className="min-w-0">
          <p className="text-sm leading-6 ink-soft"><label htmlFor="inquiry-consent">I agree to the </label><Link href="/privacy" className="accent underline underline-offset-4">Privacy Terms and Conditions</Link><label htmlFor="inquiry-consent">.</label></p>
        </div>
      </div>
      <div className="mt-8 flex flex-wrap items-center gap-5">
        <button className="button-primary" type="submit" disabled={status === "sending"}>{status === "sending" ? "Recording inquiry…" : "Send inquiry"}</button>
        <p className={"mono-meta max-w-xl " + (status === "error" ? "text-[var(--danger)]" : status === "success" ? "accent" : "muted")} role="status" aria-live="polite">{message}</p>
      </div>
    </form>
  );
}
