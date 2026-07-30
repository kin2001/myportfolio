import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.redirect(new URL("/admin/login?error=not_configured", request.url));

  const callback = new URL("/auth/callback", request.url);
  callback.searchParams.set("next", "/admin");
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callback.toString(),
      queryParams: { prompt: "select_account" },
    },
  });

  if (error || !data.url) {
    return NextResponse.redirect(new URL("/admin/login?error=oauth_start_failed", request.url));
  }
  return NextResponse.redirect(data.url);
}
