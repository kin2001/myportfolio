import { getAdminIdentity } from "@/lib/supabase/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function exportClient() {
  const [admin, supabase] = await Promise.all([
    getAdminIdentity(),
    createSupabaseServerClient(),
  ]);
  return admin && supabase ? supabase : null;
}

export function exportError(status: 401 | 503) {
  return Response.json(
    {
      error:
        status === 401
          ? "Administrator access is required."
          : "Export data is unavailable.",
    },
    { status, headers: { "cache-control": "no-store" } },
  );
}

function csvCell(value: unknown) {
  let text =
    value === null || value === undefined
      ? ""
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function csvResponse(
  filename: string,
  columns: readonly string[],
  rows: Record<string, unknown>[],
) {
  const body = [
    columns.map(csvCell).join(","),
    ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(",")),
  ].join("\r\n");
  return new Response(`\uFEFF${body}\r\n`, {
    headers: {
      "cache-control": "no-store",
      "content-disposition": `attachment; filename="${filename}"`,
      "content-type": "text/csv; charset=utf-8",
      "x-content-type-options": "nosniff",
    },
  });
}

export function jsonResponse(filename: string, value: unknown) {
  return new Response(JSON.stringify(value, null, 2), {
    headers: {
      "cache-control": "no-store",
      "content-disposition": `attachment; filename="${filename}"`,
      "content-type": "application/json; charset=utf-8",
      "x-content-type-options": "nosniff",
    },
  });
}
