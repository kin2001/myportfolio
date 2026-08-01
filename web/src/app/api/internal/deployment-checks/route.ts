import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 16 * 1024;
const SIGNATURE_WINDOW_SECONDS = 5 * 60;
const SHA = /^[0-9a-f]{40}$/i;
const DEPLOYMENT_ID = /^dpl_[A-Za-z0-9]+$/;
const PROJECT_ID = /^prj_[A-Za-z0-9]+$/;
const RUN_ID = /^\d+$/;

type Failure = {
  url: string;
  source: string;
  status?: number;
  error?: string;
};

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
  failures: Failure[];
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

function validFailure(value: unknown): value is Failure {
  const item = object(value);
  if (
    !item ||
    !boundedString(item.url, 2048) ||
    !boundedString(item.source, 2048)
  ) {
    return false;
  }
  if (
    item.status !== undefined &&
    (!Number.isSafeInteger(item.status) ||
      (item.status as number) < 100 ||
      (item.status as number) > 599)
  ) {
    return false;
  }
  return item.error === undefined ||
    (typeof item.error === "string" && item.error.length <= 500);
}

function parseBody(value: unknown): CheckBody | null {
  const body = object(value);
  if (!body) return null;
  const deploymentUrl = safeUrl(body.deploymentUrl);
  const runUrl = safeUrl(body.runUrl);
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
    !["running", "success", "failure"].includes(body.status as string) ||
    !Number.isFinite(checkedAt) ||
    Math.abs(Date.now() - checkedAt) > SIGNATURE_WINDOW_SECONDS * 1000 ||
    !Number.isSafeInteger(body.pagesChecked) ||
    (body.pagesChecked as number) < 0 ||
    (body.pagesChecked as number) > 100 ||
    !Number.isSafeInteger(body.brokenCount) ||
    (body.brokenCount as number) < 0 ||
    (body.brokenCount as number) > 100 ||
    !Array.isArray(body.failures) ||
    body.failures.length > 50 ||
    !body.failures.every(validFailure)
  ) {
    return null;
  }
  if (
    (body.status === "running" &&
      (body.pagesChecked !== 0 ||
        body.brokenCount !== 0 ||
        body.failures.length !== 0)) ||
    (body.status === "success" &&
      (body.brokenCount !== 0 || body.failures.length !== 0)) ||
    (body.status === "failure" && body.brokenCount === 0)
  ) {
    return null;
  }
  return body as CheckBody;
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

export async function POST(request: Request) {
  const secret = process.env.DEPLOY_CHECK_SECRET?.trim();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const expectedProject = process.env.VERCEL_PROJECT_ID?.trim();
  const expectedDeployment = process.env.VERCEL_DEPLOYMENT_ID?.trim();
  const expectedHost = process.env.VERCEL_URL?.trim();
  if (
    !secret ||
    !supabaseUrl ||
    !serviceRoleKey ||
    !expectedProject ||
    !expectedDeployment ||
    !expectedHost ||
    process.env.VERCEL_ENV !== "production"
  ) {
    return error("ingestion_not_configured", 503);
  }

  const statedLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(statedLength) && statedLength > MAX_BODY_BYTES) {
    return error("payload_too_large", 413);
  }
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
    return error("payload_too_large", 413);
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
    failures: body.failures,
  };

  if (body.status === "running") {
    const { error: insertError } = await supabase
      .from("deployment_checks")
      .insert({ ...identity, status: "running" });
    if (insertError) {
      return error(
        insertError.code === "23505" ? "check_already_received" : "storage_unavailable",
        insertError.code === "23505" ? 409 : 503,
      );
    }
    return Response.json(
      { accepted: true },
      { status: 201, headers: { "cache-control": "no-store" } },
    );
  }

  const { data, error: updateError } = await supabase
    .from("deployment_checks")
    .update({
      status: body.status,
      checked_at: body.checkedAt,
      pages_checked: body.pagesChecked,
      broken_count: body.brokenCount,
      failures: body.failures,
    })
    .eq("deployment_id", body.deploymentId)
    .eq("run_id", body.runId)
    .eq("git_sha", body.gitSha)
    .eq("project_id", body.projectId)
    .eq("status", "running")
    .select("deployment_id");
  if (updateError) return error("storage_unavailable", 503);
  if (data.length !== 1) return error("check_not_running", 409);
  return Response.json(
    { accepted: true },
    { headers: { "cache-control": "no-store" } },
  );
}
