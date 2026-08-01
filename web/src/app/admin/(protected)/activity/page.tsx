import { createSupabaseServerClient } from "@/lib/supabase/server";

function date(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf())
    ? "Unavailable"
    : parsed.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
}

export default async function ActivityAdminPage() {
  const supabase = await createSupabaseServerClient();
  const result = supabase
    ? await supabase
        .from("audit_events")
        .select("id,administrator_id,entity_type,entity_id,action,changed_fields,occurred_at")
        .order("occurred_at", { ascending: false })
        .limit(100)
    : { data: null, error: { message: "Supabase is not configured." } };

  return (
    <div className="max-w-6xl">
      <div className="border-b border-[var(--line)] pb-8">
        <p className="mono-meta accent">[ ACTIVITY_AND_EXPORT ]</p>
        <h1 className="mt-4 text-4xl font-semibold">Activity</h1>
        <p className="mt-4 max-w-2xl leading-7 ink-soft">
          Recent administrative changes and portable, private exports.
        </p>
      </div>

      <section className="mt-8">
        <h2 className="mono-label" id="content-export-title">Content export</h2>
        <div className="mt-5 flex flex-wrap gap-3">
          <a className="button-secondary" href="/api/admin/exports/content">Content JSON</a>
          <a className="button-secondary" href="/api/admin/exports/audit">Audit CSV</a>
          <a className="button-secondary" href="/api/admin/exports/assets">Asset manifest CSV</a>
        </div>
        <p className="mono-meta muted mt-4">Exports exclude authentication credentials, secrets, and signed file URLs.</p>
      </section>

      <section className="mt-12">
        <h2 className="mono-label">Latest 100 events</h2>
        {result.error ? (
          <div className="module mt-5 p-8">
            <p className="mono-meta muted">AUDIT_STREAM / UNAVAILABLE</p>
            <p className="mt-5 leading-7 ink-soft">Audit activity could not be read.</p>
          </div>
        ) : result.data?.length ? (
          <div
            aria-labelledby="activity-table-title"
            className="module mt-5 overflow-x-auto"
            role="region"
            tabIndex={0}
          >
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <caption className="sr-only" id="activity-table-title">Latest 100 administrator activity events</caption>
              <thead>
                <tr className="border-b border-[var(--line)]">
                  {["Time", "Action", "Entity", "Changed fields", "Administrator"].map((label) => (
                    <th className="mono-label p-4" scope="col" key={label}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {result.data.map((event) => (
                  <tr key={event.id}>
                    <td className="whitespace-nowrap p-4">{date(event.occurred_at)}</td>
                    <td className="p-4 font-medium">{event.action}</td>
                    <td className="p-4">
                      {event.entity_type}
                      {event.entity_id ? <span className="mono-meta muted mt-1 block">{event.entity_id.slice(0, 8)}</span> : null}
                    </td>
                    <td className="p-4">{event.changed_fields?.length ? event.changed_fields.join(", ") : "—"}</td>
                    <td className="mono-meta p-4">{event.administrator_id.slice(0, 8)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="module mt-5 p-8">
            <p className="mono-meta accent">AUDIT_STREAM / EMPTY</p>
            <p className="mt-5 leading-7 ink-soft">No administrative changes have been recorded.</p>
          </div>
        )}
      </section>
    </div>
  );
}
