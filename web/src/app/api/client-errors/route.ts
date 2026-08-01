import { sendTelemetryError } from "@/lib/telemetry";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const ownOrigin = new URL(request.url).origin;
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (origin !== ownOrigin || (fetchSite && fetchSite !== "same-origin")) {
    return Response.json({ error: "origin_not_allowed" }, { status: 403 });
  }
  const statedLength = Number(request.headers.get("content-length") ?? "0");
  if (statedLength > 1_024) {
    return Response.json({ error: "payload_too_large" }, { status: 413 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return Response.json({ error: "invalid_payload" }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name : "";
  const digest = typeof body.digest === "string" ? body.digest : undefined;
  const path = typeof body.path === "string" ? body.path : "";
  if (
    !name ||
    name.length > 100 ||
    (digest && digest.length > 100) ||
    !path.startsWith("/") ||
    path.length > 500 ||
    path.includes("?") ||
    path.includes("#")
  ) {
    return Response.json({ error: "invalid_payload" }, { status: 400 });
  }

  await sendTelemetryError("browser_runtime_error", { name, digest, path });
  return new Response(null, { status: 204 });
}
