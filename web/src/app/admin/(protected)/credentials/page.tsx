import { CredentialEditor, type CredentialRecord } from "@/components/credential-editor";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  archiveCredential,
  createCredential,
  publishCredential,
  retryCredentialDeployment,
  saveCredential,
} from "./actions";

export default async function CredentialsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const [{ data: rows }, { data: projects }] = supabase
    ? await Promise.all([
        supabase
          .from("credentials")
          .select("id,slug,name,issuer,issue_date,expiry_date,skills,related_project_id,verification_url,evidence_asset_id,evidence_visibility,evidence_alt,redaction_confirmed,lifecycle_state,lock_version")
          .order("updated_at", { ascending: false }),
        supabase
          .from("projects")
          .select("id,current:project_publications!projects_current_publication_fk(title)")
          .eq("lifecycle_state", "published")
          .order("display_order", { ascending: true }),
      ])
    : [{ data: [] }, { data: [] }];
  const credentials: CredentialRecord[] = (rows ?? []).map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    issuer: row.issuer,
    issueDate: row.issue_date,
    expiryDate: row.expiry_date,
    skills: row.skills ?? [],
    relatedProjectId: row.related_project_id,
    verificationUrl: row.verification_url,
    evidenceAssetId: row.evidence_asset_id,
    evidenceVisibility: row.evidence_visibility,
    evidenceAlt: row.evidence_alt,
    redactionConfirmed: row.redaction_confirmed,
    lifecycleState: row.lifecycle_state,
    lockVersion: row.lock_version,
  }));
  const requestedId = (await searchParams).id;
  const selected = credentials.find((credential) => credential.id === requestedId) ?? null;
  const projectOptions = (projects ?? []).map((project) => {
    const current = project.current as unknown as { title: string } | { title: string }[] | null;
    return {
      id: project.id,
      title: Array.isArray(current) ? current[0]?.title : current?.title,
    };
  }).filter((project): project is { id: string; title: string } => Boolean(project.title));

  return (
    <div className="max-w-6xl">
      <div className="border-b border-[var(--line)] pb-8">
        <p className="mono-meta accent">[ CREDENTIAL_CONTROL ]</p>
        <h1 className="mt-4 text-4xl font-semibold">Credentials</h1>
        <p className="mt-4 max-w-2xl leading-7 ink-soft">
          Draft, verify, and publish credentials without exposing private evidence.
        </p>
      </div>
      <div className="mt-8">
        <CredentialEditor
          key={selected?.id ?? "empty"}
          credentials={credentials}
          selected={selected}
          projects={projectOptions}
          createCredential={createCredential}
          saveCredential={saveCredential}
          publishCredential={publishCredential}
          archiveCredential={archiveCredential}
          retryDeployment={retryCredentialDeployment}
        />
      </div>
    </div>
  );
}
