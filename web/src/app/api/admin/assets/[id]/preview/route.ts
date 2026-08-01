import { NextResponse } from "next/server";
import { assetError, createAssetPreviewUrl, getAssetForAdmin } from "@/lib/assets";
import { getAdminIdentity } from "@/lib/supabase/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await getAdminIdentity();
  if (!admin) {
    return NextResponse.json(
      assetError("unauthorized", "Administrator access is required."),
      { status: 401 },
    );
  }

  const { id } = await params;
  const asset = await getAssetForAdmin(id);
  if (!asset) {
    return NextResponse.json(
      assetError("asset_not_found", "Asset was not found."),
      { status: 404 },
    );
  }
  if (asset.processing_state === "pending") {
    return NextResponse.json(
      assetError("asset_not_ready", "Finish validating the asset before previewing."),
      { status: 409 },
    );
  }

  const previewUrl = await createAssetPreviewUrl(asset).catch(() => null);
  if (!previewUrl) {
    return NextResponse.json(
      assetError("preview_unavailable", "The private preview is unavailable."),
      { status: 503 },
    );
  }
  return NextResponse.redirect(previewUrl, 307);
}
