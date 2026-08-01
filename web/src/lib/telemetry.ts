type ErrorKind = "browser_runtime_error" | "server_runtime_error";

export async function sendTelemetryError(
  kind: ErrorKind,
  context: Record<string, string | undefined>,
) {
  const endpoint = process.env.BETTER_STACK_INGESTING_URL?.trim();
  const token = process.env.BETTER_STACK_SOURCE_TOKEN?.trim();
  if (!endpoint || !token) return;

  const url = new URL(endpoint);
  if (url.protocol !== "https:") return;
  await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      dt: new Date().toISOString(),
      level: "error",
      message: kind,
      context,
    }),
    signal: AbortSignal.timeout(5_000),
  }).catch(() => undefined);
}
