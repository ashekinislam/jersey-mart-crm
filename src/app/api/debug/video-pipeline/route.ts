import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { runGenerateVideo, runCheckVideoRender } from "@/lib/videoPipeline";

// TEMPORARY, CRON_SECRET-gated: on-demand generate/check, requested directly by the
// owner to see a video right now. Same pipeline the cron uses, no auto-posting.
export const maxDuration = 60;
const OWNER_ID = process.env.META_OWNER_USER_ID!;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const action = request.nextUrl.searchParams.get("action");

  if (action === "check") {
    const videoId = request.nextUrl.searchParams.get("id")!;
    const { data: video } = await supabase
      .from("generated_videos")
      .select("id, render_id, render_bucket_name, status, output_url, error_message")
      .eq("id", videoId)
      .single();
    if (!video) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (video.status === "rendering") {
      const result = await runCheckVideoRender(supabase, video);
      return NextResponse.json({ checkResult: result, video });
    }
    return NextResponse.json({ video });
  }

  const { data: brandAssets } = await supabase
    .from("video_brand_assets")
    .select("id, kind")
    .eq("owner_id", OWNER_ID)
    .eq("kind", "photo");
  const brandPhotoAssetIds = (brandAssets ?? []).map((a) => a.id);
  if (brandPhotoAssetIds.length === 0) {
    return NextResponse.json({ error: "no brand photos available" }, { status: 400 });
  }

  const result = await runGenerateVideo(supabase, OWNER_ID, {
    videoType: "product_showcase",
    designIds: [],
    brandPhotoAssetIds,
    logoAssetId: null,
  });

  const { data: latest } = await supabase
    .from("generated_videos")
    .select("id, status, script")
    .eq("owner_id", OWNER_ID)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return NextResponse.json({ result, latest });
}
