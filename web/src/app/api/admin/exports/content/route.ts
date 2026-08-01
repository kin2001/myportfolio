import { exportClient, exportError, jsonResponse } from "../_shared";

export async function GET() {
  const supabase = await exportClient();
  if (!supabase) return exportError(401);

  const results = await Promise.all([
    supabase.from("projects").select("*").order("display_order"),
    supabase.from("project_drafts").select("*").order("updated_at"),
    supabase.from("project_publications").select("*").order("published_at"),
    supabase.from("credentials").select("*").order("updated_at"),
    supabase.from("credential_publications").select("*").order("published_at"),
    supabase.from("cv_versions").select("*").order("uploaded_at"),
    supabase.from("site_settings").select("*").eq("singleton", true).maybeSingle(),
  ]);
  if (results.some((result) => result.error)) return exportError(503);
  const { error: auditError } = await supabase.rpc("record_content_export");
  if (auditError) return exportError(503);

  const [
    projects,
    projectDrafts,
    projectPublications,
    credentials,
    credentialPublications,
    cvVersions,
    siteSettings,
  ] = results;
  const stamp = new Date().toISOString();
  return jsonResponse(`portfolio-content-${stamp.slice(0, 10)}.json`, {
    schemaVersion: 1,
    exportedAt: stamp,
    projects: projects.data ?? [],
    projectDrafts: projectDrafts.data ?? [],
    projectPublications: projectPublications.data ?? [],
    credentials: credentials.data ?? [],
    credentialPublications: credentialPublications.data ?? [],
    cvVersions: cvVersions.data ?? [],
    siteSettings: siteSettings.data ?? null,
  });
}
