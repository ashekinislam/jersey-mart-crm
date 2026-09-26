import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { brisbaneToday, inRange, periodPresets, resolvePeriod, type PeriodKind } from "@/lib/costs";
import type { GeneratedVideo, VideoBrandAsset } from "@/lib/types";
import { BrandAssetsSection } from "@/components/BrandAssetsSection";
import { VideoGeneratorForm } from "@/components/VideoGeneratorForm";
import { AIPhotoGeneratorForm } from "@/components/AIPhotoGeneratorForm";
import { GeneratedVideosList } from "@/components/GeneratedVideosList";
import { CostsPeriodPicker } from "@/components/CostsPeriodPicker";
import type { DesignOption } from "@/components/PhotoCheckbox";

export const maxDuration = 60;

type DesignJoinRow = {
  id: string;
  storage_path: string;
  label: string | null;
  teams: { team_name: string; orders: { customers: { name: string } | null } | null } | null;
};

export default async function VideosPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; month?: string; from?: string; to?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const today = brisbaneToday();
  const chosen = resolvePeriod(sp, today);

  const [{ data: brandAssets }, { data: designs }, { data: videos }] = await Promise.all([
    supabase
      .from("video_brand_assets")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("designs")
      .select("id, storage_path, label, teams(team_name, orders(customers(name)))")
      .eq("stage", "machine_ready")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("generated_videos")
      .select("*")
      .order("created_at", { ascending: false }),
  ]);

  const designRows = (designs ?? []) as unknown as DesignJoinRow[];
  const designPaths = designRows.map((d) => d.storage_path);
  const brandPaths = (brandAssets ?? []).map((a: VideoBrandAsset) => a.storage_path);

  const [designSigned, brandSigned] = await Promise.all([
    designPaths.length
      ? supabase.storage.from("designs").createSignedUrls(designPaths, 3600)
      : Promise.resolve({ data: [] }),
    brandPaths.length
      ? supabase.storage.from("brand-assets").createSignedUrls(brandPaths, 3600)
      : Promise.resolve({ data: [] }),
  ]);

  const designUrlByPath = new Map((designSigned.data ?? []).map((u) => [u.path, u.signedUrl]));
  const brandUrlByPath = new Map((brandSigned.data ?? []).map((u) => [u.path, u.signedUrl]));

  const designOptions: DesignOption[] = designRows.map((d) => ({
    id: d.id,
    url: designUrlByPath.get(d.storage_path) ?? null,
    caption: d.label || [d.teams?.orders?.customers?.name, d.teams?.team_name].filter(Boolean).join(" — ") || "Untitled",
  }));

  const brandPhotoOptions: DesignOption[] = (brandAssets ?? [])
    .filter((a: VideoBrandAsset) => a.kind === "photo")
    .map((a: VideoBrandAsset) => ({ id: a.id, url: brandUrlByPath.get(a.storage_path) ?? null, caption: a.caption ?? "Brand photo" }));

  const logoOptions: DesignOption[] = (brandAssets ?? [])
    .filter((a: VideoBrandAsset) => a.kind === "logo")
    .map((a: VideoBrandAsset) => ({ id: a.id, url: brandUrlByPath.get(a.storage_path) ?? null, caption: a.caption ?? "Logo" }));

  const videosInPeriod = ((videos ?? []) as GeneratedVideo[]).filter((v) => inRange(v.created_at.slice(0, 10), chosen.period));

  const videosHref = (choice: { period: PeriodKind; from?: string; to?: string }) =>
    `/videos?${new URLSearchParams({
      month: chosen.month,
      period: choice.period,
      ...(choice.period === "custom" ? { from: choice.from ?? chosen.from, to: choice.to ?? chosen.to } : {}),
    })}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Videos</h1>
        <p className="mt-1 text-sm text-slate-500">
          Auto-generate short promotional and educational videos from the jerseys you&apos;ve produced. Each one gets
          a written script, an AI voiceover, and a rendered video — no review needed before it&apos;s ready.
        </p>
      </div>

      <BrandAssetsSection assets={(brandAssets ?? []) as VideoBrandAsset[]} urls={Object.fromEntries(brandUrlByPath)} />

      <AIPhotoGeneratorForm designOptions={designOptions} brandPhotoOptions={brandPhotoOptions} />

      <VideoGeneratorForm designOptions={designOptions} brandPhotoOptions={brandPhotoOptions} logoOptions={logoOptions} />

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Generated videos — {chosen.label}</h2>
        <div className="mt-2">
          <CostsPeriodPicker
            kind={chosen.kind}
            month={chosen.month}
            from={chosen.from}
            to={chosen.to}
            presets={periodPresets(today)}
            hrefFor={videosHref}
            carry={{}}
          />
        </div>
        <GeneratedVideosList videos={videosInPeriod} />
      </section>
    </div>
  );
}
