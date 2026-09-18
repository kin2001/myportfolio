"use client";

import Link from "next/link";
import Script from "next/script";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useTheme } from "@/components/theme-controls";

type FormStatus = "idle" | "sending" | "success" | "error";
type TurnstileApi = {
  render: (container: HTMLElement, options: {
    sitekey: string;
    action: string;
    appearance: "always";
    size: "flexible";
    theme: "light" | "dark";
    callback: (token: string) => void;
    "expired-callback": () => void;
    "timeout-callback": () => void;
    "error-callback": () => void;
    "unsupported-callback": () => void;
  }) => string;
  remove: (widgetId: string) => void;
  reset: (widgetId: string) => void;
};

declare global {
  interface Window { turnstile?: TurnstileApi }
}

const turnstileSiteKey = process.env.NODE_ENV === "development"
  ? "1x00000000000000000000AA"
  : process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
const initialTurnstileMessage = !turnstileSiteKey
  ? "Security check is not configured."
  : process.env.NODE_ENV === "development"
    ? "Loading security check... If this remains here, allow challenges.cloudflare.com or open the page in Chrome or Edge."
    : "Loading security check...";
const turnstileLoadErrorMessage = process.env.NODE_ENV === "development"
  ? "This preview browser blocked the security check. Open this page in Chrome or Edge."
  : "Security check could not load. Check your connection or refresh the page.";

export function ContactForm() {
  const theme = useTheme();
  const [status, setStatus] = useState<FormStatus>("idle");
  const [message, setMessage] = useState("");
  const [scriptReady, setScriptReady] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileError, setTurnstileError] = useState(false);
  const [turnstileMessage, setTurnstileMessage] = useState(initialTurnstileMessage);
  const turnstileContainer = useRef<HTMLDivElement>(null);
  const turnstileRegion = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    if (!scriptReady || !turnstileSiteKey || !turnstileContainer.current || !window.turnstile || widgetId.current) return;
    const turnstile = window.turnstile;
    setTurnstileToken("");
    setTurnstileError(false);
    const id = window.turnstile.render(turnstileContainer.current, {
      sitekey: turnstileSiteKey,
      action: "contact_inquiry",
      appearance: "always",
      size: "flexible",
      theme,
      callback: (token) => {
        setTurnstileToken(token);
        setTurnstileError(false);
        setTurnstileMessage("");
      },
      "expired-callback": () => {
        setTurnstileToken("");
        setTurnstileError(true);
        setTurnstileMessage("Security check expired and is refreshing. Please try again.");
      },
      "timeout-callback": () => {
        setTurnstileToken("");
        setTurnstileError(true);
        setTurnstileMessage("Security check timed out and is refreshing. Please try again.");
      },
      "error-callback": () => {
        setTurnstileToken("");
        setTurnstileError(true);
        setTurnstileMessage(turnstileLoadErrorMessage);
      },
      "unsupported-callback": () => {
        setTurnstileToken("");
        setTurnstileError(true);
        setTurnstileMessage("This browser cannot complete the security check. Try Chrome or Edge.");
      },
    });
    widgetId.current = id;
    setTurnstileMessage("Complete the security check.");
    return () => {
      turnstile.remove(id);
      if (widgetId.current === id) widgetId.current = null;
    };
  }, [scriptReady, theme]);

  function resetTurnstile() {
    setTurnstileToken("");
    setTurnstileError(false);
    setTurnstileMessage("Refreshing security check...");
    if (widgetId.current) window.turnstile?.reset(widgetId.current);
  }

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
      turnstile_token: turnstileToken,
    };
    if (!payload.name || !payload.email || !payload.project_type || payload.message.length < 30 || !payload.consent) {
      setStatus("error");
      setMessage("Complete the required fields and describe the workflow in at least 30 characters.");
      return;
    }
    if (!turnstileSiteKey) {
      setStatus("error");
      setMessage("The security check is not configured, so your message has not been sent.");
      turnstileRegion.current?.focus();
      return;
    }
    if (!payload.turnstile_token) {
      setStatus("error");
      setMessage("Complete the security check, then try again.");
      turnstileRegion.current?.focus();
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
    } finally {
      resetTurnstile();
    }
  }

  return (
    <form onSubmit={submit} className="module p-7 md:p-10" data-phone-compact="contact-form" noValidate>
      <div className="grid gap-8 md:grid-cols-2" data-phone-layout="form-grid">
        <label className="block"><span className="mono-label">Name *</span><input className="field mt-2" name="name" autoComplete="name" required /></label>
        <label className="block"><span className="mono-label">Email *</span><input className="field mt-2" name="email" type="email" autoComplete="email" required /></label>
        <label className="block"><span className="mono-label">Company</span><input className="field mt-2" name="company" autoComplete="organization" /></label>
        <label className="block"><span className="mono-label">Project type *</span><select className="field mt-2" name="project_type" defaultValue="" required><option value="" disabled>Select one</option><option>Workflow automation</option><option>AI-assisted operation</option><option>Systems integration</option><option>Automation audit</option><option>Other</option></select></label>
      </div>
      <label className="mt-8 block"><span className="mono-label">What would you like to automate? *</span><textarea className="field mt-2 min-h-36 resize-y" name="message" minLength={30} required placeholder="Describe the current process, the tools involved, and where it gets stuck." /></label>
      <label className="absolute -left-[9999px]" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      {turnstileSiteKey ? <>
        <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onReady={() => setScriptReady(true)} onError={() => {
          setTurnstileError(true);
          setTurnstileMessage(turnstileLoadErrorMessage);
        }} />
        <div ref={turnstileRegion} className="mt-8 w-full max-w-[420px]" tabIndex={-1} aria-label="Security check">
          <p className="mono-label">Security check</p>
          <div ref={turnstileContainer} className={"mt-3 w-full min-w-0 " + (turnstileError ? "min-h-0" : "min-h-[65px]")} />
          <p className={"mono-meta mt-3 " + (turnstileError ? "border border-[var(--line)] p-4 text-[var(--danger)]" : "muted")} role={turnstileError ? "alert" : "status"} aria-live="polite">{turnstileMessage}</p>
        </div>
      </> : <div ref={turnstileRegion} className="mt-8 min-h-16 border border-dashed border-[var(--line)] p-4 mono-meta text-[var(--danger)]" tabIndex={-1} role="alert">TURNSTILE / NOT CONFIGURED</div>}
      <div className="mt-6 grid grid-cols-[20px_minmax(0,1fr)] items-start gap-3 pl-3">
        <input id="inquiry-consent" className="mt-1 h-5 w-5 accent-[var(--accent)]" type="checkbox" name="consent" required />
        <div className="min-w-0">
          <p className="public-body"><label htmlFor="inquiry-consent">I agree to the </label><Link href="/privacy" className="accent underline underline-offset-4">Privacy Terms and Conditions</Link><label htmlFor="inquiry-consent">.</label></p>
        </div>
      </div>
      <div className="mt-8 flex flex-wrap items-center gap-5">
        <button className="button-primary" type="submit" disabled={status === "sending"}>{status === "sending" ? "Recording inquiry..." : "Send inquiry"}</button>
        <p className={"mono-meta max-w-xl " + (status === "error" ? "text-[var(--danger)]" : status === "success" ? "accent" : "muted")} role="status" aria-live="polite">{message}</p>
      </div>
    </form>
  );
}
