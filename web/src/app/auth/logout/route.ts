import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  await supabase?.rpc("record_admin_logout");
  await supabase?.auth.signOut();
  return NextResponse.redirect(new URL("/admin/login", request.url), 303);
}
