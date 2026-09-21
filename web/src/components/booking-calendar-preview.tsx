"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import styles from "@/components/booking-calendar-preview.module.css";

type Step = "schedule" | "details" | "complete";
type MobileScheduleView = "dates" | "times";

const months = [
  { label: "September 2026", year: 2026, month: 8, days: 30, firstDay: 2 },
  { label: "October 2026", year: 2026, month: 9, days: 31, firstDay: 4 },
] as const;

const availability: Record<string, string[]> = {
  "2026-09-23": ["09:00 AM", "10:00 AM", "01:00 PM", "02:00 PM", "03:00 PM"],
  "2026-09-24": ["09:00 AM", "10:00 AM", "01:00 PM", "03:00 PM"],
  "2026-09-25": ["09:00 AM", "01:00 PM", "02:00 PM", "04:00 PM"],
  "2026-09-26": ["10:00 AM", "01:00 PM", "02:00 PM"],
  "2026-09-28": ["09:00 AM", "10:00 AM", "01:00 PM", "02:00 PM"],
  "2026-09-29": ["09:00 AM", "01:00 PM", "03:00 PM", "04:00 PM"],
  "2026-09-30": ["10:00 AM", "01:00 PM", "02:00 PM", "03:00 PM"],
  "2026-10-01": ["09:00 AM", "10:00 AM", "01:00 PM", "02:00 PM"],
  "2026-10-02": ["09:00 AM", "01:00 PM", "02:00 PM", "04:00 PM"],
  "2026-10-03": ["10:00 AM", "01:00 PM", "03:00 PM"],
  "2026-10-05": ["09:00 AM", "10:00 AM", "01:00 PM", "02:00 PM"],
  "2026-10-06": ["09:00 AM", "01:00 PM", "02:00 PM", "03:00 PM"],
};

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function readableDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(new Date(`${value}T00:00:00+08:00`));
}

function endTime(value: string) {
  const match = /^(\d{2}):(\d{2}) (AM|PM)$/.exec(value);
  if (!match) return value;
  let hour = Number(match[1]) % 12;
  if (match[3] === "PM") hour += 12;
  const totalMinutes = hour * 60 + Number(match[2]) + 50;
  const endHour = Math.floor(totalMinutes / 60) % 24;
  const endMinute = totalMinutes % 60;
  return `${String(endHour % 12 || 12).padStart(2, "0")}:${String(endMinute).padStart(2, "0")} ${endHour >= 12 ? "PM" : "AM"}`;
}

export function BookingCalendarPreview() {
  const [step, setStep] = useState<Step>("schedule");
  const [monthIndex, setMonthIndex] = useState(0);
  const [selectedDate, setSelectedDate] = useState("2026-09-23");
  const [selectedTime, setSelectedTime] = useState("");
  const [mobileScheduleView, setMobileScheduleView] = useState<MobileScheduleView>("dates");
  const panelHeading = useRef<HTMLDivElement>(null);
  const timeHeading = useRef<HTMLDivElement>(null);
  const hasChangedStep = useRef(false);
  const hasChangedMobileView = useRef(false);
  const month = months[monthIndex];

  function changeMonth(nextMonthIndex: number) {
    setMonthIndex(nextMonthIndex);
    setSelectedDate(nextMonthIndex === 0 ? "2026-09-23" : "2026-10-01");
    setSelectedTime("");
    setMobileScheduleView("dates");
  }
  const slots = availability[selectedDate] ?? [];
  const cells = useMemo(() => [
    ...Array.from({ length: month.firstDay }, () => null),
    ...Array.from({ length: month.days }, (_, index) => index + 1),
  ], [month]);

  useEffect(() => {
    if (!hasChangedStep.current) {
      hasChangedStep.current = true;
      return;
    }
    panelHeading.current?.focus();
  }, [step]);

  useEffect(() => {
    if (!hasChangedMobileView.current) {
      hasChangedMobileView.current = true;
      return;
    }
    if (!window.matchMedia("(max-width: 479px)").matches) return;
    (mobileScheduleView === "times" ? timeHeading : panelHeading).current?.focus();
  }, [mobileScheduleView]);

  function selectDate(value: string) {
    setSelectedDate(value);
    setSelectedTime("");
    setMobileScheduleView("times");
  }

  function submitPreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStep("complete");
  }

  function reset() {
    setStep("schedule");
    setSelectedTime("");
    setMobileScheduleView("dates");
  }

  return (
    <section className={styles.shell} aria-label="Book a discovery call">
      <div className={styles.header}>
        <p className="mono-meta accent">50 minutes · Google Meet · GMT+8</p>
        <div className={styles.steps} aria-label="Booking progress">
          <span className={`mono-meta ${styles.step} ${step === "schedule" ? styles.stepActive : ""}`}>01 Schedule</span>
          <span className={`mono-meta ${styles.step} ${step === "details" ? styles.stepActive : ""}`}>02 Details</span>
          <span className={`mono-meta ${styles.step} ${step === "complete" ? styles.stepActive : ""}`}>03 Confirm</span>
        </div>
      </div>

      {step === "schedule" ? (
        <div className={`${styles.panel} ${styles.scheduleGrid} ${mobileScheduleView === "dates" ? styles.scheduleGridDates : styles.scheduleGridTimes}`} key={`schedule-${month.label}`}>
          <div className={styles.calendarPane}>
            <div className={styles.monthBar}>
              <div ref={panelHeading} tabIndex={-1}>
                <p className="mono-label">Select a date</p>
                <p className="public-card-title mt-2">{month.label}</p>
              </div>
              <div className={styles.monthControls}>
                <button className={styles.iconButton} type="button" onClick={() => changeMonth(0)} disabled={monthIndex === 0} aria-label="Previous month"><Icon name="arrow" /></button>
                <button className={styles.iconButton} type="button" onClick={() => changeMonth(1)} disabled={monthIndex === months.length - 1} aria-label="Next month"><Icon name="arrow" /></button>
              </div>
            </div>
            <div className={styles.weekdayGrid} aria-hidden="true">
              {weekdays.map((day) => <span className="mono-meta" key={day}>{day}</span>)}
            </div>
            <div className={styles.dateGrid} aria-label={month.label}>
              {cells.map((day, index) => {
                if (!day) return <span className={styles.dateCell} key={`empty-${index}`} aria-hidden="true" />;
                const key = dateKey(month.year, month.month, day);
                const available = Boolean(availability[key]);
                const selected = key === selectedDate;
                return (
                  <button
                    className={`${styles.dateCell} ${available ? styles.dateAvailable : ""} ${selected ? styles.dateSelected : ""} ${key === "2026-09-21" ? styles.dateToday : ""}`}
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
            <p className={`mono-meta muted ${styles.timezone}`}>Times shown in Asia/Manila (GMT+8).</p>
          </div>

          <div className={styles.timePane}>
            <button className={`button-text ${styles.mobileBack}`} type="button" onClick={() => { setSelectedTime(""); setMobileScheduleView("dates"); }}>
              <Icon name="arrow" /> Back to dates
            </button>
            <div className={styles.selectionBar}>
              <div ref={timeHeading} tabIndex={-1}>
                <p className="mono-label">Available times</p>
                <p className="public-body mt-2">{readableDate(selectedDate)}</p>
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
                  {slot}
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
            <p className="mono-label">Your selection</p>
            <div className={styles.summaryList}>
              <div className={styles.summaryItem}><p className="mono-meta muted">Date</p><p className="public-body mt-2">{readableDate(selectedDate)}</p></div>
              <div className={styles.summaryItem}><p className="mono-meta muted">Time</p><p className="public-body mt-2">{selectedTime}–{endTime(selectedTime)}</p></div>
              <div className={styles.summaryItem}><p className="mono-meta muted">Format</p><p className="public-body mt-2">50-minute Google Meet call</p></div>
            </div>
            <button className="button-text mt-5" type="button" onClick={() => setStep("schedule")}>Change date or time</button>
          </aside>

          <form className={styles.formPane} onSubmit={submitPreview}>
            <div ref={panelHeading} tabIndex={-1}>
              <p className="mono-label">Your details</p>
              <h4 className="public-card-title mt-3">Tell me enough to prepare.</h4>
            </div>
            <div className={`${styles.formGrid} mt-7`}>
              <label><span className="mono-label">Full name *</span><input className="field mt-2" name="name" autoComplete="name" required /></label>
              <label><span className="mono-label">Email *</span><input className="field mt-2" name="email" type="email" autoComplete="email" required /></label>
              <label><span className="mono-label">Phone *</span><input className="field mt-2" name="phone" type="tel" autoComplete="tel" required /></label>
              <label><span className="mono-label">Company</span><input className="field mt-2" name="company" autoComplete="organization" /></label>
              <label className={styles.fullField}><span className="mono-label">What process would you like to improve? *</span><textarea className="field mt-2 min-h-28 resize-y" name="project" minLength={20} required placeholder="Briefly describe the workflow, tools, and desired outcome." /></label>
            </div>
            <label className={styles.consent}>
              <input type="checkbox" required />
              <span className="public-body">I agree to receive confirmations, reminders, and follow-up messages related to this call and accept the <Link href="/privacy" className="accent underline underline-offset-4">Privacy Terms and Conditions</Link>.</span>
            </label>
            <p className={`mono-meta ${styles.securityNote}`}>Preview mode — the security check and live GHL booking connection are added in the next phase.</p>
            <div className={styles.actions}>
              <button className="button-primary" type="submit">Preview confirmation <Icon name="arrow" className="h-4 w-4" /></button>
              <button className="button-text" type="button" onClick={() => setStep("schedule")}>Back to schedule</button>
            </div>
          </form>
        </div>
      ) : null}

      {step === "complete" ? (
        <div className={`${styles.panel} ${styles.completePane}`} key="complete" role="status">
          <div className={styles.completeCopy} ref={panelHeading} tabIndex={-1}>
            <p className="mono-meta accent">Visual flow complete</p>
            <h4 className="public-section-title mt-4">The interface is ready for the GHL connection.</h4>
            <p className="public-body mt-4">No appointment was created. The next phase will replace preview availability with live GHL slots and connect the final booking action.</p>
            <button className="button-secondary mt-7" type="button" onClick={reset}>Review the flow again</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
