import { createHash } from "node:crypto";

export class RequestBodyError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export function isSameOrigin(request: Request) {
  const fetchSite = request.headers.get("sec-fetch-site");
  const origin = request.headers.get("origin");
  if (!origin || (fetchSite && fetchSite !== "same-origin")) return false;
  try {
    const parsed = new URL(origin);
    const target = new URL(request.url);
    // Next may reconstruct request.url with localhost behind a proxy; Host is the browser target.
    return parsed.origin === origin && parsed.protocol === target.protocol
      && parsed.host === (request.headers.get("host") ?? target.host);
  } catch {
    return false;
  }
}

export async function readBoundedText(request: Request, limit: number) {
  if (Number(request.headers.get("content-length")) > limit) {
    throw new RequestBodyError(413, "payload_too_large");
  }
  const reader = request.body?.getReader();
  if (!reader) throw new RequestBodyError(400, "invalid_payload");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        void reader.cancel().catch(() => undefined);
        throw new RequestBodyError(413, "payload_too_large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function readJsonObject(request: Request, limit: number) {
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
    throw new RequestBodyError(415, "unsupported_media_type");
  }
  const value: unknown = JSON.parse(await readBoundedText(request, limit));
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new RequestBodyError(400, "invalid_payload");
  }
  return value as Record<string, unknown>;
}

// ponytail: per-instance burst protection; use an edge/distributed limiter for coordinated abuse.
const attempts = new Map<string, { count: number; expires: number }>();
export function allowRequest(request: Request, bucket: string, limit: number, windowMs = 60_000) {
  const now = Date.now();
  for (const [key, entry] of attempts) if (entry.expires <= now) attempts.delete(key);
  // Vercel overwrites x-forwarded-for at its trusted edge. Never trust cf-connecting-ip here.
  const ip = process.env.VERCEL === "1"
    ? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
    : "local";
  const key = createHash("sha256").update(`${bucket}:${ip}`).digest("hex");
  const entry = attempts.get(key);
  if (entry) return ++entry.count <= limit;
  if (attempts.size >= 2_048) return false;
  attempts.set(key, { count: 1, expires: now + windowMs });
  return true;
}

export function rateLimitResponse() {
  return Response.json({ error: "too_many_requests" }, {
    status: 429,
    headers: { "Retry-After": "60", "Cache-Control": "no-store" },
  });
}
