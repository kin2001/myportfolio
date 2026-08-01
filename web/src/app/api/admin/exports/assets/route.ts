import { csvResponse, exportClient, exportError } from "../_shared";

const columns = [
  "id",
  "purpose",
  "original_filename",
  "object_key",
  "private_derivative_key",
  "private_derivative_size_bytes",
  "public_object_key",
  "public_mime_type",
  "mime_type",
  "width",
  "height",
  "size_bytes",
  "checksum_sha256",
  "processing_state",
  "visibility",
  "validated_at",
  "created_at",
] as const;

export async function GET() {
  const supabase = await exportClient();
  if (!supabase) return exportError(401);

  const { data, error } = await supabase
    .from("assets")
    .select(columns.join(","))
    .order("created_at");
  if (error) return exportError(503);
  const { error: auditError } = await supabase.rpc("record_assets_export");
  if (auditError) return exportError(503);
  const rows = (data ?? []).map((row) => {
    const source = row as unknown as Record<string, unknown>;
    return Object.fromEntries(columns.map((column) => [column, source[column]]));
  });
  return csvResponse(
    `portfolio-asset-manifest-${new Date().toISOString().slice(0, 10)}.csv`,
    columns,
    rows,
  );
}
