import { readCurrentCv } from "@/lib/supabase/storage";

export const dynamic = "force-dynamic";

function unavailable(status: 404 | 503) {
  return new Response(
    status === 404 ? "CV not available." : "CV service temporarily unavailable.", {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

export async function GET() {
  try {
    const current = await readCurrentCv();
    if (current.status === "absent") return unavailable(404);
    if (current.status === "unavailable") {
      console.error("[resume.pdf] Current CV failed integrity verification.");
      return unavailable(503);
    }

    const headers = new Headers({
      "cache-control": "no-store",
      "content-disposition": 'attachment; filename="Artkin-Carreon-CV.pdf"',
      "content-type": "application/pdf",
      "x-content-type-options": "nosniff",
    });
    headers.set("content-length", current.body.byteLength.toString());
    return new Response(new Uint8Array(current.body), { headers });
  } catch {
    console.error("[resume.pdf] CV storage request failed.");
    return unavailable(503);
  }
}
