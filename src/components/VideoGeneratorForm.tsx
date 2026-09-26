"use client";

import { useMemo, useState, useTransition } from "react";
import { generateVideo } from "@/app/(app)/videos/actions";
import { VIDEO_TYPE_LABELS, type VideoType } from "@/lib/types";
import { useToast } from "@/components/ToastProvider";
import { PhotoCheckbox, type DesignOption } from "@/components/PhotoCheckbox";

export type { DesignOption };

export function VideoGeneratorForm({
  designOptions,
  brandPhotoOptions,
  logoOptions,
}: {
  designOptions: DesignOption[];
  brandPhotoOptions: DesignOption[];
  logoOptions: DesignOption[];
}) {
  const [videoType, setVideoType] = useState<VideoType>("product_showcase");
  const [designIds, setDesignIds] = useState<string[]>([]);
  const [brandPhotoIds, setBrandPhotoIds] = useState<string[]>([]);
  const [logoId, setLogoId] = useState<string>(logoOptions[0]?.id ?? "");
  const [isPending, startTransition] = useTransition();
  const showToast = useToast();

  const selectedCount = designIds.length + brandPhotoIds.length;
  const canSubmit = selectedCount > 0 && selectedCount <= 12 && !isPending;

  function toggle(list: string[], setList: (v: string[]) => void, id: string) {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  const helperText = useMemo(() => {
    if (selectedCount === 0) return "Pick at least one photo to include.";
    if (selectedCount > 12) return "Pick 12 photos or fewer for one video.";
    return `${selectedCount} photo${selectedCount === 1 ? "" : "s"} selected.`;
  }, [selectedCount]);

  function submit() {
    if (!canSubmit) return;
    startTransition(async () => {
      const result = await generateVideo({
        videoType,
        designIds,
        brandPhotoAssetIds: brandPhotoIds,
        logoAssetId: logoId || null,
      });
      showToast(result.ok ? (result.message ?? "Started") : result.error, result.ok ? "success" : "error");
      if (result.ok) {
        setDesignIds([]);
        setBrandPhotoIds([]);
      }
    });
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">Create a video</h2>
      <p className="mt-1 text-xs text-slate-500">
        Pick a video type and the photos to feature. The script, voiceover, and rendering all happen automatically.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="text-sm text-slate-700">Type:</label>
        <select
          value={videoType}
          onChange={(e) => setVideoType(e.target.value as VideoType)}
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        >
          {Object.entries(VIDEO_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        {logoOptions.length > 0 && (
          <>
            <label className="ml-4 text-sm text-slate-700">Logo:</label>
            <select value={logoId} onChange={(e) => setLogoId(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
              <option value="">None</option>
              {logoOptions.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.caption}
                </option>
              ))}
            </select>
          </>
        )}
      </div>

      {designOptions.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs font-semibold text-slate-700">Jerseys we&apos;ve produced</h3>
          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6">
            {designOptions.map((o) => (
              <PhotoCheckbox key={o.id} option={o} checked={designIds.includes(o.id)} onToggle={() => toggle(designIds, setDesignIds, o.id)} />
            ))}
          </div>
        </div>
      )}

      {brandPhotoOptions.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs font-semibold text-slate-700">Brand photos</h3>
          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6">
            {brandPhotoOptions.map((o) => (
              <PhotoCheckbox key={o.id} option={o} checked={brandPhotoIds.includes(o.id)} onToggle={() => toggle(brandPhotoIds, setBrandPhotoIds, o.id)} />
            ))}
          </div>
        </div>
      )}

      {designOptions.length === 0 && brandPhotoOptions.length === 0 && (
        <p className="mt-4 text-xs text-slate-500">
          No photos available yet — approve a machine-ready design on an order, or upload a brand photo above.
        </p>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          disabled={!canSubmit}
          onClick={submit}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {isPending ? "Starting…" : "Generate video"}
        </button>
        <span className="text-xs text-slate-500">{helperText}</span>
      </div>
    </section>
  );
}
