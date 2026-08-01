import { CvManager, type CvVersion } from "@/components/cv-manager";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { registerCvVersion, setCurrentCv } from "./actions";

export default async function CvAdminPage() {
  const supabase = await createSupabaseServerClient();
  const [{ data: rows }, { data: settings }] = supabase
    ? await Promise.all([
        supabase
          .from("cv_versions")
          .select("id,asset_id,original_filename,size_bytes,version_note,uploaded_at")
          .order("uploaded_at", { ascending: false }),
        supabase
          .from("site_settings")
          .select("current_cv_version_id")
          .eq("singleton", true)
          .maybeSingle(),
      ])
    : [{ data: [] }, { data: null }];
  const versions: CvVersion[] = (rows ?? []).map((row) => ({
    id: row.id,
    assetId: row.asset_id,
    filename: row.original_filename,
    sizeBytes: row.size_bytes,
    note: row.version_note,
    uploadedAt: row.uploaded_at,
  }));

  return (
    <div className="max-w-6xl">
      <div className="border-b border-[var(--line)] pb-8">
        <p className="mono-meta accent">[ CV_VERSIONS ]</p>
        <h1 className="mt-4 text-4xl font-semibold">CV</h1>
        <p className="mt-4 max-w-2xl leading-7 ink-soft">
          Every uploaded PDF stays private. Only the selected current version is copied to the public download.
        </p>
      </div>
      <div className="mt-8">
        <CvManager
          versions={versions}
          currentVersionId={settings?.current_cv_version_id ?? null}
          registerVersion={registerCvVersion}
          setCurrent={setCurrentCv}
        />
      </div>
    </div>
  );
}
