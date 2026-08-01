export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    { status: "ok", service: "artkin-portfolio", checkedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
