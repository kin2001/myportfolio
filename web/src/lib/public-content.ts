import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "@/lib/env";
import { publicAssetUrl as supabasePublicAssetUrl } from "@/lib/supabase/storage";
import type {
  PublishedCredential,
  PublishedProject,
} from "@/lib/portfolio-types";

type ProjectIndexRow = {
  id: string;
  current_publication_id: string;
  display_order: number;
};

type ProjectPublicationRow = {
  id: string;
  project_id: string;
  slug: string;
  title: string;
  excerpt: string;
  document: PublishedProject["document"];
  cover: PublishedProject["cover"];
  links: PublishedProject["links"];
  asset_manifest: PublishedProject["assetManifest"];
  published_at: string;
};

type CredentialPublicationRow = {
  id: string;
  slug: string;
  name: string;
  issuer: string;
  issue_date: string;
  expiry_date: string | null;
  skills: string[];
  related_project_id: string | null;
  verification_url: string | null;
  evidence_visibility: PublishedCredential["evidenceVisibility"];
  evidence: PublishedCredential["evidence"];
  published_at: string;
};

function publicClient() {
  const config = getSupabasePublicConfig();
  return config
    ? createClient(config.url, config.publishableKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;
}

export function publicAssetUrl(objectKey: string) {
  return supabasePublicAssetUrl(objectKey);
}

export async function getPublishedProjects(): Promise<PublishedProject[]> {
  const supabase = publicClient();
  if (!supabase) return [];

  const { data: index, error: indexError } = await supabase
    .from("projects")
    .select("id,current_publication_id,display_order")
    .order("display_order")
    .order("first_published_at");
  if (indexError) throw new Error(`Published project index failed: ${indexError.message}`);

  const rows = (index ?? []) as ProjectIndexRow[];
  if (!rows.length) return [];

  const { data: publications, error: publicationError } = await supabase
    .from("project_publications")
    .select("id,project_id,slug,title,excerpt,document,cover,links,asset_manifest,published_at")
    .in("id", rows.map((row) => row.current_publication_id));
  if (publicationError) throw new Error(`Published projects failed: ${publicationError.message}`);

  const byId = new Map(
    ((publications ?? []) as ProjectPublicationRow[]).map((publication) => [
      publication.id,
      publication,
    ]),
  );

  return rows.flatMap((row) => {
    const publication = byId.get(row.current_publication_id);
    return publication
      ? [{
          id: publication.project_id,
          slug: publication.slug,
          title: publication.title,
          excerpt: publication.excerpt,
          document: publication.document,
          cover: publication.cover,
          links: publication.links,
          assetManifest: publication.asset_manifest,
          publishedAt: publication.published_at,
          displayOrder: row.display_order,
        }]
      : [];
  });
}

export async function getPublishedProject(slug: string) {
  return (await getPublishedProjects()).find((project) => project.slug === slug) ?? null;
}

export async function getPublishedCredentials(): Promise<PublishedCredential[]> {
  const supabase = publicClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("credential_publications")
    .select("id,slug,name,issuer,issue_date,expiry_date,skills,related_project_id,verification_url,evidence_visibility,evidence,published_at")
    .order("issue_date", { ascending: false });
  if (error) throw new Error(`Published credentials failed: ${error.message}`);

  return ((data ?? []) as CredentialPublicationRow[]).map((credential) => ({
    id: credential.id,
    slug: credential.slug,
    name: credential.name,
    issuer: credential.issuer,
    issueDate: credential.issue_date,
    expiryDate: credential.expiry_date,
    skills: credential.skills,
    relatedProjectId: credential.related_project_id,
    verificationUrl: credential.verification_url,
    evidenceVisibility: credential.evidence_visibility,
    evidence: credential.evidence,
    publishedAt: credential.published_at,
  }));
}

export async function getPublishedCredential(slug: string) {
  return (await getPublishedCredentials()).find((credential) => credential.slug === slug) ?? null;
}
