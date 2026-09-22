import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { readBoundedText, RequestBodyError } from "@/lib/request-security";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 16 * 1024;
const SIGNATURE_WINDOW_SECONDS = 5 * 60;
const SHA = /^[0-9a-f]{40}$/i;
const DEPLOYMENT_ID = /^dpl_[A-Za-z0-9]+$/;
const PROJECT_ID = /^prj_[A-Za-z0-9]+$/;
const RUN_ID = /^\d+$/;
const FAILURE_CATEGORIES = [
  "application_error",
  "browser_console_error",
  "browser_navigation_error",
  "browser_page_error",
  "browser_unavailable",
  "http_error",
  "request_error",
  "request_timeout",
] as const;
const BODY_KEYS = new Set([
  "version",
  "deploymentId",
  "projectId",
  "deploymentUrl",
  "gitSha",
  "runId",
  "runNumber",
  "runUrl",
  "status",
  "checkedAt",
  "pagesChecked",
  "brokenCount",
  "failureCounts",
]);

type FailureCategory = (typeof FAILURE_CATEGORIES)[number];
type FailureCounts = Partial<Record<FailureCategory, number>>;

type CheckBody = {
  version: 1;
  deploymentId: string;
  projectId: string;
  deploymentUrl: string;
  gitSha: string;
  runId: string;
  runNumber: number;
  runUrl: string;
  status: "running" | "success" | "failure";
  checkedAt: string;
  pagesChecked: number;
  brokenCount: number;
  failureCounts: FailureCounts;
};

function error(code: string, status: number) {
  return Response.json(
    { error: code },
    {
      status,
      headers: {
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    },
  );
}

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function boundedString(value: unknown, max: number) {
  return typeof value === "string" && value.length > 0 && value.length <= max;
}

function safeUrl(value: unknown) {
  if (!boundedString(value, 2048)) return null;
  try {
    const url = new URL(value as string);
    return url.protocol === "https:" && !url.username && !url.password ? url : null;
  } catch {
    return null;
  }
}

function parseFailureCounts(value: unknown): FailureCounts | null {
  const counts = object(value);
  if (!counts) return null;
  const allowed = new Set<string>(FAILURE_CATEGORIES);
  for (const [category, count] of Object.entries(counts)) {
    if (
      !allowed.has(category) ||
      !Number.isSafeInteger(count) ||
      (count as number) < 1 ||
      (count as number) > 100
    ) {
      return null;
    }
  }
  return counts as FailureCounts;
}

function parseBody(value: unknown): CheckBody | null {
  const body = object(value);
  if (!body || Object.keys(body).some((key) => !BODY_KEYS.has(key))) return null;
  const deploymentUrl = safeUrl(body.deploymentUrl);
  const runUrl = safeUrl(body.runUrl);
  const failureCounts = parseFailureCounts(body.failureCounts);
  const checkedAt =
    typeof body.checkedAt === "string" ? Date.parse(body.checkedAt) : Number.NaN;
  if (
    body.version !== 1 ||
    typeof body.deploymentId !== "string" ||
    !DEPLOYMENT_ID.test(body.deploymentId) ||
    typeof body.projectId !== "string" ||
    !PROJECT_ID.test(body.projectId) ||
    !deploymentUrl ||
    deploymentUrl.pathname !== "/" ||
    deploymentUrl.search ||
    deploymentUrl.hash ||
    typeof body.gitSha !== "string" ||
    !SHA.test(body.gitSha) ||
    typeof body.runId !== "string" ||
    !RUN_ID.test(body.runId) ||
    !Number.isSafeInteger(body.runNumber) ||
    (body.runNumber as number) < 1 ||
    !runUrl ||
    runUrl.search ||
    runUrl.hash ||
    !["running", "success", "failure"].includes(body.status as string) ||
    !Number.isFinite(checkedAt) ||
    Math.abs(Date.now() - checkedAt) > SIGNATURE_WINDOW_SECONDS * 1000 ||
    !Number.isSafeInteger(body.pagesChecked) ||
    (body.pagesChecked as number) < 0 ||
    (body.pagesChecked as number) > 100 ||
    !Number.isSafeInteger(body.brokenCount) ||
    (body.brokenCount as number) < 0 ||
    (body.brokenCount as number) > 100 ||
    !failureCounts
  ) {
    return null;
  }
  const categorizedCount = Object.values(failureCounts).reduce(
    (total, count) => total + (count ?? 0),
    0,
  );
  if (
    (body.status === "running" &&
      (body.pagesChecked !== 0 ||
        body.brokenCount !== 0 ||
        categorizedCount !== 0)) ||
    (body.status === "success" &&
      (body.brokenCount !== 0 || categorizedCount !== 0)) ||
    (body.status === "failure" &&
      (body.brokenCount === 0 || categorizedCount !== body.brokenCount))
  ) {
    return null;
  }
  return { ...body, failureCounts } as CheckBody;
}

function validSignature(rawBody: string, secret: string, request: Request) {
  const timestamp = request.headers.get("x-deploy-check-timestamp");
  const supplied = request.headers.get("x-deploy-check-signature");
  if (
    !timestamp ||
    !/^\d{10}$/.test(timestamp) ||
    Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp)) >
      SIGNATURE_WINDOW_SECONDS ||
    !supplied ||
    !/^sha256=[0-9a-f]{64}$/i.test(supplied)
  ) {
    return false;
  }
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest();
  const received = Buffer.from(supplied.slice(7), "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

function accepted(status = 200, recovered = false) {
  return Response.json(
    { accepted: true, recovered },
    { status, headers: { "cache-control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const secret = process.env.DEPLOY_CHECK_SECRET?.trim();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const expectedProject = process.env.VERCEL_PROJECT_ID?.trim();
  const expectedDeployment = process.env.VERCEL_DEPLOYMENT_ID?.trim();
  const expectedHost = process.env.VERCEL_URL?.trim();
  if (
    !secret ||
    Buffer.byteLength(secret, "utf8") < 32 ||
    !supabaseUrl ||
    !serviceRoleKey ||
    !expectedProject ||
    !expectedDeployment ||
    !expectedHost ||
    process.env.VERCEL_ENV !== "production"
  ) {
    return error("ingestion_not_configured", 503);
  }

  let rawBody: string;
  try {
    rawBody = await readBoundedText(request, MAX_BODY_BYTES);
  } catch (cause) {
    return error(cause instanceof RequestBodyError ? cause.message : "invalid_payload",
      cause instanceof RequestBodyError ? cause.status : 400);
  }
  if (!validSignature(rawBody, secret, request)) {
    return error("invalid_signature", 401);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return error("invalid_payload", 400);
  }
  const body = parseBody(parsed);
  if (!body) return error("invalid_payload", 400);

  const deploymentUrl = new URL(body.deploymentUrl);
  if (
    body.projectId !== expectedProject ||
    body.deploymentId !== expectedDeployment ||
    deploymentUrl.hostname !== expectedHost
  ) {
    return error("deployment_mismatch", 409);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const identity = {
    deployment_id: body.deploymentId,
    project_id: body.projectId,
    deployment_url: body.deploymentUrl,
    git_sha: body.gitSha,
    run_id: body.runId,
    run_number: body.runNumber,
    run_url: body.runUrl,
    checked_at: body.checkedAt,
    pages_checked: body.pagesChecked,
    broken_count: body.brokenCount,
    failures: Object.entries(body.failureCounts).map(([category, count]) => ({
      category,
      count,
    })),
  };

  if (body.status === "running") {
    const { error: insertError } = await supabase
      .from("deployment_checks")
      .insert({ ...identity, status: "running" });
    if (insertError) {
      if (insertError.code !== "23505") return error("storage_unavailable", 503);
      const { data: existing, error: readError } = await supabase
        .from("deployment_checks")
        .select("deployment_id,project_id,git_sha,run_id,status")
        .eq("deployment_id", body.deploymentId)
        .maybeSingle();
      if (readError) return error("storage_unavailable", 503);
      if (
        existing?.project_id === body.projectId &&
        existing.git_sha === body.gitSha &&
        existing.run_id === body.runId
      ) {
        return accepted();
      }
      return error("check_already_received", 409);
    }
    return accepted(201);
  }

  const { data, error: updateError } = await supabase
    .from("deployment_checks")
    .update({
      status: body.status,
      checked_at: body.checkedAt,
      pages_checked: body.pagesChecked,
      broken_count: body.brokenCount,
      failures: identity.failures,
    })
    .eq("deployment_id", body.deploymentId)
    .eq("run_id", body.runId)
    .eq("git_sha", body.gitSha)
    .eq("project_id", body.projectId)
    .eq("status", "running")
    .select("deployment_id");
  if (updateError) return error("storage_unavailable", 503);
  if (data.length === 1) return accepted();

  const { error: insertError } = await supabase
    .from("deployment_checks")
    .insert({ ...identity, status: body.status });
  if (!insertError) return accepted(201, true);
  if (insertError.code !== "23505") return error("storage_unavailable", 503);

  const { data: existing, error: readError } = await supabase
    .from("deployment_checks")
    .select("deployment_id,project_id,git_sha,run_id,status")
    .eq("deployment_id", body.deploymentId)
    .maybeSingle();
  if (readError) return error("storage_unavailable", 503);
  if (
    existing?.project_id === body.projectId &&
    existing.git_sha === body.gitSha &&
    existing.run_id === body.runId &&
    existing.status === body.status
  ) {
    return accepted();
  }
  return error("check_state_conflict", 409);
}
