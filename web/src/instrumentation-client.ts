const reported = new Set<string>();

function report(name: string, digest?: string) {
  const payload = {
    name: name.slice(0, 100),
    digest: digest?.slice(0, 100),
    path: window.location.pathname.slice(0, 500),
  };
  const key = JSON.stringify(payload);
  if (reported.has(key)) return;
  reported.add(key);
  void fetch("/api/client-errors", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: key,
    keepalive: true,
  }).catch(() => undefined);
}

try {
  window.addEventListener("error", (event) => {
    const error = event.error;
    report(error instanceof Error ? error.name : "Error");
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    report(reason instanceof Error ? reason.name : "UnhandledRejection");
  });
} catch {
  // Monitoring must never make the portfolio fail.
}
