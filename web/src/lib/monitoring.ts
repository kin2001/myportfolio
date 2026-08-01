export type Available<T> =
  | { available: true; data: T }
  | { available: false; reason: "Not configured" | "Unavailable" };

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

const CACHE_SECONDS = 300;

function unavailable<T>(configured: boolean): Available<T> {
  return { available: false, reason: configured ? "Unavailable" : "Not configured" };
}

async function fetchJson(url: URL, token: string) {
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
    next: { revalidate: CACHE_SECONDS },
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
  return visitors === null || pageviews === null ? null : { visitors, pageviews };
}

function aggregateData(value: unknown, dimension: "route" | "referrerHostname") {
  const data = record(value)?.data;
  if (!Array.isArray(data)) return null;

  const rows: TrafficRow[] = [];
  for (const item of data) {
    const row = record(item);
    const label = row?.[dimension];
    const visitors = number(row?.visitors);
    const pageviews = number(row?.pageviews);
    if (
      typeof label !== "string" ||
      visitors === null ||
      pageviews === null ||
      label === "Others"
    ) {
      continue;
    }
    rows.push({ label, visitors, pageviews });
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
  const bucket = Math.floor(Date.now() / (CACHE_SECONDS * 1000)) * CACHE_SECONDS * 1000;
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
      return unavailable(true);
    }
    return {
      available: true,
      data: { sevenDays, thirtyDays, topRoutes, topReferrers, asOf },
    };
  } catch {
    return unavailable(true);
  }
}

async function getDeployment(): Promise<Available<ProductionDeployment>> {
  const token = process.env.VERCEL_TOKEN?.trim();
  const projectId = process.env.VERCEL_PROJECT_ID?.trim();
  const teamId = process.env.VERCEL_TEAM_ID?.trim();
  if (!token || !projectId) return unavailable(false);

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
      return unavailable(true);
    }
    const meta = record(item?.meta);
    return {
      available: true,
      data: {
        id,
        url: `https://${deploymentUrl}`,
        state,
        createdAt: new Date(created).toISOString(),
        gitSha:
          typeof meta?.githubCommitSha === "string" ? meta.githubCommitSha : null,
      },
    };
  } catch {
    return unavailable(true);
  }
}

async function getProviderLinks(): Promise<Available<ProviderLinks>> {
  const token = process.env.VERCEL_TOKEN?.trim();
  const projectId = process.env.VERCEL_PROJECT_ID?.trim();
  const teamId = process.env.VERCEL_TEAM_ID?.trim();
  if (!token || !projectId || !teamId) return unavailable(false);

  try {
    const projectUrl = new URL(
      `/v9/projects/${encodeURIComponent(projectId)}`,
      "https://api.vercel.com",
    );
    projectUrl.searchParams.set("teamId", teamId);
    const teamUrl = new URL(
      `/v2/teams/${encodeURIComponent(teamId)}`,
      "https://api.vercel.com",
    );
    const [project, team] = await Promise.all([
      fetchJson(projectUrl, token),
      fetchJson(teamUrl, token),
    ]);
    const projectName = record(project)?.name;
    const teamSlug = record(team)?.slug;
    if (typeof projectName !== "string" || typeof teamSlug !== "string") {
      return unavailable(true);
    }
    const base = `https://vercel.com/${encodeURIComponent(teamSlug)}/${encodeURIComponent(projectName)}`;
    return {
      available: true,
      data: {
        analytics: `${base}/analytics`,
        speedInsights: `${base}/speed-insights`,
        logs: `${base}/logs`,
      },
    };
  } catch {
    return unavailable(true);
  }
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
  if (!deployment.available) return unavailable(true);

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
      next: { revalidate: CACHE_SECONDS },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return unavailable(true);
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
    return {
      available: true,
      data: {
        count: errors.length,
        lastOccurredAt:
          lastOccurredAt === null ? null : new Date(lastOccurredAt).toISOString(),
        windowLabel: "latest production deployment / last hour",
      },
    };
  } catch {
    return unavailable(true);
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
  if (!/^t\d+_[a-z0-9_]+_logs$/i.test(table)) return unavailable(true);

  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:") return unavailable(true);
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
      next: { revalidate: CACHE_SECONDS },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return unavailable(true);
    const row = record(JSON.parse((await response.text()).trim() || "{}"));
    const count = Number(row?.count);
    const lastOccurredAt = row?.lastOccurredAt;
    if (!Number.isSafeInteger(count) || count < 0) return unavailable(true);
    return {
      available: true,
      data: {
        count,
        lastOccurredAt:
          typeof lastOccurredAt === "string" && lastOccurredAt
            ? new Date(lastOccurredAt.replace(" ", "T") + "Z").toISOString()
            : null,
        windowLabel: "Better Stack / last 24 hours",
      },
    };
  } catch {
    return unavailable(true);
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
        return { id: id ?? "", label, status: "Unavailable", lastCheckedAt: null };
      }
      try {
        const url = new URL(`/api/v2/monitors/${encodeURIComponent(id)}`, "https://uptime.betterstack.com");
        const attributes = record(record(await fetchJson(url, token))?.data)?.attributes;
        const monitor = record(attributes);
        if (typeof monitor?.status !== "string") throw new Error("Invalid monitor");
        return {
          id,
          label,
          status: monitor.status,
          lastCheckedAt:
            typeof monitor.last_checked_at === "string"
              ? monitor.last_checked_at
              : null,
        };
      } catch {
        return { id, label, status: "Unavailable", lastCheckedAt: null };
      }
    }),
  );
}

export async function getMonitoringSnapshot(): Promise<MonitoringSnapshot> {
  const [analytics, deployment, providerLinks, monitors, browserErrors, betterServerErrors] = await Promise.all([
    getAnalytics(),
    getDeployment(),
    getProviderLinks(),
    getMonitors(),
    getBetterStackErrors("browser_runtime_error"),
    getBetterStackErrors("server_runtime_error"),
  ]);
  const runtimeErrors = betterServerErrors.available
    ? betterServerErrors
    : await getRuntimeErrors(deployment);
  return {
    analytics,
    deployment,
    providerLinks,
    runtimeErrors,
    browserErrors,
    monitors,
  };
}
