import type { Instrumentation } from "next";
import { sendTelemetryError } from "@/lib/telemetry";

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  const path = request.path.split(/[?#]/, 1)[0].slice(0, 500);
  const captured = error instanceof Error ? error : new Error("Unknown server error");
  const digest =
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof error.digest === "string"
      ? error.digest
      : undefined;
  await sendTelemetryError("server_runtime_error", {
    name: captured.name.slice(0, 100),
    digest: digest?.slice(0, 100),
    method: request.method.slice(0, 10),
    path,
    route: context.routePath.slice(0, 500),
    routeType: context.routeType,
  });
};
