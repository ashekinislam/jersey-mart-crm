import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

// TEMPORARY, read-only, CRON_SECRET-gated diagnostic -- checking what the latest
// generated video actually used and said, and whether concept generation ran.
const OWNER_ID = process.env.META_OWNER_USER_ID!;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  const { data: videos } = await supabase
    .from("generated_videos")
    .select(
      "id, video_type, status, error_message, script, source_design_ids, source_brand_asset_ids, created_at, output_url, fb_post_id, ig_media_id"
    )
    .eq("owner_id", OWNER_ID)
    .order("created_at", { ascending: false })
    .limit(5);

  const { data: brandAssets } = await supabase
    .from("video_brand_assets")
    .select("id, kind, caption, generation_prompt, created_at")
    .eq("owner_id", OWNER_ID)
    .order("created_at", { ascending: false })
    .limit(10);

  return NextResponse.json({
    now: new Date().toISOString(),
    recentVideos: videos ?? [],
    recentBrandAssets: brandAssets ?? [],
  });
}
