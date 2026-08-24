import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";
import { POST } from "../src/app/api/internal/deployment-checks/route";

const secret = "test-deployment-check-secret-32-bytes";
const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

test.describe.configure({ mode: "serial" });

function signedRequest(body: Record<string, unknown>) {
  const rawBody = JSON.stringify(body);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  return new Request("https://deployment.example.com/api/internal/deployment-checks", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-deploy-check-timestamp": timestamp,
      "x-deploy-check-signature": `sha256=${signature}`,
    },
    body: rawBody,
  });
}

function report(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    deploymentId: "dpl_test",
    projectId: "prj_test",
    deploymentUrl: "https://deployment.example.com",
    gitSha: "0123456789abcdef0123456789abcdef01234567",
    runId: "12345",
    runNumber: 7,
    runUrl: "https://github.com/example/repository/actions/runs/12345",
    status: "failure",
    checkedAt: new Date().toISOString(),
    pagesChecked: 1,
    brokenCount: 1,
    failureCounts: { http_error: 1 },
    ...overrides,
  };
}

test.beforeEach(() => {
  process.env.DEPLOY_CHECK_SECRET = secret;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
  process.env.VERCEL_PROJECT_ID = "prj_test";
  process.env.VERCEL_DEPLOYMENT_ID = "dpl_test";
  process.env.VERCEL_URL = "deployment.example.com";
  process.env.VERCEL_ENV = "production";
});

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  process.env = { ...originalEnv };
});

test("rejects raw failure details and URL query strings", async () => {
  const rawDetails = await POST(
    signedRequest({
      ...report(),
      failures: [{ url: "https://example.com/?email=private@example.com" }],
    }),
  );
  expect(rawDetails.status).toBe(400);
  await expect(rawDetails.json()).resolves.toEqual({ error: "invalid_payload" });

  const queryString = await POST(
    signedRequest(report({ deploymentUrl: "https://deployment.example.com/?token=secret" })),
  );
  expect(queryString.status).toBe(400);
  await expect(queryString.json()).resolves.toEqual({ error: "invalid_payload" });
});

test("rejects deployment check secrets shorter than 32 UTF-8 bytes", async () => {
  process.env.DEPLOY_CHECK_SECRET = "too-short";
  const response = await POST(signedRequest(report()));
  expect(response.status).toBe(503);
  await expect(response.json()).resolves.toEqual({
    error: "ingestion_not_configured",
  });
});

test("inserts a sanitized terminal result when the running write is missing", async () => {
  const writes: string[] = [];
  globalThis.fetch = async (_input, init) => {
    const method = init?.method ?? "GET";
    if (typeof init?.body === "string") writes.push(init.body);
    if (method === "PATCH") {
      return new Response("[]", {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (method === "POST") {
      return new Response(null, { status: 201 });
    }
    throw new Error(`Unexpected method: ${method}`);
  };

  const response = await POST(signedRequest(report()));
  expect(response.status).toBe(201);
  await expect(response.json()).resolves.toEqual({ accepted: true, recovered: true });
  expect(writes).toHaveLength(2);
  for (const write of writes) {
    expect(write).toContain('"failures":[{"category":"http_error","count":1}]');
    expect(write).not.toContain("private@example.com");
    expect(write).not.toContain("?token=");
  }
});

test("accepts an identical terminal result idempotently", async () => {
  globalThis.fetch = async (_input, init) => {
    const method = init?.method ?? "GET";
    if (method === "PATCH") {
      return new Response("[]", {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (method === "POST") {
      return Response.json(
        { code: "23505", message: "duplicate key" },
        { status: 409 },
      );
    }
    if (method === "GET") {
      return Response.json({
        deployment_id: "dpl_test",
        project_id: "prj_test",
        git_sha: "0123456789abcdef0123456789abcdef01234567",
        run_id: "12345",
        status: "failure",
      });
    }
    throw new Error(`Unexpected method: ${method}`);
  };

  const response = await POST(signedRequest(report()));
  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({ accepted: true, recovered: false });
});
