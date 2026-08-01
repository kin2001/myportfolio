import Link from "next/link";
import { getMonitoringSnapshot } from "@/lib/monitoring";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function metric(value: number | null) {
  return value === null ? "Unavailable" : value.toLocaleString("en-US");
}

function date(value: string | null | undefined) {
  if (!value) return "Unavailable";
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf())
    ? "Unavailable"
    : parsed.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
}

function bytes(value: number) {
  if (value < 1024) return `${value} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let amount = value / 1024;
  let unit = units[0];
  for (let index = 1; amount >= 1024 && index < units.length; index += 1) {
    amount /= 1024;
    unit = units[index];
  }
  return `${amount.toFixed(amount >= 10 ? 1 : 2)} ${unit}`;
}

const GIB = 1024 ** 3;

function storageState(value: number) {
  if (value >= 8 * GIB) return { label: "BLOCKED", className: "muted" };
  if (value >= 7.5 * GIB) return { label: "NEAR LIMIT", className: "muted" };
  if (value >= 6 * GIB) return { label: "WARNING", className: "muted" };
  return { label: "OK", className: "accent" };
}

export default async function AdminDashboard() {
  const supabase = await createSupabaseServerClient();
  const databasePromise = supabase
    ? Promise.all([
        supabase.from("projects").select("id", { count: "exact", head: true }).eq("lifecycle_state", "published"),
        supabase.from("projects").select("id", { count: "exact", head: true }).eq("lifecycle_state", "draft"),
        supabase.from("projects").select("id", { count: "exact", head: true }).eq("lifecycle_state", "archived"),
        supabase.from("credentials").select("id", { count: "exact", head: true }),
        supabase.from("cv_versions").select("id,asset_id,original_filename,size_bytes,uploaded_at"),
        supabase.from("assets").select("id,size_bytes,private_derivative_size_bytes,public_object_key,public_mime_type,processing_state"),
        supabase.from("audit_events").select("id", { count: "exact", head: true }),
        supabase
          .from("deployment_checks")
          .select("status,checked_at,pages_checked,broken_count,run_url,git_sha")
          .order("run_number", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("site_settings")
          .select("current_cv_version_id,current_cv_public_object_key")
          .eq("singleton", true)
          .maybeSingle(),
        supabase
          .from("audit_events")
          .select("id,action,entity_type,entity_id,occurred_at")
          .order("occurred_at", { ascending: false })
          .limit(5),
      ])
    : Promise.resolve(null);
  const [monitoring, database] = await Promise.all([
    getMonitoringSnapshot(),
    databasePromise,
  ]);

  const databaseAvailable = database?.every((result) => !result.error) ?? false;
  const counts = databaseAvailable
    ? database!.slice(0, 4).map((result) => result.count ?? 0)
    : [null, null, null, null];
  const cvRows = databaseAvailable ? database![4].data ?? [] : [];
  const assetRows = databaseAvailable ? database![5].data ?? [] : [];
  const settings = databaseAvailable ? database![8].data : null;
  const currentCv = settings?.current_cv_version_id
    ? cvRows.find((version) => version.id === settings.current_cv_version_id) ?? null
    : null;
  const trackedBytes = assetRows.reduce(
    (total, asset) => {
      const original = Number(asset.size_bytes ?? 0);
      const derivative = Number(asset.private_derivative_size_bytes ?? 0);
      const publicCopy = asset.public_object_key
        ? asset.public_mime_type === "image/webp"
          ? derivative
          : original
        : 0;
      return total + original + derivative + publicCopy;
    },
    0,
  );
  const readyAssets = assetRows.filter(
    (asset) => asset.processing_state === "ready" || asset.processing_state === "published",
  ).length;
  const auditCount = databaseAvailable ? database![6].count ?? 0 : null;
  const deploymentCheck = databaseAvailable ? database![7].data : null;
  const recentActivity = databaseAvailable ? database![9].data ?? [] : [];
  const storage = storageState(trackedBytes);
  const stats = [
    [metric(counts[0]), "Published projects"],
    [metric(counts[1]), "Draft projects"],
    [metric(counts[2]), "Archived projects"],
    [metric(counts[3]), "Credentials"],
    [databaseAvailable ? cvRows.length.toLocaleString("en-US") : "Unavailable", "CV versions"],
    [
      databaseAvailable
        ? currentCv
          ? currentCv.original_filename
          : "Not selected"
        : "Unavailable",
      "Current CV",
    ],
  ] as const;

  return (
    <div className="max-w-6xl">
      <div className="flex flex-col gap-6 border-b border-[var(--line)] pb-8 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mono-meta accent">[ OPERATIONS_OVERVIEW ]</p>
          <h1 className="mt-4 text-4xl font-semibold">Dashboard</h1>
        </div>
        <Link href="/admin/projects/new" className="button-primary">Create project</Link>
      </div>

      <section className="mt-8 grid grid-cols-2 gap-px border border-[var(--line)] bg-[var(--line)] lg:grid-cols-3" aria-label="Content totals">
        {stats.map(([value, label]) => (
          <div className="surface p-6" key={label}>
            <strong className={value === "Unavailable" || label === "Current CV" ? "break-words text-base" : "text-3xl"}>{value}</strong>
            <span className="mono-label muted mt-3 block">{label}</span>
            {label === "Current CV" && currentCv ? (
              <span className="mono-meta muted mt-2 block">
                {currentCv.id.slice(0, 8)} · uploaded {date(currentCv.uploaded_at)}
              </span>
            ) : null}
          </div>
        ))}
      </section>

      <section className="mt-12">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="mono-label">Traffic</h2>
            <p className="mono-meta muted mt-2">
              As of {monitoring.analytics.available ? date(monitoring.analytics.data.asOf) : "Unavailable"}
            </p>
          </div>
          {monitoring.providerLinks.available ? (
            <div className="flex flex-wrap gap-4">
              <a className="mono-label accent" href={monitoring.providerLinks.data.analytics} target="_blank" rel="noreferrer">
                Full Vercel Analytics
              </a>
              <a className="mono-label accent" href={monitoring.providerLinks.data.speedInsights} target="_blank" rel="noreferrer">
                Speed Insights
              </a>
            </div>
          ) : (
            <span className="mono-meta muted">Provider links unavailable</span>
          )}
        </div>
        {monitoring.analytics.available ? (
          <>
            <div className="mt-5 grid gap-px border border-[var(--line)] bg-[var(--line)] sm:grid-cols-2 lg:grid-cols-4">
              {[
                [monitoring.analytics.data.sevenDays.visitors, "Visitors / 7 days"],
                [monitoring.analytics.data.sevenDays.pageviews, "Page views / 7 days"],
                [monitoring.analytics.data.thirtyDays.visitors, "Visitors / 30 days"],
                [monitoring.analytics.data.thirtyDays.pageviews, "Page views / 30 days"],
              ].map(([value, label]) => (
                <div className="surface p-6" key={label}>
                  <strong className="text-3xl">{Number(value).toLocaleString("en-US")}</strong>
                  <span className="mono-label muted mt-3 block">{label}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              {[
                ["Top routes / 30 days", monitoring.analytics.data.topRoutes],
                ["Top referrers / 30 days", monitoring.analytics.data.topReferrers],
              ].map(([title, rows]) => (
                <div className="module p-6" key={title as string}>
                  <h3 className="mono-label">{title as string}</h3>
                  {(rows as typeof monitoring.analytics.data.topRoutes).length ? (
                    <ol className="mt-5 divide-y divide-[var(--line)]">
                      {(rows as typeof monitoring.analytics.data.topRoutes).map((row) => (
                        <li className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 py-3" key={row.label}>
                          <span className="truncate">{row.label || "Direct / none"}</span>
                          <span className="mono-meta muted">{row.pageviews.toLocaleString("en-US")} views</span>
                        </li>
                      ))}
                    </ol>
                  ) : <p className="mt-5 ink-soft">No traffic recorded in this period.</p>}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="module mt-5 p-6">
            <strong>Unavailable</strong>
            <p className="mt-2 text-sm ink-soft">Vercel Web Analytics is {monitoring.analytics.reason.toLowerCase()}.</p>
          </div>
        )}
      </section>

      <section className="mt-12">
        <div className="flex items-center justify-between gap-4">
          <h2 className="mono-label">Recent administration</h2>
          <Link className="mono-label accent" href="/admin/activity">All activity and exports</Link>
        </div>
        {recentActivity.length ? (
          <ol className="module mt-5 divide-y divide-[var(--line)]">
            {recentActivity.map((event) => (
              <li className="grid gap-2 p-5 md:grid-cols-[180px_minmax(0,1fr)_180px]" key={event.id}>
                <span className="mono-label">{event.action}</span>
                <span className="text-sm ink-soft">
                  {event.entity_type}
                  {event.entity_id ? ` / ${event.entity_id.slice(0, 8)}` : ""}
                </span>
                <time className="mono-meta muted md:text-right" dateTime={event.occurred_at}>
                  {date(event.occurred_at)}
                </time>
              </li>
            ))}
          </ol>
        ) : (
          <div className="module mt-5 p-6">
            <strong>{databaseAvailable ? "No recent activity" : "Unavailable"}</strong>
            <p className="mt-2 text-sm ink-soft">
              {databaseAvailable ? "No administrative changes have been recorded." : "Audit activity could not be read."}
            </p>
          </div>
        )}
      </section>

      <section className="mt-12">
        <div className="flex items-center justify-between gap-4">
          <h2 className="mono-label">System signals</h2>
          <Link className="mono-label accent" href="/admin/activity">Activity and exports</Link>
        </div>
        <div className="module mt-5 divide-y divide-[var(--line)]">
          <div className="grid gap-2 p-5 md:grid-cols-[180px_130px_1fr]">
            <strong>Supabase</strong>
            <span className={`mono-label ${databaseAvailable ? "accent" : "muted"}`}>{databaseAvailable ? "AVAILABLE" : "UNAVAILABLE"}</span>
            <span className="text-sm ink-soft">{databaseAvailable ? `${auditCount} audit events retained` : "Content and audit signals could not be read"}</span>
          </div>
          <div className="grid gap-2 p-5 md:grid-cols-[180px_130px_1fr]">
            <strong>Asset storage</strong>
            <span className={`mono-label ${databaseAvailable ? storage.className : "muted"}`}>
              {databaseAvailable ? storage.label : "UNAVAILABLE"}
            </span>
            <span className="text-sm ink-soft">
              {databaseAvailable
                ? `${bytes(trackedBytes)} tracked across private originals, private derivatives, and public copies; ${readyAssets} validated assets. Warn at 6 GB, near-limit at 7.5 GB, uploads block at 8 GB.`
                : "Storage records could not be read"}
            </span>
          </div>
          <div className="grid gap-2 p-5 md:grid-cols-[180px_130px_1fr]">
            <strong>Runtime/server errors</strong>
            <span className={`mono-label ${monitoring.runtimeErrors.available && monitoring.runtimeErrors.data.count === 0 ? "accent" : "muted"}`}>
              {monitoring.runtimeErrors.available ? monitoring.runtimeErrors.data.count.toLocaleString("en-US") : "UNAVAILABLE"}
            </span>
            <span className="text-sm ink-soft">
              {monitoring.runtimeErrors.available
                ? `${monitoring.runtimeErrors.data.windowLabel}; ${
                    monitoring.runtimeErrors.data.lastOccurredAt
                      ? `last occurrence ${date(monitoring.runtimeErrors.data.lastOccurredAt)}`
                      : "no occurrence in this window"
                  }`
                : `Vercel runtime logs are ${monitoring.runtimeErrors.reason.toLowerCase()}`}
              {monitoring.providerLinks.available ? (
                <> · <a className="underline" href={monitoring.providerLinks.data.logs} target="_blank" rel="noreferrer">Open logs</a></>
              ) : null}
            </span>
          </div>
          <div className="grid gap-2 p-5 md:grid-cols-[180px_130px_1fr]">
            <strong>Browser errors</strong>
            <span className={`mono-label ${monitoring.browserErrors.available && monitoring.browserErrors.data.count === 0 ? "accent" : "muted"}`}>
              {monitoring.browserErrors.available ? monitoring.browserErrors.data.count.toLocaleString("en-US") : "UNAVAILABLE"}
            </span>
            <span className="text-sm ink-soft">
              {monitoring.browserErrors.available
                ? `${monitoring.browserErrors.data.windowLabel}; ${
                    monitoring.browserErrors.data.lastOccurredAt
                      ? `last occurrence ${date(monitoring.browserErrors.data.lastOccurredAt)}`
                      : "no occurrence in this window"
                  }`
                : `Better Stack error querying is ${monitoring.browserErrors.reason.toLowerCase()}`}
            </span>
          </div>
          <div className="grid gap-2 p-5 md:grid-cols-[180px_130px_1fr]">
            <strong>Production deploy</strong>
            <span className={`mono-label ${monitoring.deployment.available ? "accent" : "muted"}`}>{monitoring.deployment.available ? monitoring.deployment.data.state : "UNAVAILABLE"}</span>
            <span className="text-sm ink-soft">
              {monitoring.deployment.available ? (
                <a className="underline" href={monitoring.deployment.data.url} target="_blank" rel="noreferrer">
                  {date(monitoring.deployment.data.createdAt)}{monitoring.deployment.data.gitSha ? ` · ${monitoring.deployment.data.gitSha.slice(0, 7)}` : ""}
                </a>
              ) : `Vercel deployment data is ${monitoring.deployment.reason.toLowerCase()}`}
            </span>
          </div>
          <div className="grid gap-2 p-5 md:grid-cols-[180px_130px_1fr]">
            <strong>Production smoke</strong>
            <span className={`mono-label ${deploymentCheck?.status === "success" ? "accent" : "muted"}`}>{deploymentCheck?.status?.toUpperCase() ?? "UNAVAILABLE"}</span>
            <span className="text-sm ink-soft">
              {deploymentCheck ? (
                <a className="underline" href={deploymentCheck.run_url} target="_blank" rel="noreferrer">
                  {deploymentCheck.pages_checked} URLs · {deploymentCheck.broken_count} failures · {date(deploymentCheck.checked_at)}
                </a>
              ) : "No deployment check result is available"}
            </span>
          </div>
          {monitoring.monitors.map((monitor) => (
            <div className="grid gap-2 p-5 md:grid-cols-[180px_130px_1fr]" key={monitor.label}>
              <strong>Monitor / {monitor.label}</strong>
              <span className={`mono-label ${monitor.status === "up" ? "accent" : "muted"}`}>{monitor.status.toUpperCase()}</span>
              <span className="text-sm ink-soft">Last checked {date(monitor.lastCheckedAt)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
