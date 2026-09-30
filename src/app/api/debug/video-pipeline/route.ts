import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

// TEMPORARY, read-only diagnostic -- same CRON_SECRET-gated pattern as the real cron
// routes, added to answer "why hasn't today's video posted" without ever calling
// anything that could post to Facebook/Instagram. Remove once answered.
const OWNER_ID = process.env.META_OWNER_USER_ID!;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  const { data: videos } = await supabase
    .from("generated_videos")
    .select("id, video_type, status, error_message, created_at, posted_at, render_id, output_url")
    .eq("owner_id", OWNER_ID)
    .order("created_at", { ascending: false })
    .limit(5);

  const { data: brandAssets } = await supabase
    .from("video_brand_assets")
    .select("id, kind, created_at")
    .eq("owner_id", OWNER_ID);

  const { data: designs } = await supabase
    .from("designs")
    .select("id, stage, status")
    .eq("owner_id", OWNER_ID)
    .eq("stage", "machine_ready")
    .eq("status", "approved");

  const { data: allDesigns } = await supabase
    .from("designs")
    .select("stage, status, created_at")
    .eq("owner_id", OWNER_ID)
    .order("created_at", { ascending: false });
  const designBreakdown = new Map<string, number>();
  for (const d of allDesigns ?? []) {
    const key = `${d.stage}/${d.status}`;
    designBreakdown.set(key, (designBreakdown.get(key) ?? 0) + 1);
  }

  const { data: adSync } = await supabase
    .from("reckon_connections")
    .select("owner_id")
    .limit(0); // just proving the service client itself works; not otherwise relevant here

  return NextResponse.json({
    now: new Date().toISOString(),
    recentVideos: videos ?? [],
    brandAssetCount: (brandAssets ?? []).length,
    brandAssetKinds: [...new Set((brandAssets ?? []).map((a) => a.kind))],
    approvedMachineReadyDesignCount: (designs ?? []).length,
    totalDesignCount: (allDesigns ?? []).length,
    designBreakdown: Object.fromEntries(designBreakdown),
    mostRecentDesign: allDesigns?.[0] ?? null,
    serviceClientOk: adSync !== undefined,
  });
}
