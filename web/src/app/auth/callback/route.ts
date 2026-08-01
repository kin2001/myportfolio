import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function safeNext(value: string | null) {
  return value?.startsWith("/admin") && !value.startsWith("//") ? value : "/admin";
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const supabase = await createSupabaseServerClient();
  if (!code || !supabase) {
    return NextResponse.redirect(new URL("/admin/login?error=oauth_callback_failed", request.url));
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/admin/login?error=oauth_callback_failed", request.url));

  const { data: allowed } = await supabase.rpc("current_user_is_admin");
  if (allowed !== true) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/admin/login?error=not_allowed", request.url));
  }

  const { error: auditError } = await supabase.rpc("record_admin_login");
  if (auditError) {
    await supabase.auth.signOut();
    return NextResponse.redirect(
      new URL("/admin/login?error=oauth_callback_failed", request.url),
    );
  }
  return NextResponse.redirect(new URL(safeNext(url.searchParams.get("next")), request.url));
}
