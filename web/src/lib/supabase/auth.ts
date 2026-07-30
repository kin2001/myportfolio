import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AdminIdentity = {
  id: string;
  email: string | null;
};

export async function getAdminIdentity(): Promise<AdminIdentity | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as { sub?: string; email?: string } | undefined;
  if (claimsError || !claims?.sub) return null;

  const { data: allowed, error: allowlistError } = await supabase.rpc("current_user_is_admin");
  if (allowlistError || allowed !== true) return null;
  return { id: claims.sub, email: claims.email ?? null };
}
