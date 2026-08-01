import { createHash } from "node:crypto";
import { readPrivateObject } from "@/lib/r2";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return new Response("CV not available.", { status: 404 });
    const { data, error } = await supabase.rpc("current_cv_download");
    const current = Array.isArray(data) ? data[0] : null;
    if (error || !current?.object_key) {
      return new Response("CV not available.", { status: 404 });
    }
    const body = await readPrivateObject(current.object_key);
    if (
      !body ||
      body.byteLength !== Number(current.size_bytes) ||
      createHash("sha256").update(body).digest("hex") !==
        current.checksum_sha256
    ) {
      return new Response("CV not available.", { status: 404 });
    }
    const headers = new Headers({
      "cache-control": "no-store",
      "content-disposition": 'attachment; filename="Artkin-Carreon-CV.pdf"',
      "content-type": "application/pdf",
      "x-content-type-options": "nosniff",
    });
    headers.set("content-length", body.byteLength.toString());
    return new Response(body, {
      headers,
    });
  } catch {
    return new Response("CV not available.", {
      status: 404,
      headers: { "x-content-type-options": "nosniff" },
    });
  }
}
