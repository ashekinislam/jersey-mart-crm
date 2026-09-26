import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { brisbaneToday } from "@/lib/costs";
import type { VideoType } from "@/lib/types";
import { runCheckVideoRender, runGenerateBrandPhotos, runGenerateVideo, runPostGeneratedVideo } from "@/lib/videoPipeline";

export const maxDuration = 60;

const OWNER_ID = process.env.META_OWNER_USER_ID!;
const VIDEO_TYPES: VideoType[] = ["product_showcase", "educational", "service_promo"];
/** How many new photo-scenes to include if there's no prior video to rotate
 * against -- keeps a fresh auto-generated video to a sensible length. */
const SCENES_PER_VIDEO = 5;

/** Rotated through so the AI photo pool doesn't turn into the same shot
 * over and over. Always describes a NEW scene for an EXISTING real jersey
 * (the reference photo), never a new product design. */
const PHOTO_SCENE_PROMPTS = [
  "this jersey being worn by a player mid-action on an outdoor sports field, natural daylight, dynamic pose",
  "this jersey on a mannequin in a clean studio setting, soft even lighting, product-catalogue style",
  "a close-up detail shot of this jersey's fabric and stitching, natural light, shallow depth of field",
  "this jersey folded neatly on a wooden table next to a ball from its sport, warm natural light",
  "a team huddled together wearing this jersey on a grass field at golden hour",
];

function brisbaneDateOf(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Brisbane" }).format(new Date(iso));
}

/** Runs once a day (see vercel.json): finishes and auto-posts any video that
 * rendered since the last run, then -- at most once per day -- kicks off a
 * new one, cycling through video types and always preferring photos that
 * haven't been in a video yet. Nothing here is reviewed before it posts, by
 * design (Jersey Mart's own choice, made when this feature was built). */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const log: string[] = [];

  const { data: rendering } = await supabase
    .from("generated_videos")
    .select("id, render_id, render_bucket_name, status, output_url, script, fb_post_id, ig_creation_id")
    .eq("owner_id", OWNER_ID)
    .eq("status", "rendering");

  for (const video of rendering ?? []) {
    const checked = await runCheckVideoRender(supabase, video);
    log.push(`check ${video.id}: ${checked.ok ? checked.message : checked.error}`);
    if (checked.ok && checked.message === "Video is ready!") {
      const { data: fresh } = await supabase
        .from("generated_videos")
        .select("id, status, output_url, script, fb_post_id, ig_creation_id")
        .eq("id", video.id)
        .single();
      if (fresh) {
        const posted = await runPostGeneratedVideo(supabase, fresh);
        log.push(`post ${video.id}: ${posted.ok ? posted.message : posted.error}`);
      }
    }
  }

  const { data: latest } = await supabase
    .from("generated_videos")
    .select("created_at")
    .eq("owner_id", OWNER_ID)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const alreadyGeneratedToday = latest ? brisbaneDateOf(latest.created_at) === brisbaneToday() : false;
  if (alreadyGeneratedToday) {
    log.push("skip generate: already generated a video today");
    return NextResponse.json({ ok: true, log });
  }

  const { count: totalVideos } = await supabase
    .from("generated_videos")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", OWNER_ID);
  const videoType = VIDEO_TYPES[(totalVideos ?? 0) % VIDEO_TYPES.length];

  const { data: designs } = await supabase
    .from("designs")
    .select("id, created_at")
    .eq("owner_id", OWNER_ID)
    .eq("stage", "machine_ready")
    .eq("status", "approved")
    .order("created_at", { ascending: true });

  // Keep a steady supply of fresh AI product photos -- always guided by a
  // real (never AI-generated) Design photo, so quality doesn't drift over
  // repeated generations. Best-effort: a failure here shouldn't block
  // today's video.
  if (designs && designs.length > 0) {
    const referenceDesign = designs[designs.length - 1];
    const scenePrompt = PHOTO_SCENE_PROMPTS[(totalVideos ?? 0) % PHOTO_SCENE_PROMPTS.length];
    const photoResult = await runGenerateBrandPhotos(supabase, OWNER_ID, {
      referenceDesignIds: [referenceDesign.id],
      referenceBrandAssetIds: [],
      prompt: scenePrompt,
      count: 1,
    });
    log.push(`photo gen: ${photoResult.ok ? photoResult.message : photoResult.error}`);
  }

  const { data: brandAssets } = await supabase
    .from("video_brand_assets")
    .select("id, kind, created_at")
    .eq("owner_id", OWNER_ID)
    .order("created_at", { ascending: true });

  const brandPhotos = (brandAssets ?? []).filter((a) => a.kind === "photo");
  const logo = (brandAssets ?? []).find((a) => a.kind === "logo");

  const { data: pastVideos } = await supabase
    .from("generated_videos")
    .select("source_design_ids, source_brand_asset_ids")
    .eq("owner_id", OWNER_ID);

  const usedIds = new Set((pastVideos ?? []).flatMap((v) => [...(v.source_design_ids ?? []), ...(v.source_brand_asset_ids ?? [])]));

  const pickUnusedFirst = <T extends { id: string }>(all: T[]) => {
    const unused = all.filter((x) => !usedIds.has(x.id));
    return unused.length > 0 ? unused : all;
  };

  const designPool = pickUnusedFirst(designs ?? []);
  const brandPool = pickUnusedFirst(brandPhotos);
  const designIds = designPool.slice(0, SCENES_PER_VIDEO).map((d) => d.id);
  const brandPhotoAssetIds = brandPool.slice(0, Math.max(SCENES_PER_VIDEO - designIds.length, 0)).map((a) => a.id);

  if (designIds.length + brandPhotoAssetIds.length === 0) {
    log.push("skip generate: no approved designs or brand photos available yet");
    return NextResponse.json({ ok: true, log });
  }

  const result = await runGenerateVideo(supabase, OWNER_ID, {
    videoType,
    designIds,
    brandPhotoAssetIds,
    logoAssetId: logo?.id ?? null,
  });
  log.push(`generate (${videoType}, ${designIds.length + brandPhotoAssetIds.length} photos): ${result.ok ? result.message : result.error}`);

  return NextResponse.json({ ok: result.ok, log });
}
