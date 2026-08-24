import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getMonitoringSnapshot } from "../src/lib/monitoring";

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

test.describe.configure({ mode: "serial" });

test.beforeEach(() => {
  process.env.VERCEL_TOKEN = "test-vercel-token";
  process.env.VERCEL_PROJECT_ID = "prj_test";
  process.env.VERCEL_TEAM_ID = "team_test";
  process.env.VERCEL_PROJECT_DASHBOARD_URL = "https://vercel.com/artkin/portfolio";
  process.env.BETTER_STACK_API_TOKEN = "test-better-stack-token";
  process.env.BETTER_STACK_HOME_MONITOR_ID = "home";
  process.env.BETTER_STACK_CONTACT_MONITOR_ID = "contact";
  process.env.BETTER_STACK_HEALTH_MONITOR_ID = "health";
  process.env.BETTER_STACK_QUERY_URL = "https://logs.example.com/query";
  process.env.BETTER_STACK_QUERY_USERNAME = "test-user";
  process.env.BETTER_STACK_QUERY_PASSWORD = "test-password";
  process.env.BETTER_STACK_QUERY_TABLE = "t123_portfolio_logs";
});

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  process.env = { ...originalEnv };
});

test("persists sanitized aggregates and restores them after a cold provider failure", async () => {
  let fail = false;
  const stored: Array<{
    provider: string;
    payload: unknown;
    last_successful_at: string;
  }> = [];
  const supabase = {
    from: (table: string) => {
      expect(table).toBe("monitoring_snapshots");
      return {
        select: async () => ({ data: structuredClone(stored), error: null }),
        upsert: async (
          writes: typeof stored,
          options: { onConflict: string },
        ) => {
          expect(options).toEqual({ onConflict: "provider" });
          for (const write of writes) {
            const index = stored.findIndex((row) => row.provider === write.provider);
            if (index === -1) stored.push(structuredClone(write));
            else stored[index] = structuredClone(write);
          }
          return { data: null, error: null };
        },
      };
    },
  } as unknown as SupabaseClient;

  globalThis.fetch = async (input) => {
    if (fail) return new Response(null, { status: 503 });
    const rawUrl =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const url = new URL(rawUrl);

    if (url.hostname === "logs.example.com") {
      return new Response('{"count":0,"lastOccurredAt":null}', { status: 200 });
    }
    if (url.hostname === "uptime.betterstack.com") {
      return Response.json({
        data: {
          attributes: {
            status: "up",
            last_checked_at: "2026-08-14T00:00:00.000Z",
          },
        },
      });
    }
    if (url.pathname.includes("/visits/count")) {
      return Response.json({ data: { visitors: 2, pageviews: 3 } });
    }
    if (url.pathname.includes("/visits/aggregate")) {
      const dimension = url.searchParams.get("by");
      return Response.json({
        data: [
          dimension === "route"
            ? {
                route: "/work?email=private@example.com",
                visitors: 2,
                pageviews: 3,
              }
            : {
                referrerHostname: "https://example.com/path?token=secret",
                visitors: 1,
                pageviews: 1,
              },
        ],
      });
    }
    if (url.pathname === "/v6/deployments") {
      return Response.json({
        deployments: [
          {
            uid: "dpl_test",
            url: "deployment.example.com",
            state: "READY",
            created: Date.parse("2026-08-14T00:00:00.000Z"),
            meta: { githubCommitSha: "0123456789abcdef" },
          },
        ],
      });
    }
    throw new Error(`Unexpected monitoring request: ${url.pathname}`);
  };

  const current = await getMonitoringSnapshot(supabase);
  expect(current.analytics.available).toBe(true);
  expect(current.deployment.available).toBe(true);
  expect(current.providerLinks.available).toBe(true);
  expect(current.runtimeErrors.available).toBe(true);
  expect(current.browserErrors.available).toBe(true);
  expect(current.monitors.every((monitor) => monitor.status === "up")).toBe(true);
  expect(stored).toHaveLength(7);
  const serialized = JSON.stringify(stored);
  expect(serialized).toContain('"label":"/work"');
  expect(serialized).toContain('"label":"example.com"');
  expect(serialized).not.toContain("private@example.com");
  expect(serialized).not.toContain("token=secret");

  fail = true;
  process.env.VERCEL_PROJECT_ID = "prj_cold";
  process.env.VERCEL_TEAM_ID = "team_cold";
  process.env.BETTER_STACK_HOME_MONITOR_ID = "cold_home";
  process.env.BETTER_STACK_CONTACT_MONITOR_ID = "cold_contact";
  process.env.BETTER_STACK_HEALTH_MONITOR_ID = "cold_health";
  process.env.BETTER_STACK_QUERY_TABLE = "t456_portfolio_logs";
  const stale = await getMonitoringSnapshot(supabase);
  for (const provider of [
    stale.analytics,
    stale.deployment,
    stale.runtimeErrors,
    stale.browserErrors,
  ]) {
    expect(provider.available).toBe(false);
    if (!provider.available) {
      expect(provider.reason).toBe("Unavailable");
      expect(provider.lastSuccessfulAt).toBeTruthy();
      expect(provider.lastData).toBeTruthy();
    }
  }
  expect(stale.providerLinks.available).toBe(true);

  process.env.VERCEL_PROJECT_DASHBOARD_URL =
    "https://vercel.com/artkin/portfolio?token=secret";
  const invalidLinks = await getMonitoringSnapshot(supabase);
  expect(invalidLinks.providerLinks.available).toBe(false);
  if (!invalidLinks.providerLinks.available) {
    expect(invalidLinks.providerLinks.reason).toBe("Unavailable");
  }
  for (const monitor of stale.monitors) {
    expect(monitor.status).toBe("Unavailable");
    expect(monitor.lastSuccessfulAt).toBeTruthy();
    expect(monitor.lastData?.status).toBe("up");
    expect(monitor.lastCheckedAt).toBe("2026-08-14T00:00:00.000Z");
  }
});
