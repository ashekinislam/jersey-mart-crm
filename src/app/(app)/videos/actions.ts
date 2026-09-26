"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/costs";
import type { VideoType } from "@/lib/types";
import { runGenerateBrandPhotos, runGenerateVideo, runCheckVideoRender, runPostGeneratedVideo } from "@/lib/videoPipeline";
import { deleteFacebookPost, deleteInstagramMedia } from "@/lib/metaPublish";

const VIDEO_TYPES = new Set(["product_showcase", "educational", "service_promo"]);

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

interface GenerateBrandPhotosInput {
  referenceDesignIds: string[];
  referenceBrandAssetIds: string[];
  prompt: string;
  count: number;
}

/** Generates new brand photos guided by real reference photos (Design
 * photos and/or existing brand assets), via OpenAI's image edit endpoint.
 * The results are saved as ordinary brand assets, pickable for videos just
 * like any uploaded photo. */
export async function generateBrandPhotos(input: GenerateBrandPhotosInput): Promise<ActionResult> {
  const refCount = input.referenceDesignIds.length + input.referenceBrandAssetIds.length;
  if (refCount === 0) return { ok: false, error: "Pick at least one reference photo." };
  if (refCount > 4) return { ok: false, error: "Pick 4 reference photos or fewer." };

  const { supabase, user } = await requireUser();
  const result = await runGenerateBrandPhotos(supabase, user.id, input);
  revalidatePath("/videos");
  return result;
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
  const result = await runGenerateVideo(supabase, user.id, input);
  revalidatePath("/videos");
  return result;
}

export async function refreshVideoStatus(videoId: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const { data: video } = await supabase
    .from("generated_videos")
    .select("id, render_id, render_bucket_name, status")
    .eq("id", videoId)
    .single();

  if (!video) return { ok: false, error: "Video not found." };
  if (video.status !== "rendering") return { ok: true, message: "Already up to date." };

  const result = await runCheckVideoRender(supabase, video);
  revalidatePath("/videos");
  return result;
}

/** Deletes the CRM record and its voiceover file, and -- if it was already
 * posted -- removes the actual Facebook post and Instagram media too, so
 * "delete" really means gone, not just hidden from this list. */
export async function deleteGeneratedVideo(videoId: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const { data: video } = await supabase
    .from("generated_videos")
    .select("voiceover_storage_path, fb_post_id, ig_media_id")
    .eq("id", videoId)
    .single();

  if (video?.voiceover_storage_path) {
    await supabase.storage.from("voiceovers").remove([video.voiceover_storage_path]);
  }
  await Promise.all([
    video?.fb_post_id ? deleteFacebookPost(video.fb_post_id) : Promise.resolve(),
    video?.ig_media_id ? deleteInstagramMedia(video.ig_media_id) : Promise.resolve(),
  ]);
  await supabase.from("generated_videos").delete().eq("id", videoId);

  revalidatePath("/videos");
  return { ok: true };
}

/** Posts a ready video to Jersey Mart's own Facebook Page and Instagram
 * account. Safe to call again if Instagram was still processing last time
 * -- it reuses the Facebook post and Instagram upload it already made
 * rather than posting duplicates. */
export async function postGeneratedVideo(videoId: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const { data: video } = await supabase
    .from("generated_videos")
    .select("id, status, output_url, script, fb_post_id, ig_creation_id")
    .eq("id", videoId)
    .single();

  if (!video) return { ok: false, error: "Video not found." };
  const result = await runPostGeneratedVideo(supabase, video);
  revalidatePath("/videos");
  return result;
}
