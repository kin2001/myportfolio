import { createAppointment, getFreeSlots, GhlApiError, getOrCreateContact } from "@/lib/ghl";
import { allowRequest, isSameOrigin, rateLimitResponse, readJsonObject, RequestBodyError } from "@/lib/request-security";

export const runtime = "nodejs";

const TURNSTILE_TEST_SECRET = "1x0000000000000000000000000000000AA";

function currentManilaMonth(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return `${year}-${month}`;
}

function monthIndex(month: string) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
  return match ? Number(match[1]) * 12 + Number(match[2]) - 1 : null;
}

function validBookingMonth(month: string) {
  const requested = monthIndex(month);
  const current = monthIndex(currentManilaMonth());
  return requested !== null && current !== null && requested >= current && requested <= current + 11;
}

async function verifyTurnstile(token: string, request: Request) {
  const secret = process.env.NODE_ENV === "development"
    ? TURNSTILE_TEST_SECRET
    : process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret || (process.env.NODE_ENV !== "development" && /^\dx0{10,}/.test(secret))) return false;
  const body = new URLSearchParams({ secret, response: token });
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return false;
    const result = await response.json() as { success?: boolean; action?: string; hostname?: string };
    if (process.env.NODE_ENV === "development") return result.success === true;
    const expectedHost = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "").hostname;
    return result.success === true && result.action === "portfolio_booking"
      && result.hostname === expectedHost && new URL(request.headers.get("origin") ?? "").hostname === expectedHost;
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  if (!allowRequest(request, "availability", 60)) return rateLimitResponse();
  const month = new URL(request.url).searchParams.get("month") ?? "";
  if (!validBookingMonth(month)) {
    return Response.json({ error: "invalid_month" }, { status: 400 });
  }
  try {
    return Response.json(
      { month, slots: await getFreeSlots(month, 30) },
      { headers: { "Cache-Control": "public, max-age=0, s-maxage=30" } },
    );
  } catch {
    return Response.json({ error: "availability_unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "origin_not_allowed" }, { status: 403 });
  }
  if (!allowRequest(request, "booking", 10)) return rateLimitResponse();

  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(request, 16_384);
  } catch (error) {
    return Response.json({ error: error instanceof RequestBodyError ? error.message : "invalid_payload" },
      { status: error instanceof RequestBodyError ? error.status : 400 });
  }

  const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
  const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
  const name = `${firstName} ${lastName}`;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const company = typeof body.company === "string" ? body.company.trim() : "";
  const project = typeof body.project === "string" ? body.project.trim() : "";
  const startTime = typeof body.startTime === "string" ? body.startTime.trim() : "";
  const turnstileToken = typeof body.turnstileToken === "string" ? body.turnstileToken : "";
  const honeypot = typeof body.website === "string" ? body.website : "";
  if (honeypot) return new Response(null, { status: 204 });

  const startTimestamp = Date.parse(startTime);
  const bookingMonth = Number.isFinite(startTimestamp) ? currentManilaMonth(new Date(startTimestamp)) : "";
  if (
    firstName.length < 1 || firstName.length > 100
    || lastName.length < 1 || lastName.length > 100
    || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    || phone.length < 7 || phone.length > 30
    || company.length > 120
    || project.length < 20 || project.length > 2_000
    || body.consent !== true
    || !Number.isFinite(startTimestamp) || startTimestamp <= Date.now()
    || !turnstileToken || turnstileToken.length > 2_048
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/.test(startTime)
    || !validBookingMonth(bookingMonth)
    || [firstName, lastName, email, phone, company].some((value) => /[\u0000-\u001f\u007f<>]/.test(value))
  ) {
    return Response.json({ error: "invalid_payload" }, { status: 400 });
  }

  if (!await verifyTurnstile(turnstileToken, request)) {
    return Response.json({ error: "security_check_failed" }, { status: 400 });
  }

  try {
    // Recheck uncached availability before touching CRM contact data.
    const slots = await getFreeSlots(bookingMonth);
    if (!Object.values(slots).some((times) => times.some((time) => Date.parse(time) === startTimestamp))) {
      return Response.json({ error: "slot_unavailable" }, { status: 409 });
    }
    const contactId = await getOrCreateContact({ firstName, lastName, email, phone, company });
    const appointmentId = await createAppointment({ contactId, name, project, startTime });
    return Response.json({ appointmentId }, { status: 201 });
  } catch (error) {
    if (error instanceof GhlApiError && [400, 409, 422].includes(error.status)) {
      return Response.json({ error: "slot_unavailable" }, { status: 409 });
    }
    return Response.json({ error: "booking_unavailable" }, { status: 503 });
  }
}
