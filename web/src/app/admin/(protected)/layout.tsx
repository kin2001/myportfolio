import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { getAdminIdentity } from "@/lib/supabase/auth";

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminIdentity();
  if (!admin) redirect("/admin/login");
  return <AdminShell accountLabel={admin.email ?? admin.id}>{children}</AdminShell>;
}
