"use client";

import Link from "next/link";
import Script from "next/script";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { useTheme } from "@/components/theme-controls";
import styles from "@/components/booking-calendar-preview.module.css";

type Step = "schedule" | "details" | "complete";
type MobileScheduleView = "dates" | "times";
type AvailabilityStatus = "loading" | "ready" | "error";
type BookingStatus = "idle" | "sending" | "error";
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
  }) => string;
  remove: (widgetId: string) => void;
  reset: (widgetId: string) => void;
};

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const timeZone = "Asia/Manila";
const maxMonthOffset = 11;
const turnstileSiteKey = process.env.NODE_ENV === "development"
  ? "1x00000000000000000000AA"
  : process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

function manilaMonthKey() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}`;
}

function manilaDateKey() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  return ["year", "month", "day"]
    .map((type) => parts.find((part) => part.type === type)?.value)
    .join("-");
}

function shiftMonth(value: string, amount: number) {
  const [year, month] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + amount, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthDetails(value: string) {
  const [year, month] = value.split("-").map(Number);
  return {
    label: new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" })
      .format(new Date(Date.UTC(year, month - 1, 1))),
    year,
    month: month - 1,
    days: new Date(Date.UTC(year, month, 0)).getUTCDate(),
    firstDay: new Date(Date.UTC(year, month - 1, 1)).getUTCDay(),
  };
}

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function readableDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone,
  }).format(new Date(`${value}T00:00:00+08:00`));
}

function readableDateCompact(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone,
  }).format(new Date(`${value}T00:00:00+08:00`));
}

function readableTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone,
  }).format(new Date(value));
}

function endingTime(value: string) {
  return readableTime(new Date(Date.parse(value) + 50 * 60_000).toISOString());
}

export function BookingCalendarPreview() {
  const theme = useTheme();
  const [step, setStep] = useState<Step>("schedule");
  const [monthKey, setMonthKey] = useState(manilaMonthKey);
  const [availability, setAvailability] = useState<Record<string, string[]>>({});
  const [availabilityStatus, setAvailabilityStatus] = useState<AvailabilityStatus>("loading");
  const [availabilityRetry, setAvailabilityRetry] = useState(0);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [mobileScheduleView, setMobileScheduleView] = useState<MobileScheduleView>("dates");
  const [bookingStatus, setBookingStatus] = useState<BookingStatus>("idle");
  const [bookingMessage, setBookingMessage] = useState("");
  const [scriptReady, setScriptReady] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileMessage, setTurnstileMessage] = useState("Loading security check...");
  const panelHeading = useRef<HTMLDivElement>(null);
  const timeHeading = useRef<HTMLDivElement>(null);
  const turnstileContainer = useRef<HTMLDivElement>(null);
  const turnstileRegion = useRef<HTMLDivElement>(null);
  const turnstileWidgetId = useRef<string | null>(null);
  const detailsHeading = useRef<HTMLDivElement>(null);
  const hasChangedStep = useRef(false);
  const hasChangedMobileView = useRef(false);
  const month = monthDetails(monthKey);
  const initialMonth = manilaMonthKey();
  const finalMonth = shiftMonth(initialMonth, maxMonthOffset);

  function changeMonth(amount: number) {
    setMonthKey((current) => shiftMonth(current, amount));
    setSelectedTime("");
    setMobileScheduleView("dates");
  }
  const slots = availability[selectedDate] ?? [];
  const cells = useMemo(() => [
    ...Array.from({ length: month.firstDay }, () => null),
    ...Array.from({ length: month.days }, (_, index) => index + 1),
  ], [month]);

  useEffect(() => {
    const controller = new AbortController();
    setAvailabilityStatus("loading");
    setAvailability({});
    setSelectedDate("");
    setSelectedTime("");
    fetch(`/api/booking?month=${encodeURIComponent(monthKey)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Availability request failed");
        return await response.json() as { slots?: Record<string, string[]> };
      })
      .then((response) => {
        const nextAvailability = response.slots ?? {};
        setAvailability(nextAvailability);
        setSelectedDate(Object.keys(nextAvailability).find((date) => nextAvailability[date]?.length) ?? "");
        setAvailabilityStatus("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setAvailabilityStatus("error");
      });
    return () => controller.abort();
  }, [monthKey, availabilityRetry]);

  useEffect(() => {
    if (!hasChangedStep.current) {
      hasChangedStep.current = true;
      return;
    }
    (step === "details" ? detailsHeading : panelHeading).current?.focus();
  }, [step]);

  useEffect(() => {
    if (!hasChangedMobileView.current) {
      hasChangedMobileView.current = true;
      return;
    }
    if (!window.matchMedia("(max-width: 479px)").matches) return;
    (mobileScheduleView === "times" ? timeHeading : panelHeading).current?.focus();
  }, [mobileScheduleView]);

  useEffect(() => {
    if (step !== "details" || !scriptReady || !turnstileSiteKey || !turnstileContainer.current) return;
    const turnstile = (window as Window & { turnstile?: TurnstileApi }).turnstile;
    if (!turnstile || turnstileWidgetId.current) return;
    const id = turnstile.render(turnstileContainer.current, {
      sitekey: turnstileSiteKey,
      action: "portfolio_booking",
      appearance: "always",
      size: "flexible",
      theme,
      callback: (token) => {
        setTurnstileToken(token);
        setTurnstileMessage("");
      },
      "expired-callback": () => {
        setTurnstileToken("");
        setTurnstileMessage("Security check expired. Please complete it again.");
      },
      "timeout-callback": () => {
        setTurnstileToken("");
        setTurnstileMessage("Security check timed out. Please complete it again.");
      },
      "error-callback": () => {
        setTurnstileToken("");
        setTurnstileMessage("Security check could not load. Refresh the page or try Chrome or Edge.");
      },
    });
    turnstileWidgetId.current = id;
    setTurnstileMessage("Complete the security check.");
    return () => {
      turnstile.remove(id);
      if (turnstileWidgetId.current === id) turnstileWidgetId.current = null;
    };
  }, [scriptReady, step, theme]);

  function resetTurnstile() {
    setTurnstileToken("");
    setTurnstileMessage("Complete the security check.");
    const turnstile = (window as Window & { turnstile?: TurnstileApi }).turnstile;
    if (turnstileWidgetId.current) turnstile?.reset(turnstileWidgetId.current);
  }

  function selectDate(value: string) {
    setSelectedDate(value);
    setSelectedTime("");
    setMobileScheduleView("times");
  }

  async function submitBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      firstName: String(data.get("firstName") ?? "").trim(),
      lastName: String(data.get("lastName") ?? "").trim(),
      email: String(data.get("email") ?? "").trim(),
      phone: String(data.get("phone") ?? "").trim(),
      company: String(data.get("company") ?? "").trim(),
      project: String(data.get("project") ?? "").trim(),
      website: String(data.get("website") ?? ""),
      consent: data.get("consent") === "on",
      startTime: selectedTime,
      turnstileToken,
    };
    if (!payload.firstName || !payload.lastName || !payload.email || payload.phone.length < 7 || payload.project.length < 20 || !payload.consent) {
      setBookingStatus("error");
      setBookingMessage("Complete the required fields and describe your project in at least 20 characters.");
      return;
    }
    if (!turnstileSiteKey || !payload.turnstileToken) {
      setBookingStatus("error");
      setBookingMessage("Complete the security check, then try again.");
      turnstileRegion.current?.focus();
      return;
    }
    setBookingStatus("sending");
    setBookingMessage("Booking your discovery call...");
    try {
      const response = await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        if (result.error === "slot_unavailable") {
          setStep("schedule");
          setSelectedTime("");
          setAvailabilityRetry((value) => value + 1);
          throw new Error("That time is no longer available. Choose another available time.");
        }
        if (result.error === "security_check_failed") throw new Error("The security check expired. Complete it again and retry.");
        throw new Error("The booking could not be completed. Please try again shortly.");
      }
      form.reset();
      setBookingStatus("idle");
      setBookingMessage("");
      setStep("complete");
    } catch (error) {
      setBookingStatus("error");
      setBookingMessage(error instanceof Error ? error.message : "The booking could not be completed. Please try again shortly.");
    } finally {
      resetTurnstile();
    }
  }

  function reset() {
    setStep("schedule");
    setSelectedTime("");
    setMobileScheduleView("dates");
    setBookingStatus("idle");
    setBookingMessage("");
  }

  return (
    <section className={styles.shell} aria-label="Book a discovery call">
      {turnstileSiteKey ? (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          strategy="afterInteractive"
          onLoad={() => setScriptReady(true)}
          onReady={() => setScriptReady(true)}
          onError={() => setTurnstileMessage("Security check could not load. Refresh the page or try Chrome or Edge.")}
        />
      ) : null}
      <div className={styles.header}>
        <p className="mono-meta accent">50 minutes · Google Meet · GMT+8</p>
        <div className={styles.steps} aria-label="Booking progress">
          <span className={`mono-meta ${styles.step} ${step === "schedule" ? styles.stepActive : ""}`}>01 Schedule</span>
          <span className={`mono-meta ${styles.step} ${step === "details" ? styles.stepActive : ""}`}>02 Details</span>
          <span className={`mono-meta ${styles.step} ${step === "complete" ? styles.stepActive : ""}`}>03 Confirm</span>
        </div>
      </div>
      {step === "schedule" && bookingStatus === "error" && bookingMessage ? <p className={styles.bookingError} role="alert">{bookingMessage}</p> : null}

      {step === "schedule" ? (
        <div className={`${styles.panel} ${styles.scheduleGrid} ${mobileScheduleView === "dates" ? styles.scheduleGridDates : styles.scheduleGridTimes}`} key={`schedule-${month.label}`} aria-busy={availabilityStatus === "loading"}>
          <div className={styles.calendarPane}>
            <div className={styles.monthBar}>
              <div ref={panelHeading} tabIndex={-1}>
                <p className="mono-label">Select a date</p>
                <p className="public-card-title mt-2">{month.label}</p>
              </div>
              <div className={styles.monthControls}>
                <button className={styles.iconButton} type="button" onClick={() => changeMonth(-1)} disabled={monthKey <= initialMonth || availabilityStatus === "loading"} aria-label="Previous month"><Icon name="arrow" /></button>
                <button className={styles.iconButton} type="button" onClick={() => changeMonth(1)} disabled={monthKey >= finalMonth || availabilityStatus === "loading"} aria-label="Next month"><Icon name="arrow" /></button>
              </div>
            </div>
            <div className={styles.weekdayGrid} aria-hidden="true">
              {weekdays.map((day) => <span className="mono-meta" key={day}>{day}</span>)}
            </div>
            <div className={styles.dateGrid} aria-label={month.label}>
              {cells.map((day, index) => {
                if (!day) return <span className={styles.dateCell} key={`empty-${index}`} aria-hidden="true" />;
                const key = dateKey(month.year, month.month, day);
                const available = Boolean(availability[key]?.length);
                const selected = key === selectedDate;
                return (
                  <button
                    className={`${styles.dateCell} ${available ? styles.dateAvailable : ""} ${selected ? styles.dateSelected : ""} ${key === manilaDateKey() ? styles.dateToday : ""}`}
                    type="button"
                    disabled={!available}
                    onClick={() => selectDate(key)}
                    aria-pressed={selected}
                    aria-label={`${readableDate(key)}${available ? ", available" : ", unavailable"}`}
                    key={key}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
            {availabilityStatus === "loading" ? <p className={styles.availabilityMessage} role="status">Loading available times...</p> : null}
            {availabilityStatus === "error" ? (
              <div className={styles.availabilityMessage} role="alert">
                <p>Availability could not load.</p>
                <button className="button-text mt-3" type="button" onClick={() => setAvailabilityRetry((value) => value + 1)}>Try again</button>
              </div>
            ) : null}
            {availabilityStatus === "ready" && !selectedDate ? <p className={styles.availabilityMessage} role="status">No available times this month. Try the next month.</p> : null}
            <p className={`mono-meta muted ${styles.timezone}`}>Times shown in Asia/Manila (GMT+8).</p>
          </div>

          <div className={styles.timePane}>
            <button className={`button-text ${styles.mobileBack}`} type="button" onClick={() => { setSelectedTime(""); setMobileScheduleView("dates"); }}>
              <Icon name="arrow" /> Back to dates
            </button>
            <div className={styles.selectionBar}>
              <div ref={timeHeading} tabIndex={-1}>
                <p className="mono-label">Available times</p>
                <p className="public-body mt-2">{selectedDate ? readableDate(selectedDate) : "Choose an available date"}</p>
              </div>
            </div>
            <div className={styles.timeList} aria-label="Available appointment times">
              {slots.map((slot) => (
                <button
                  className={`${styles.timeButton} ${selectedTime === slot ? styles.timeSelected : ""}`}
                  type="button"
                  onClick={() => setSelectedTime(slot)}
                  aria-pressed={selectedTime === slot}
                  key={slot}
                >
                  {readableTime(slot)}
                </button>
              ))}
            </div>
            <button className={`button-primary ${styles.continueButton}`} type="button" disabled={!selectedTime} onClick={() => setStep("details")}>
              Continue to your details <Icon name="arrow" className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}

      {step === "details" ? (
        <div className={`${styles.panel} ${styles.detailsGrid}`} key="details">
          <aside className={styles.summaryPane} aria-label="Selected appointment">
            <div className={styles.summaryHeading} ref={detailsHeading} tabIndex={-1}>
              <button className={`${styles.iconButton} ${styles.detailsBack}`} type="button" onClick={() => setStep("schedule")} aria-label="Back to schedule" title="Back to schedule">
                <Icon name="arrow" />
              </button>
              <p className="mono-label">Your selection</p>
            </div>
            <div className={styles.summaryList}>
              <div className={styles.summaryItem}><p className="mono-meta muted">Date</p><p className="public-body mt-2">{readableDateCompact(selectedDate)}</p></div>
              <div className={styles.summaryItem}><p className="mono-meta muted">Time</p><p className="public-body mt-2">{readableTime(selectedTime)} – {endingTime(selectedTime)}</p></div>
              <div className={styles.summaryItem}><p className="mono-meta muted">Format</p><p className="public-body mt-2">50-minute Google Meet call</p></div>
            </div>
          </aside>

          <form className={styles.formPane} onSubmit={submitBooking} aria-busy={bookingStatus === "sending"}>
            <div>
              <p className="mono-label">Your details</p>
              <h4 className="public-card-title mt-3">Tell me enough to prepare.</h4>
            </div>
            <div className={`${styles.formGrid} mt-7`}>
              <label><span className="mono-label">First name *</span><input className="field mt-2" name="firstName" autoComplete="given-name" maxLength={100} required /></label>
              <label><span className="mono-label">Last name *</span><input className="field mt-2" name="lastName" autoComplete="family-name" maxLength={100} required /></label>
              <label><span className="mono-label">Email *</span><input className="field mt-2" name="email" type="email" autoComplete="email" maxLength={254} required /></label>
              <label><span className="mono-label">Phone *</span><input className="field mt-2" name="phone" type="tel" autoComplete="tel" maxLength={30} required /></label>
              <label className={styles.fullField}><span className="mono-label">Company</span><input className="field mt-2" name="company" autoComplete="organization" maxLength={120} /></label>
              <label className={styles.fullField}><span className="mono-label">What process would you like to improve? *</span><textarea className="field mt-2 min-h-28 resize-y" name="project" minLength={20} maxLength={2000} required placeholder="Briefly describe the workflow, tools, and desired outcome." /></label>
            </div>
            <label className={styles.honeypot} aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
            {turnstileSiteKey ? (
              <div ref={turnstileRegion} className={styles.securityCheck} tabIndex={-1} aria-label="Security check">
                <p className="mono-label">Security check</p>
                <div ref={turnstileContainer} className={styles.turnstile} />
                <p className="mono-meta muted" role="status" aria-live="polite">{turnstileMessage}</p>
              </div>
            ) : <p ref={turnstileRegion} className={styles.bookingError} tabIndex={-1} role="alert">Security check is not configured.</p>}
            <label className={styles.consent}>
              <input name="consent" type="checkbox" required />
              <span className="public-body">I agree to receive confirmations, reminders, and follow-up messages related to this call and accept the <Link href="/privacy" className="accent underline underline-offset-4">Privacy Terms and Conditions</Link>.</span>
            </label>
            <div className={styles.actions}>
              <p className={bookingStatus === "error" ? styles.bookingError : styles.bookingStatus} role={bookingStatus === "error" ? "alert" : "status"} aria-live="polite">{bookingMessage}</p>
              <button className="button-primary" type="submit" disabled={bookingStatus === "sending"}>{bookingStatus === "sending" ? "Booking your call..." : "Book a call"} <Icon name="arrow" className="h-4 w-4" /></button>
            </div>
          </form>
        </div>
      ) : null}

      {step === "complete" ? (
        <div className={`${styles.panel} ${styles.completePane}`} key="complete" role="status">
          <div className={styles.completeCopy} ref={panelHeading} tabIndex={-1}>
            <p className="mono-meta accent">Booking confirmed</p>
            <h4 className="public-section-title mt-4">Your discovery call is booked.</h4>
            <p className="public-body mt-4">A confirmation email with the meeting details has been sent to you. You’ll also receive reminders before the call.</p>
          </div>
          <dl className={styles.completeSummary} aria-label="Confirmed appointment details">
            <div className={styles.completeSummaryItem}><dt className="mono-meta muted">Date</dt><dd className="public-body">{readableDate(selectedDate)}</dd></div>
            <div className={styles.completeSummaryItem}><dt className="mono-meta muted">Time</dt><dd className="public-body">{readableTime(selectedTime)} – {endingTime(selectedTime)}</dd></div>
            <div className={styles.completeSummaryItem}><dt className="mono-meta muted">Format</dt><dd className="public-body">Google Meet · 50 minutes</dd></div>
          </dl>
          <button className={`button-text ${styles.completeAction}`} type="button" onClick={reset}>Book another time <Icon name="arrow" className="h-4 w-4" /></button>
        </div>
      ) : null}
    </section>
  );
}
