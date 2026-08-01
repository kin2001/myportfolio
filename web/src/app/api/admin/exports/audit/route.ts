import { csvResponse, exportClient, exportError } from "../_shared";

const columns = [
  "id",
  "administrator_id",
  "entity_type",
  "entity_id",
  "action",
  "changed_fields",
  "occurred_at",
] as const;

export async function GET() {
  const supabase = await exportClient();
  if (!supabase) return exportError(401);

  const { data, error } = await supabase
    .from("audit_events")
    .select(columns.join(","))
    .order("occurred_at");
  if (error) return exportError(503);
  const { error: auditError } = await supabase.rpc("record_audit_export");
  if (auditError) return exportError(503);
  const rows = (data ?? []).map((row) => {
    const source = row as unknown as Record<string, unknown>;
    return Object.fromEntries(columns.map((column) => [column, source[column]]));
  });
  return csvResponse(
    `portfolio-audit-${new Date().toISOString().slice(0, 10)}.csv`,
    columns,
    rows,
  );
}
