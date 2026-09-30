import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { brisbaneToday } from "@/lib/costs";
import type { VideoType } from "@/lib/types";
import { runCheckVideoRender, runGenerateBrandPhotos, runGenerateVideo, runPostGeneratedVideo } from "@/lib/videoPipeline";
import { generateConceptJersey } from "@/lib/imageGen";

export const maxDuration = 60;

const OWNER_ID = process.env.META_OWNER_USER_ID!;
const VIDEO_TYPES: VideoType[] = ["product_showcase", "educational", "service_promo"];
/** How many new photo-scenes to include if there's no prior video to rotate
 * against -- keeps a fresh auto-generated video to a sensible length. */
const SCENES_PER_VIDEO = 5;
/** How many new videos to post per day -- spread across several cron schedule
 * entries in vercel.json, since Vercel Hobby caps each one at once daily. */
const DAILY_VIDEO_TARGET = 4;

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

/** Used only when there's no real, approved customer design yet -- rotated through
 * so consecutive invented concepts don't look identical. Never a real team, club or
 * league: these are original, generic jersey concepts invented for marketing only. */
const CONCEPT_THEMES = [
  "A bold navy and gold rugby jersey with a geometric mountain-range pattern across the chest.",
  "A vibrant teal and white soccer jersey with a subtle wave pattern flowing along the sides.",
  "A classic maroon and cream Australian rules guernsey with a bold diagonal stripe.",
  "A modern black and neon-green touch football jersey with sharp angular accent panels.",
  "A traditional royal blue and white cricket shirt with a thin red pinstripe collar.",
  "A sunset-orange and charcoal basketball singlet with a faded gradient down the sides.",
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

  // A video that posted to Facebook but was still waiting on Instagram to
  // finish processing (e.g. because the 30s poll window ran out) has no
  // running render to re-check -- retry publishing it directly instead of
  // leaving it stuck.
  const { data: pendingInstagram } = await supabase
    .from("generated_videos")
    .select("id, status, output_url, script, fb_post_id, ig_creation_id")
    .eq("owner_id", OWNER_ID)
    .eq("status", "ready")
    .not("fb_post_id", "is", null)
    .is("ig_media_id", null);

  for (const video of pendingInstagram ?? []) {
    const posted = await runPostGeneratedVideo(supabase, video);
    log.push(`retry instagram ${video.id}: ${posted.ok ? posted.message : posted.error}`);
  }

  // Vercel Hobby limits each individual cron job to once a day, so hitting this
  // route DAILY_VIDEO_TARGET times a day (see vercel.json) needs several separate
  // schedule entries rather than one more-frequent one -- each invocation still
  // only generates one video, and this counts how many have already gone out
  // today across all of them.
  const { data: recentVideos } = await supabase
    .from("generated_videos")
    .select("created_at")
    .eq("owner_id", OWNER_ID)
    .order("created_at", { ascending: false })
    .limit(20);

  const videosGeneratedToday = (recentVideos ?? []).filter(
    (v) => brisbaneDateOf(v.created_at) === brisbaneToday()
  ).length;

  if (videosGeneratedToday >= DAILY_VIDEO_TARGET) {
    log.push(`skip generate: already generated ${videosGeneratedToday} video(s) today (target ${DAILY_VIDEO_TARGET})`);
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

  // Keep a steady supply of fresh AI product photos -- guided by a real customer
  // design when one is approved and ready, so quality doesn't drift over repeated
  // generations. Best-effort: a failure here shouldn't block today's video.
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
  } else {
    // No real, approved customer design exists yet -- invent an original jersey
    // concept with OpenAI instead of skipping the day entirely. Clearly labelled
    // (never a real team/club/league) and rotated through a set of themes for
    // variety. The moment a real design is approved above, this stops running.
    const theme = CONCEPT_THEMES[(totalVideos ?? 0) % CONCEPT_THEMES.length];
    try {
      const concept = await generateConceptJersey(theme);
      const storagePath = `${OWNER_ID}/photo/${Date.now()}-concept.png`;
      const { error: uploadError } = await supabase.storage
        .from("brand-assets")
        .upload(storagePath, concept, { contentType: "image/png" });
      if (uploadError) throw new Error(uploadError.message);
      await supabase.from("video_brand_assets").insert({
        owner_id: OWNER_ID,
        kind: "photo",
        storage_path: storagePath,
        caption: "An original Jersey Mart concept design",
        generation_prompt: `AI-invented concept (no approved customer design yet): ${theme}`,
      });
      log.push(`concept gen: invented a new jersey concept -- ${theme}`);
    } catch (err) {
      log.push(`concept gen failed: ${err instanceof Error ? err.message : "unknown error"}`);
    }
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
