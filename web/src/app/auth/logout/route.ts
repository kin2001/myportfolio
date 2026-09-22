import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSameOrigin } from "@/lib/request-security";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "origin_not_allowed" }, { status: 403 });
  const supabase = await createSupabaseServerClient();
  await supabase?.rpc("record_admin_logout");
  await supabase?.auth.signOut();
  return NextResponse.redirect(new URL("/admin/login", request.url), 303);
}
