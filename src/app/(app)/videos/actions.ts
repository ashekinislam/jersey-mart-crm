"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/costs";
import type { VideoType } from "@/lib/types";
import { generateVideoScript } from "@/lib/videoScript";
import { synthesizeVoiceover } from "@/lib/tts";
import { startVideoRender, checkVideoRender } from "@/lib/remotionRender";

const VIDEO_TYPES = new Set(["product_showcase", "educational", "service_promo"]);
const SIGNED_URL_SECONDS = 6 * 60 * 60;

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

// ---- Brand assets -------------------------------------------------------

export async function uploadBrandAsset(formData: FormData): Promise<void> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return;

  const kind = String(formData.get("kind") ?? "") as "photo" | "logo";
  if (kind !== "photo" && kind !== "logo") return;
  const caption = String(formData.get("caption") ?? "").trim() || null;

  const { supabase, user } = await requireUser();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${user.id}/${kind}/${Date.now()}-${safeName}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from("brand-assets")
    .upload(storagePath, buffer, { contentType: file.type || "application/octet-stream" });
  if (uploadError) return;

  await supabase.from("video_brand_assets").insert({
    owner_id: user.id,
    kind,
    storage_path: storagePath,
    caption,
  });

  revalidatePath("/videos");
}

export async function deleteBrandAsset(assetId: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const { data: asset } = await supabase
    .from("video_brand_assets")
    .select("storage_path")
    .eq("id", assetId)
    .single();

  if (asset) {
    await supabase.storage.from("brand-assets").remove([asset.storage_path]);
  }
  await supabase.from("video_brand_assets").delete().eq("id", assetId);

  revalidatePath("/videos");
  return { ok: true };
}

// ---- Video generation ---------------------------------------------------

interface GenerateVideoInput {
  videoType: VideoType;
  designIds: string[];
  brandPhotoAssetIds: string[];
  logoAssetId: string | null;
}

/** Writes a script, synthesizes narration, and kicks off the Lambda render.
 * Rendering itself happens on AWS after this returns -- this action only
 * needs to run long enough to start it, which comfortably fits inside a
 * normal serverless request. */
export async function generateVideo(input: GenerateVideoInput): Promise<ActionResult> {
  if (!VIDEO_TYPES.has(input.videoType)) return { ok: false, error: "Pick a video type." };
  const sceneSourceCount = input.designIds.length + input.brandPhotoAssetIds.length;
  if (sceneSourceCount === 0) return { ok: false, error: "Pick at least one photo to include." };
  if (sceneSourceCount > 12) return { ok: false, error: "Pick 12 photos or fewer for one video." };

  const { supabase, user } = await requireUser();

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

    const voiceoverPath = `${user.id}/${Date.now()}.mp3`;
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
      owner_id: user.id,
      video_type: input.videoType,
      status: "rendering",
      script: JSON.stringify(script),
      source_design_ids: input.designIds,
      source_brand_asset_ids: [...input.brandPhotoAssetIds, ...(input.logoAssetId ? [input.logoAssetId] : [])],
      voiceover_storage_path: voiceoverPath,
      render_id: renderId,
      render_bucket_name: bucketName,
    });

    revalidatePath("/videos");
    return { ok: true, message: "Video generation started — rendering now." };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." };
  }
}

export async function refreshVideoStatus(videoId: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const { data: video } = await supabase
    .from("generated_videos")
    .select("render_id, render_bucket_name, status")
    .eq("id", videoId)
    .single();

  if (!video?.render_id || !video.render_bucket_name) {
    return { ok: false, error: "This video has no render in progress." };
  }
  if (video.status !== "rendering") {
    return { ok: true, message: "Already up to date." };
  }

  try {
    const progress = await checkVideoRender(video.render_id, video.render_bucket_name);
    if (progress.fatalErrorEncountered) {
      await supabase
        .from("generated_videos")
        .update({ status: "failed", error_message: progress.errorMessage ?? "Render failed." })
        .eq("id", videoId);
      revalidatePath("/videos");
      return { ok: true, message: "Render failed — see the error below." };
    }
    if (progress.done && progress.outputUrl) {
      await supabase
        .from("generated_videos")
        .update({ status: "ready", output_url: progress.outputUrl })
        .eq("id", videoId);
      revalidatePath("/videos");
      return { ok: true, message: "Video is ready!" };
    }
    revalidatePath("/videos");
    return { ok: true, message: `Still rendering — ${Math.round(progress.overallProgress * 100)}%` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't check render status." };
  }
}

export async function deleteGeneratedVideo(videoId: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const { data: video } = await supabase
    .from("generated_videos")
    .select("voiceover_storage_path")
    .eq("id", videoId)
    .single();

  if (video?.voiceover_storage_path) {
    await supabase.storage.from("voiceovers").remove([video.voiceover_storage_path]);
  }
  await supabase.from("generated_videos").delete().eq("id", videoId);

  revalidatePath("/videos");
  return { ok: true };
}
