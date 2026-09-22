import { sendTelemetryError } from "@/lib/telemetry";
import { allowRequest, isSameOrigin, rateLimitResponse, readJsonObject, RequestBodyError } from "@/lib/request-security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "origin_not_allowed" }, { status: 403 });
  }
  if (!allowRequest(request, "telemetry", 10)) return rateLimitResponse();

  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(request, 1_024);
  } catch (error) {
    return Response.json({ error: error instanceof RequestBodyError ? error.message : "invalid_payload" },
      { status: error instanceof RequestBodyError ? error.status : 400 });
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
