import { readCurrentCvPointer, readVerifiedPrivatePdf } from "@/lib/r2";

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
    const pointer = await readCurrentCvPointer();
    if (!pointer || "invalid" in pointer) {
      console.error("[resume.pdf] CV storage is unavailable or invalid.");
      return unavailable(503);
    }
    if ("absent" in pointer) return unavailable(404);
    const current = await readVerifiedPrivatePdf({
      key: pointer.objectKey,
      sizeBytes: pointer.sizeBytes,
      checksumSha256: pointer.checksumSha256,
    });
    if (!current) {
      console.error("[resume.pdf] Current CV failed integrity verification.");
      return unavailable(503);
    }

    const headers = new Headers({
      "cache-control": "no-store",
      "content-disposition": 'attachment; filename="Artkin-Carreon-CV.pdf"',
      "content-type": "application/pdf",
      "x-content-type-options": "nosniff",
    });
    headers.set("content-length", current.byteLength.toString());
    return new Response(current, { headers });
  } catch {
    console.error("[resume.pdf] CV storage request failed.");
    return unavailable(503);
  }
}
