import { createAppointment, getFreeSlots, GhlApiError, upsertContact } from "@/lib/ghl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TURNSTILE_TEST_SECRET = "1x0000000000000000000000000000000AA";

function currentManilaMonth() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
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

function sameOrigin(request: Request) {
  const ownOrigin = new URL(request.url).origin;
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  return origin === ownOrigin && (!fetchSite || fetchSite === "same-origin");
}

async function verifyTurnstile(token: string, request: Request) {
  const secret = process.env.NODE_ENV === "development"
    ? TURNSTILE_TEST_SECRET
    : process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) return false;
  const body = new URLSearchParams({ secret, response: token });
  const remoteIp = request.headers.get("cf-connecting-ip")
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (remoteIp) body.set("remoteip", remoteIp);
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body,
    cache: "no-store",
  });
  if (!response.ok) return false;
  const result = await response.json() as { success?: boolean; action?: string };
  return result.success === true && (!result.action || result.action === "portfolio_booking");
}

export async function GET(request: Request) {
  const month = new URL(request.url).searchParams.get("month") ?? "";
  if (!validBookingMonth(month)) {
    return Response.json({ error: "invalid_month" }, { status: 400 });
  }
  try {
    return Response.json(
      { month, slots: await getFreeSlots(month) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ error: "availability_unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return Response.json({ error: "origin_not_allowed" }, { status: 403 });
  }
  const statedLength = Number(request.headers.get("content-length") ?? "0");
  if (statedLength > 16_384) {
    return Response.json({ error: "payload_too_large" }, { status: 413 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return Response.json({ error: "invalid_payload" }, { status: 400 });
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
  if (
    firstName.length < 1 || firstName.length > 100
    || lastName.length < 1 || lastName.length > 100
    || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    || phone.length < 7 || phone.length > 30
    || company.length > 120
    || project.length < 20 || project.length > 2_000
    || body.consent !== true
    || !Number.isFinite(startTimestamp) || startTimestamp <= Date.now()
    || !turnstileToken
  ) {
    return Response.json({ error: "invalid_payload" }, { status: 400 });
  }

  if (!await verifyTurnstile(turnstileToken, request)) {
    return Response.json({ error: "security_check_failed" }, { status: 400 });
  }

  try {
    const contactId = await upsertContact({ firstName, lastName, email, phone, company });
    const appointmentId = await createAppointment({ contactId, name, project, startTime });
    return Response.json({ appointmentId }, { status: 201 });
  } catch (error) {
    if (error instanceof GhlApiError && error.status >= 400 && error.status < 500) {
      return Response.json({ error: "slot_unavailable" }, { status: 409 });
    }
    return Response.json({ error: "booking_unavailable" }, { status: 503 });
  }
}
