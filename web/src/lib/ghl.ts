import "server-only";

const GHL_API_URL = "https://services.leadconnectorhq.com";

type FreeSlotsResponse = Record<string, { slots?: unknown }>;

type ContactResponse = {
  contact?: { id?: string };
};

type AppointmentResponse = {
  id?: string;
};

export class GhlApiError extends Error {
  constructor(readonly status: number) {
    super("GHL request failed");
  }
}

function getGhlConfig() {
  const token = process.env.GHL_PRIVATE_INTEGRATION_TOKEN?.trim();
  const locationId = process.env.GHL_LOCATION_ID?.trim();
  const calendarId = process.env.GHL_CALENDAR_ID?.trim();
  if (!token || !locationId || !calendarId) throw new Error("GHL is not configured");
  return { token, locationId, calendarId };
}

async function ghlRequest<T>(path: string, init?: RequestInit) {
  const { token } = getGhlConfig();
  const response = await fetch(`${GHL_API_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      Version: "v3",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) throw new GhlApiError(response.status);
  return await response.json() as T;
}

export function getMonthRange(month: string) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
  if (!match) return null;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const nextMonthIndex = (monthIndex + 1) % 12;
  const nextYear = year + (monthIndex === 11 ? 1 : 0);
  const startDate = Date.parse(`${month}-01T00:00:00+08:00`);
  const nextMonth = `${nextYear}-${String(nextMonthIndex + 1).padStart(2, "0")}-01T00:00:00+08:00`;
  return { startDate, endDate: Date.parse(nextMonth) - 1 };
}

export async function getFreeSlots(month: string) {
  const range = getMonthRange(month);
  if (!range) throw new Error("Invalid month");
  const { calendarId } = getGhlConfig();
  const query = new URLSearchParams({
    startDate: String(range.startDate),
    endDate: String(range.endDate),
    timezone: "Asia/Manila",
  });
  const response = await ghlRequest<FreeSlotsResponse>(
    `/calendars/${encodeURIComponent(calendarId)}/free-slots?${query}`,
  );

  return Object.fromEntries(
    Object.entries(response)
      .filter(([date]) => /^\d{4}-\d{2}-\d{2}$/.test(date))
      .map(([date, value]) => [
        date,
        Array.isArray(value?.slots)
          ? value.slots.filter((slot): slot is string => typeof slot === "string" && Number.isFinite(Date.parse(slot)))
          : [],
      ]),
  );
}

export async function upsertContact(input: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
}) {
  const { locationId } = getGhlConfig();
  const response = await ghlRequest<ContactResponse>("/contacts/upsert", {
    method: "POST",
    body: JSON.stringify({
      locationId,
      firstName: input.firstName,
      lastName: input.lastName,
      name: `${input.firstName} ${input.lastName}`,
      email: input.email,
      phone: input.phone,
      companyName: input.company || undefined,
      timezone: "Asia/Manila",
      source: "Portfolio website",
    }),
  });
  if (!response.contact?.id) throw new Error("GHL contact response was incomplete");
  return response.contact.id;
}

export async function createAppointment(input: {
  contactId: string;
  name: string;
  project: string;
  startTime: string;
}) {
  const { calendarId, locationId } = getGhlConfig();
  const response = await ghlRequest<AppointmentResponse>("/calendars/events/appointments", {
    method: "POST",
    body: JSON.stringify({
      title: `${input.name} — Discovery Call`,
      description: input.project,
      appointmentStatus: "confirmed",
      calendarId,
      locationId,
      contactId: input.contactId,
      startTime: input.startTime,
      ignoreDateRange: false,
      ignoreFreeSlotValidation: false,
      toNotify: true,
    }),
  });
  if (!response.id) throw new Error("GHL appointment response was incomplete");
  return response.id;
}
