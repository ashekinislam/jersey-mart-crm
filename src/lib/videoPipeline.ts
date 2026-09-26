import type { SupabaseClient } from "@supabase/supabase-js";
import type { VideoType } from "./types";
import { generateVideoScript } from "./videoScript";
import { synthesizeVoiceover } from "./tts";
import { startVideoRender, checkVideoRender } from "./remotionRender";
import { postVideoToFacebookPage, startInstagramReel, waitAndPublishInstagram } from "./metaPublish";

const SIGNED_URL_SECONDS = 6 * 60 * 60;

export type PipelineResult = { ok: true; message: string } | { ok: false; error: string };

export interface GenerateVideoInput {
  videoType: VideoType;
  designIds: string[];
  brandPhotoAssetIds: string[];
  logoAssetId: string | null;
}

/** Writes a script, synthesizes narration, and kicks off the Lambda render.
 * Rendering itself happens on AWS after this returns -- this only needs to
 * run long enough to start it, which comfortably fits inside a normal
 * serverless request. Shared between the interactive "Generate video"
 * action and the daily auto-generation cron. */
export async function runGenerateVideo(
  supabase: SupabaseClient,
  ownerId: string,
  input: GenerateVideoInput
): Promise<PipelineResult> {
  try {
    const [{ data: designs }, { data: brandAssets }] = await Promise.all([
      input.designIds.length
        ? supabase
            .from("designs")
            .select("id, storage_path, label, team_id, teams(team_name, orders(customer_id, customers(name)))")
            .in("id", input.designIds)
        : Promise.resolve({ data: [] as never[] }),
      supabase
        .from("video_brand_assets")
        .select("id, storage_path, caption, kind")
        .in("id", [...input.brandPhotoAssetIds, ...(input.logoAssetId ? [input.logoAssetId] : [])]),
    ]);

    type DesignRow = {
      id: string;
      storage_path: string;
      label: string | null;
      teams: { team_name: string; orders: { customers: { name: string } | null } | null } | null;
    };
    type BrandAssetRow = { id: string; storage_path: string; caption: string | null; kind: string };

    const designRows = (designs ?? []) as unknown as DesignRow[];
    const brandAssetRows = (brandAssets ?? []) as unknown as BrandAssetRow[];
    const brandPhotoRows = brandAssetRows.filter((a) => input.brandPhotoAssetIds.includes(a.id));
    const logoRow = input.logoAssetId ? brandAssetRows.find((a) => a.id === input.logoAssetId) : undefined;

    const designPaths = designRows.map((d) => d.storage_path);
    const brandPaths = brandPhotoRows.map((a) => a.storage_path);

    const [designUrls, brandUrls, logoUrl] = await Promise.all([
      designPaths.length
        ? supabase.storage.from("designs").createSignedUrls(designPaths, SIGNED_URL_SECONDS)
        : Promise.resolve({ data: [] }),
      brandPaths.length
        ? supabase.storage.from("brand-assets").createSignedUrls(brandPaths, SIGNED_URL_SECONDS)
        : Promise.resolve({ data: [] }),
      logoRow
        ? supabase.storage.from("brand-assets").createSignedUrl(logoRow.storage_path, SIGNED_URL_SECONDS)
        : Promise.resolve({ data: null }),
    ]);

    const designUrlByPath = new Map((designUrls.data ?? []).map((u) => [u.path, u.signedUrl]));
    const brandUrlByPath = new Map((brandUrls.data ?? []).map((u) => [u.path, u.signedUrl]));

    const scenesInput = [
      ...designRows.map((d) => ({
        photoUrl: designUrlByPath.get(d.storage_path),
        caption:
          d.label ||
          [d.teams?.orders?.customers?.name, d.teams?.team_name].filter(Boolean).join(" — ") ||
          "A jersey Jersey Mart produced",
      })),
      ...brandPhotoRows.map((a) => ({
        photoUrl: brandUrlByPath.get(a.storage_path),
        caption: a.caption || "Jersey Mart",
      })),
    ].filter((s): s is { photoUrl: string; caption: string } => typeof s.photoUrl === "string");

    if (scenesInput.length === 0) {
      return { ok: false, error: "Couldn't load any of the selected photos — try again." };
    }

    const script = await generateVideoScript(
      input.videoType,
      scenesInput.map((s) => s.caption)
    );

    const narration = script.lines.map((l) => l.trim().replace(/([^.!?])$/, "$1.")).join(" ");
    const audioBuffer = await synthesizeVoiceover(narration);

    const voiceoverPath = `${ownerId}/${Date.now()}.mp3`;
    const { error: audioUploadError } = await supabase.storage
      .from("voiceovers")
      .upload(voiceoverPath, audioBuffer, { contentType: "audio/mpeg" });
    if (audioUploadError) return { ok: false, error: "Couldn't save the generated voiceover." };

    const { data: voiceoverSigned } = await supabase.storage
      .from("voiceovers")
      .createSignedUrl(voiceoverPath, SIGNED_URL_SECONDS);
    if (!voiceoverSigned?.signedUrl) return { ok: false, error: "Couldn't access the generated voiceover." };

    const { renderId, bucketName } = await startVideoRender({
      brandName: "Jersey Mart",
      headline: script.headline,
      logoUrl: logoUrl.data?.signedUrl ?? null,
      voiceoverUrl: voiceoverSigned.signedUrl,
      scenes: scenesInput.map((s, i) => ({ photoUrl: s.photoUrl, caption: script.lines[i] })),
    });

    await supabase.from("generated_videos").insert({
      owner_id: ownerId,
      video_type: input.videoType,
      status: "rendering",
      script: JSON.stringify(script),
      source_design_ids: input.designIds,
      source_brand_asset_ids: [...input.brandPhotoAssetIds, ...(input.logoAssetId ? [input.logoAssetId] : [])],
      voiceover_storage_path: voiceoverPath,
      render_id: renderId,
      render_bucket_name: bucketName,
    });

    return { ok: true, message: "Video generation started — rendering now." };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." };
  }
}

interface RenderingVideoRow {
  id: string;
  render_id: string | null;
  render_bucket_name: string | null;
}

/** Checks a single in-progress render and updates its row once it either
 * finishes or fails. Shared between the interactive "Check status" button
 * and the daily cron's sweep of pending renders. */
export async function runCheckVideoRender(supabase: SupabaseClient, video: RenderingVideoRow): Promise<PipelineResult> {
  if (!video.render_id || !video.render_bucket_name) {
    return { ok: false, error: "This video has no render in progress." };
  }
  try {
    const progress = await checkVideoRender(video.render_id, video.render_bucket_name);
    if (progress.fatalErrorEncountered) {
      await supabase
        .from("generated_videos")
        .update({ status: "failed", error_message: progress.errorMessage ?? "Render failed." })
        .eq("id", video.id);
      return { ok: true, message: "Render failed — see the error below." };
    }
    if (progress.done && progress.outputUrl) {
      await supabase.from("generated_videos").update({ status: "ready", output_url: progress.outputUrl }).eq("id", video.id);
      return { ok: true, message: "Video is ready!" };
    }
    return { ok: true, message: `Still rendering — ${Math.round(progress.overallProgress * 100)}%` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't check render status." };
  }
}

interface PostableVideoRow {
  id: string;
  status: string;
  output_url: string | null;
  script: string | null;
  fb_post_id: string | null;
  ig_creation_id: string | null;
}

/** Posts a ready video to Jersey Mart's own Facebook Page and Instagram
 * account. Safe to call again if Instagram was still processing last time
 * -- it reuses the Facebook post and Instagram upload it already made
 * rather than posting duplicates. Shared between the interactive "Post
 * now" button and the daily auto-posting cron. */
export async function runPostGeneratedVideo(supabase: SupabaseClient, video: PostableVideoRow): Promise<PipelineResult> {
  if (video.status !== "ready" || !video.output_url) {
    return { ok: false, error: "This video isn't ready to post yet." };
  }

  let headline = "Jersey Mart";
  let lines: string[] = [];
  try {
    const parsed = video.script ? (JSON.parse(video.script) as { headline: string; lines: string[] }) : null;
    if (parsed) {
      headline = parsed.headline;
      lines = parsed.lines;
    }
  } catch {
    // fall back to the defaults above
  }
  const caption = `${headline}\n\n${lines.join(" ")}\n\n#JerseyMart #CustomJerseys #TeamWear`;

  try {
    const fbPostId = video.fb_post_id ?? (await postVideoToFacebookPage(video.output_url, caption));
    const igCreationId = video.ig_creation_id ?? (await startInstagramReel(video.output_url, caption));
    const igMediaId = await waitAndPublishInstagram(igCreationId);

    await supabase
      .from("generated_videos")
      .update({
        fb_post_id: fbPostId,
        ig_creation_id: igCreationId,
        ig_media_id: igMediaId,
        status: igMediaId ? "posted" : "ready",
        posted_at: igMediaId ? new Date().toISOString() : null,
        error_message: igMediaId ? null : "Posted to Facebook; Instagram is still processing -- try posting again shortly.",
      })
      .eq("id", video.id);

    if (!igMediaId) {
      return { ok: true, message: "Posted to Facebook. Instagram is still processing -- try again in a minute." };
    }
    return { ok: true, message: "Posted to Facebook and Instagram!" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." };
  }
}
