import type { NextRequest } from "next/server";

export function getRequestOrigin(request: NextRequest) {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host");
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProtocol === "https" || new URL(request.url).protocol === "https:"
    ? "https"
    : "http";

  return host && !/[\s/@?#]/.test(host) ? `${protocol}://${host}` : new URL(request.url).origin;
}
