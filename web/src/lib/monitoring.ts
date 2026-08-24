import type { SupabaseClient } from "@supabase/supabase-js";

export type Available<T> =
  | { available: true; data: T; lastSuccessfulAt: string }
  | {
      available: false;
      reason: "Not configured" | "Unavailable";
      lastSuccessfulAt?: string;
      lastData?: T;
    };

export type TrafficWindow = {
  visitors: number;
  pageviews: number;
};

export type TrafficRow = {
  label: string;
  visitors: number;
  pageviews: number;
};

export type AnalyticsSummary = {
  sevenDays: TrafficWindow;
  thirtyDays: TrafficWindow;
  topRoutes: TrafficRow[];
  topReferrers: TrafficRow[];
  asOf: string;
};

export type ProductionDeployment = {
  id: string;
  url: string;
  state: string;
  createdAt: string;
  gitSha: string | null;
};

export type MonitorState = {
  id: string;
  label: string;
  status: string;
  lastCheckedAt: string | null;
  reason?: "Not configured" | "Unavailable";
  lastSuccessfulAt?: string;
  lastData?: { status: string; lastCheckedAt: string | null };
};

export type ProviderLinks = {
  analytics: string;
  speedInsights: string;
  logs: string;
};

export type ErrorSummary = {
  count: number;
  lastOccurredAt: string | null;
  windowLabel: string;
};

export type MonitoringSnapshot = {
  analytics: Available<AnalyticsSummary>;
  deployment: Available<ProductionDeployment>;
  providerLinks: Available<ProviderLinks>;
  runtimeErrors: Available<ErrorSummary>;
  browserErrors: Available<ErrorSummary>;
  monitors: MonitorState[];
};

const LIVE_CACHE_SECONDS = 60;
const lastSuccess = new Map<
  string,
  { at: string; data: unknown; expiresAt: number }
>();

function cached<T>(
  key: string,
): { available: true; data: T; lastSuccessfulAt: string } | null {
  const previous = lastSuccess.get(key);
  return previous && previous.expiresAt > Date.now()
    ? {
        available: true,
        data: previous.data as T,
        lastSuccessfulAt: previous.at,
      }
    : null;
}

function available<T>(
  key: string,
  data: T,
): { available: true; data: T; lastSuccessfulAt: string } {
  const at = new Date().toISOString();
  lastSuccess.set(key, {
    at,
    data,
    expiresAt: Date.now() + LIVE_CACHE_SECONDS * 1000,
  });
  return { available: true, data, lastSuccessfulAt: at };
}

function unavailable<T>(configured: boolean, key?: string): Available<T> {
  const previous = configured && key ? lastSuccess.get(key) : undefined;
  return {
    available: false,
    reason: configured ? "Unavailable" : "Not configured",
    ...(previous
      ? { lastSuccessfulAt: previous.at, lastData: previous.data as T }
      : {}),
  };
}

async function fetchJson(url: URL, token: string) {
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Monitoring request failed: ${response.status}`);
  return response.json() as Promise<unknown>;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function number(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function countData(value: unknown): TrafficWindow | null {
  // Vercel's Web Analytics API returns lower-case `pageviews` inside `data`.
  const data = record(record(value)?.data);
  const visitors = number(data?.visitors);
  const pageviews = number(data?.pageviews);
  return visitors === null || pageviews === null ||
    !Number.isSafeInteger(visitors) || visitors < 0 ||
    !Number.isSafeInteger(pageviews) || pageviews < 0
    ? null
    : { visitors, pageviews };
}

function trafficLabel(value: string, dimension: "route" | "referrerHostname") {
  try {
    if (dimension === "route") {
      return new URL(value, "https://portfolio.invalid").pathname.slice(0, 512);
    }
    const host = new URL(
      value.includes("://") ? value : `https://${value}`,
    ).hostname.toLowerCase();
    return host.slice(0, 253);
  } catch {
    return null;
  }
}

function aggregateData(value: unknown, dimension: "route" | "referrerHostname") {
  const data = record(value)?.data;
  if (!Array.isArray(data)) return null;

  const rows: TrafficRow[] = [];
  for (const item of data.slice(0, 5)) {
    const row = record(item);
    const label = row?.[dimension];
    const visitors = number(row?.visitors);
    const pageviews = number(row?.pageviews);
    if (
      typeof label !== "string" ||
      visitors === null ||
      pageviews === null ||
      !Number.isSafeInteger(visitors) ||
      visitors < 0 ||
      !Number.isSafeInteger(pageviews) ||
      pageviews < 0 ||
      label === "Others"
    ) {
      continue;
    }
    const sanitizedLabel = trafficLabel(label, dimension);
    if (!sanitizedLabel) continue;
    rows.push({ label: sanitizedLabel, visitors, pageviews });
  }
  return rows;
}

function vercelUrl(path: string, projectId: string, teamId?: string) {
  const url = new URL(path, "https://api.vercel.com");
  url.searchParams.set("projectId", projectId);
  if (teamId) url.searchParams.set("teamId", teamId);
  return url;
}

function dateRange(days: number) {
  const bucket = Math.floor(Date.now() / (LIVE_CACHE_SECONDS * 1000)) * LIVE_CACHE_SECONDS * 1000;
  return {
    since: new Date(bucket - days * 86_400_000).toISOString(),
    until: new Date(bucket).toISOString(),
  };
}

async function getAnalytics(): Promise<Available<AnalyticsSummary>> {
  const token = process.env.VERCEL_TOKEN?.trim();
  const projectId = process.env.VERCEL_PROJECT_ID?.trim();
  const teamId = process.env.VERCEL_TEAM_ID?.trim();
  if (!token || !projectId) return unavailable(false);
  const cacheKey = `analytics:${projectId}:${teamId ?? ""}`;
  const memory = cached<AnalyticsSummary>(cacheKey);
  if (memory) return memory;

  const count = (days: number) => {
    const url = vercelUrl("/v1/query/web-analytics/visits/count", projectId, teamId);
    const range = dateRange(days);
    url.searchParams.set("since", range.since);
    url.searchParams.set("until", range.until);
    return fetchJson(url, token);
  };
  const aggregate = (dimension: "route" | "referrerHostname") => {
    const url = vercelUrl("/v1/query/web-analytics/visits/aggregate", projectId, teamId);
    const range = dateRange(30);
    url.searchParams.set("since", range.since);
    url.searchParams.set("until", range.until);
    url.searchParams.set("by", dimension);
    url.searchParams.set("limit", "5");
    return fetchJson(url, token);
  };

  try {
    const asOf = dateRange(30).until;
    const [seven, thirty, routes, referrers] = await Promise.all([
      count(7),
      count(30),
      aggregate("route"),
      aggregate("referrerHostname"),
    ]);
    const sevenDays = countData(seven);
    const thirtyDays = countData(thirty);
    const topRoutes = aggregateData(routes, "route");
    const topReferrers = aggregateData(referrers, "referrerHostname");
    if (!sevenDays || !thirtyDays || !topRoutes || !topReferrers) {
      return unavailable(true, cacheKey);
    }
    return available(cacheKey, {
      sevenDays,
      thirtyDays,
      topRoutes,
      topReferrers,
      asOf,
    });
  } catch {
    return unavailable(true, cacheKey);
  }
}

async function getDeployment(): Promise<Available<ProductionDeployment>> {
  const token = process.env.VERCEL_TOKEN?.trim();
  const projectId = process.env.VERCEL_PROJECT_ID?.trim();
  const teamId = process.env.VERCEL_TEAM_ID?.trim();
  if (!token || !projectId) return unavailable(false);
  const cacheKey = `deployment:${projectId}:${teamId ?? ""}`;
  const memory = cached<ProductionDeployment>(cacheKey);
  if (memory) return memory;

  const url = vercelUrl("/v6/deployments", projectId, teamId);
  url.searchParams.set("target", "production");
  url.searchParams.set("limit", "1");
  try {
    const payload = record(await fetchJson(url, token));
    const item = Array.isArray(payload?.deployments)
      ? record(payload.deployments[0])
      : null;
    const id = item?.uid;
    const deploymentUrl = item?.url;
    const state = item?.state;
    const created = number(item?.created);
    if (
      typeof id !== "string" ||
      typeof deploymentUrl !== "string" ||
      typeof state !== "string" ||
      created === null
    ) {
      return unavailable(true, cacheKey);
    }
    const meta = record(item?.meta);
    const publicUrl = httpsUrl(`https://${deploymentUrl}`);
    const gitSha = typeof meta?.githubCommitSha === "string"
      ? meta.githubCommitSha
      : null;
    if (
      !publicUrl || !/^dpl_[A-Za-z0-9]+$/.test(id) ||
      !/^[A-Za-z_]{1,40}$/.test(state) ||
      (gitSha !== null && !/^[0-9a-f]{7,64}$/i.test(gitSha))
    ) {
      return unavailable(true, cacheKey);
    }
    return available(cacheKey, {
      id,
      url: publicUrl,
      state,
      createdAt: new Date(created).toISOString(),
      gitSha,
    });
  } catch {
    return unavailable(true, cacheKey);
  }
}

function getProviderLinks(): Available<ProviderLinks> {
  const configured = process.env.VERCEL_PROJECT_DASHBOARD_URL?.trim();
  if (!configured) return unavailable(false);
  const base = httpsUrl(configured, "vercel.com")?.replace(/\/$/, "");
  if (!base || new URL(base).pathname.split("/").filter(Boolean).length !== 2) {
    return unavailable(true);
  }
  const lastSuccessfulAt = new Date().toISOString();
  return {
    available: true,
    lastSuccessfulAt,
    data: {
      analytics: `${base}/analytics`,
      speedInsights: `${base}/speed-insights`,
      logs: `${base}/logs`,
    },
  };
}

function runtimeLogRows(value: string) {
  const rows: Record<string, unknown>[] = [];
  for (const line of value.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const row = record(JSON.parse(line));
      if (row) rows.push(row);
    } catch {
      // The endpoint is newline-delimited JSON; ignore incomplete stream tails.
    }
  }
  return rows;
}

async function getRuntimeErrors(
  deployment: Available<ProductionDeployment>,
): Promise<Available<ErrorSummary>> {
  const token = process.env.VERCEL_TOKEN?.trim();
  const projectId = process.env.VERCEL_PROJECT_ID?.trim();
  const teamId = process.env.VERCEL_TEAM_ID?.trim();
  if (!token || !projectId) return unavailable(false);
  const cacheKey = `vercel-runtime-errors:${projectId}:${teamId ?? ""}`;
  const memory = cached<ErrorSummary>(cacheKey);
  if (memory) return memory;
  if (!deployment.available) return unavailable(true, cacheKey);

  const until = Date.now();
  const since = until - 60 * 60 * 1000;
  const url = new URL(
    `/v1/projects/${encodeURIComponent(projectId)}/deployments/${encodeURIComponent(deployment.data.id)}/runtime-logs`,
    "https://api.vercel.com",
  );
  url.searchParams.set("since", String(since));
  url.searchParams.set("until", String(until));
  if (teamId) url.searchParams.set("teamId", teamId);

  try {
    const response = await fetch(url, {
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/stream+json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return unavailable(true, cacheKey);
    const rows = runtimeLogRows(await response.text());
    const errors = rows.filter((row) => {
      const level = row.level;
      const status = number(row.responseStatusCode);
      return (
        row.source !== "delimiter" &&
        (level === "error" ||
          level === "fatal" ||
          (status !== null && status >= 500))
      );
    });
    const lastOccurredAt = errors.reduce<number | null>((latest, row) => {
      const timestamp = number(row.timestampInMs);
      return timestamp === null || (latest !== null && timestamp <= latest)
        ? latest
        : timestamp;
    }, null);
    return available(cacheKey, {
      count: errors.length,
      lastOccurredAt:
        lastOccurredAt === null ? null : new Date(lastOccurredAt).toISOString(),
      windowLabel: "latest production deployment / last hour",
    });
  } catch {
    return unavailable(true, cacheKey);
  }
}

async function getBetterStackErrors(
  kind: "browser_runtime_error" | "server_runtime_error",
): Promise<Available<ErrorSummary>> {
  const endpoint = process.env.BETTER_STACK_QUERY_URL?.trim();
  const username = process.env.BETTER_STACK_QUERY_USERNAME?.trim();
  const password = process.env.BETTER_STACK_QUERY_PASSWORD?.trim();
  const table = process.env.BETTER_STACK_QUERY_TABLE?.trim();
  if (!endpoint || !username || !password || !table) return unavailable(false);
  const cacheKey = `better-stack-errors:${table}:${kind}`;
  const memory = cached<ErrorSummary>(cacheKey);
  if (memory) return memory;
  if (!/^t\d+_[a-z0-9_]+_logs$/i.test(table)) return unavailable(true, cacheKey);

  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:") return unavailable(true, cacheKey);
    const sql = [
      "SELECT count() AS count, maxOrNull(dt) AS lastOccurredAt",
      `FROM remote(${table})`,
      "WHERE dt >= now() - INTERVAL 24 HOUR",
      `AND JSONExtract(raw, 'message', 'Nullable(String)') = '${kind}'`,
      "FORMAT JSONEachRow",
    ].join("\n");
    const response = await fetch(url, {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
        "content-type": "text/plain",
      },
      body: sql,
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return unavailable(true, cacheKey);
    const row = record(JSON.parse((await response.text()).trim() || "{}"));
    const count = Number(row?.count);
    const lastOccurredAt = row?.lastOccurredAt;
    if (!Number.isSafeInteger(count) || count < 0) return unavailable(true, cacheKey);
    return available(cacheKey, {
      count,
      lastOccurredAt:
        typeof lastOccurredAt === "string" && lastOccurredAt
          ? new Date(lastOccurredAt.replace(" ", "T") + "Z").toISOString()
          : null,
      windowLabel: "Better Stack / last 24 hours",
    });
  } catch {
    return unavailable(true, cacheKey);
  }
}

async function getMonitors(): Promise<MonitorState[]> {
  const token = process.env.BETTER_STACK_API_TOKEN?.trim();
  const configured = [
    ["Home", process.env.BETTER_STACK_HOME_MONITOR_ID?.trim()],
    ["Contact", process.env.BETTER_STACK_CONTACT_MONITOR_ID?.trim()],
    ["Health", process.env.BETTER_STACK_HEALTH_MONITOR_ID?.trim()],
  ] as const;

  return Promise.all(
    configured.map(async ([label, id]) => {
      if (!token || !id) {
        return {
          id: id ?? "",
          label,
          status: "Unavailable",
          lastCheckedAt: null,
          reason: "Not configured" as const,
        };
      }
      const cacheKey = `monitor:${id}`;
      const memory = cached<{ status: string; lastCheckedAt: string | null }>(cacheKey);
      if (memory) {
        return {
          id,
          label,
          ...memory.data,
          lastSuccessfulAt: memory.lastSuccessfulAt,
        };
      }
      try {
        const url = new URL(`/api/v2/monitors/${encodeURIComponent(id)}`, "https://uptime.betterstack.com");
        const attributes = record(record(await fetchJson(url, token))?.data)?.attributes;
        const monitor = record(attributes);
        if (
          typeof monitor?.status !== "string" ||
          !/^[a-z_]{1,40}$/i.test(monitor.status) ||
          (monitor.last_checked_at !== null &&
            monitor.last_checked_at !== undefined &&
            !isoDate(monitor.last_checked_at))
        ) {
          throw new Error("Invalid monitor");
        }
        const state = {
          id,
          label,
          status: monitor.status,
          lastCheckedAt:
            typeof monitor.last_checked_at === "string"
              ? isoDate(monitor.last_checked_at)
              : null,
        };
        const saved = available(cacheKey, {
          status: state.status,
          lastCheckedAt: state.lastCheckedAt,
        });
        return { ...state, lastSuccessfulAt: saved.lastSuccessfulAt };
      } catch {
        const previous = lastSuccess.get(cacheKey) as
          | { at: string; data: { status: string; lastCheckedAt: string | null } }
          | undefined;
        return {
          id,
          label,
          status: "Unavailable",
          lastCheckedAt: previous?.data.lastCheckedAt ?? null,
          reason: "Unavailable" as const,
          ...(previous
            ? { lastSuccessfulAt: previous.at, lastData: previous.data }
            : {}),
        };
      }
    }),
  );
}

type StoredSnapshot = {
  provider: string;
  payload: unknown;
  last_successful_at: string;
};

function isoDate(value: unknown) {
  if (typeof value !== "string") return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function trafficWindow(value: unknown): TrafficWindow | null {
  const item = record(value);
  const visitors = number(item?.visitors);
  const pageviews = number(item?.pageviews);
  return visitors !== null && pageviews !== null &&
    Number.isSafeInteger(visitors) && visitors >= 0 &&
    Number.isSafeInteger(pageviews) && pageviews >= 0
    ? { visitors, pageviews }
    : null;
}

function trafficRows(
  value: unknown,
  dimension: "route" | "referrerHostname",
): TrafficRow[] | null {
  if (!Array.isArray(value) || value.length > 5) return null;
  const rows: TrafficRow[] = [];
  for (const item of value) {
    const row = record(item);
    const visitors = number(row?.visitors);
    const pageviews = number(row?.pageviews);
    const label = typeof row?.label === "string"
      ? trafficLabel(row.label, dimension)
      : null;
    if (
      !label || visitors === null || pageviews === null ||
      !Number.isSafeInteger(visitors) || visitors < 0 ||
      !Number.isSafeInteger(pageviews) || pageviews < 0
    ) {
      return null;
    }
    rows.push({ label, visitors, pageviews });
  }
  return rows;
}

function storedAnalytics(value: unknown): AnalyticsSummary | null {
  const item = record(value);
  const sevenDays = trafficWindow(item?.sevenDays);
  const thirtyDays = trafficWindow(item?.thirtyDays);
  const topRoutes = trafficRows(item?.topRoutes, "route");
  const topReferrers = trafficRows(item?.topReferrers, "referrerHostname");
  const asOf = isoDate(item?.asOf);
  return sevenDays && thirtyDays && topRoutes && topReferrers && asOf
    ? { sevenDays, thirtyDays, topRoutes, topReferrers, asOf }
    : null;
}

function httpsUrl(value: unknown, host?: string) {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password &&
      !url.search && !url.hash && (!host || url.hostname === host)
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function storedDeployment(value: unknown): ProductionDeployment | null {
  const item = record(value);
  const id = item?.id;
  const url = httpsUrl(item?.url);
  const state = item?.state;
  const createdAt = isoDate(item?.createdAt);
  const gitSha = item?.gitSha;
  return typeof id === "string" && /^dpl_[A-Za-z0-9]+$/.test(id) &&
    url && typeof state === "string" && /^[A-Za-z_]{1,40}$/.test(state) &&
    createdAt && (gitSha === null ||
      (typeof gitSha === "string" && /^[0-9a-f]{7,64}$/i.test(gitSha)))
    ? { id, url, state, createdAt, gitSha }
    : null;
}

function storedErrors(value: unknown): ErrorSummary | null {
  const item = record(value);
  const count = number(item?.count);
  const lastOccurredAt = item?.lastOccurredAt === null
    ? null
    : isoDate(item?.lastOccurredAt);
  const windowLabel = item?.windowLabel;
  return count !== null && Number.isSafeInteger(count) && count >= 0 &&
    (item?.lastOccurredAt === null || lastOccurredAt) &&
    (windowLabel === "latest production deployment / last hour" ||
      windowLabel === "Better Stack / last 24 hours")
    ? { count, lastOccurredAt, windowLabel }
    : null;
}

function storedMonitor(value: unknown) {
  const item = record(value);
  const status = item?.status;
  const lastCheckedAt = item?.lastCheckedAt === null
    ? null
    : isoDate(item?.lastCheckedAt);
  return typeof status === "string" && /^[a-z_]{1,40}$/i.test(status) &&
    (item?.lastCheckedAt === null || lastCheckedAt)
    ? { status, lastCheckedAt }
    : null;
}

function storedRow(
  rows: Map<string, StoredSnapshot>,
  provider: string,
) {
  const row = rows.get(provider);
  const at = isoDate(row?.last_successful_at);
  return row && at ? { payload: row.payload, at } : null;
}

function withStoredFallback<T>(
  current: Available<T>,
  rows: Map<string, StoredSnapshot>,
  provider: string,
  parse: (value: unknown) => T | null,
): Available<T> {
  if (current.available || current.reason === "Not configured") return current;
  const row = storedRow(rows, provider);
  const data = row ? parse(row.payload) : null;
  if (
    current.lastData && current.lastSuccessfulAt &&
    (!row || Date.parse(current.lastSuccessfulAt) >= Date.parse(row.at))
  ) {
    return current;
  }
  return row && data
    ? {
        available: false,
        reason: "Unavailable",
        lastSuccessfulAt: row.at,
        lastData: data,
      }
    : current;
}

function snapshotRows(snapshot: MonitoringSnapshot) {
  const rows: Array<{
    provider: string;
    payload: unknown;
    last_successful_at: string;
  }> = [];
  const add = <T>(provider: string, value: Available<T>) => {
    const payload = value.available ? value.data : value.lastData;
    if (payload && value.lastSuccessfulAt) {
      rows.push({
        provider,
        payload,
        last_successful_at: value.lastSuccessfulAt,
      });
    }
  };
  add("analytics", snapshot.analytics);
  add("deployment", snapshot.deployment);
  add("runtime_errors", snapshot.runtimeErrors);
  add("browser_errors", snapshot.browserErrors);
  for (const monitor of snapshot.monitors) {
    const payload = monitor.status === "Unavailable"
      ? monitor.lastData
      : { status: monitor.status, lastCheckedAt: monitor.lastCheckedAt };
    if (!payload || !monitor.lastSuccessfulAt) continue;
    rows.push({
      provider: `monitor_${monitor.label.toLowerCase()}`,
      payload,
      last_successful_at: monitor.lastSuccessfulAt,
    });
  }
  return rows;
}

async function addDurableFallback(
  supabase: SupabaseClient,
  live: MonitoringSnapshot,
): Promise<MonitoringSnapshot> {
  const { data, error } = await supabase
    .from("monitoring_snapshots")
    .select("provider,payload,last_successful_at");
  if (error) return live;

  const stored = new Map(
    ((data ?? []) as StoredSnapshot[]).map((row) => [row.provider, row]),
  );
  const writes = snapshotRows(live).filter((row) => {
    const previous = stored.get(row.provider);
    return !previous || Date.parse(row.last_successful_at) >
      Date.parse(previous.last_successful_at);
  });
  if (writes.length) {
    await supabase
      .from("monitoring_snapshots")
      .upsert(writes, { onConflict: "provider" });
  }

  const monitors = live.monitors.map((monitor) => {
    if (monitor.status !== "Unavailable" || monitor.reason === "Not configured") {
      return monitor;
    }
    const row = storedRow(stored, `monitor_${monitor.label.toLowerCase()}`);
    const previous = row ? storedMonitor(row.payload) : null;
    if (
      monitor.lastData && monitor.lastSuccessfulAt &&
      (!row || Date.parse(monitor.lastSuccessfulAt) >= Date.parse(row.at))
    ) {
      return monitor;
    }
    return row && previous
      ? {
          ...monitor,
          lastCheckedAt: previous.lastCheckedAt,
          lastSuccessfulAt: row.at,
          lastData: previous,
        }
      : monitor;
  });
  return {
    analytics: withStoredFallback(
      live.analytics,
      stored,
      "analytics",
      storedAnalytics,
    ),
    deployment: withStoredFallback(
      live.deployment,
      stored,
      "deployment",
      storedDeployment,
    ),
    providerLinks: live.providerLinks,
    runtimeErrors: withStoredFallback(
      live.runtimeErrors,
      stored,
      "runtime_errors",
      storedErrors,
    ),
    browserErrors: withStoredFallback(
      live.browserErrors,
      stored,
      "browser_errors",
      storedErrors,
    ),
    monitors,
  };
}

export async function getMonitoringSnapshot(
  supabase?: SupabaseClient,
): Promise<MonitoringSnapshot> {
  const [analytics, deployment, monitors, browserErrors, betterServerErrors] = await Promise.all([
    getAnalytics(),
    getDeployment(),
    getMonitors(),
    getBetterStackErrors("browser_runtime_error"),
    getBetterStackErrors("server_runtime_error"),
  ]);
  let runtimeErrors: Available<ErrorSummary> = betterServerErrors;
  if (!betterServerErrors.available) {
    const vercelErrors = await getRuntimeErrors(deployment);
    runtimeErrors = vercelErrors.available || !betterServerErrors.lastData
      ? vercelErrors
      : betterServerErrors;
  }
  const live = {
    analytics,
    deployment,
    providerLinks: getProviderLinks(),
    runtimeErrors,
    browserErrors,
    monitors,
  };
  return supabase ? addDurableFallback(supabase, live) : live;
}
