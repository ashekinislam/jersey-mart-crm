"use client";

import { useMemo, useState, useTransition } from "react";
import { generateBrandPhotos } from "@/app/(app)/videos/actions";
import { PhotoCheckbox, type DesignOption } from "@/components/PhotoCheckbox";
import { useToast } from "@/components/ToastProvider";

/** Generates new brand photos from real reference photos (Design photos
 * and/or existing brand assets) via OpenAI, so there's a steady supply of
 * fresh-looking product photos without needing a new photoshoot each time. */
export function AIPhotoGeneratorForm({
  designOptions,
  brandPhotoOptions,
}: {
  designOptions: DesignOption[];
  brandPhotoOptions: DesignOption[];
}) {
  const [designIds, setDesignIds] = useState<string[]>([]);
  const [brandPhotoIds, setBrandPhotoIds] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  const [count, setCount] = useState(2);
  const [isPending, startTransition] = useTransition();
  const showToast = useToast();

  const selectedCount = designIds.length + brandPhotoIds.length;
  const canSubmit = selectedCount > 0 && selectedCount <= 4 && prompt.trim().length > 0 && !isPending;

  function toggle(list: string[], setList: (v: string[]) => void, id: string) {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  const helperText = useMemo(() => {
    if (selectedCount === 0) return "Pick 1-4 reference photos of your real jerseys.";
    if (selectedCount > 4) return "Pick 4 reference photos or fewer.";
    return `${selectedCount} reference photo${selectedCount === 1 ? "" : "s"} selected.`;
  }, [selectedCount]);

  function submit() {
    if (!canSubmit) return;
    startTransition(async () => {
      const result = await generateBrandPhotos({
        referenceDesignIds: designIds,
        referenceBrandAssetIds: brandPhotoIds,
        prompt: prompt.trim(),
        count,
      });
      showToast(result.ok ? (result.message ?? "Generated") : result.error, result.ok ? "success" : "error");
      if (result.ok) {
        setDesignIds([]);
        setBrandPhotoIds([]);
        setPrompt("");
      }
    });
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">Generate AI product photos</h2>
      <p className="mt-1 text-xs text-slate-500">
        Pick a few real photos of jerseys you&apos;ve made, describe a new scene, and get fresh product photos back --
        a steady supply of content without needing a new photoshoot every time.
      </p>

      {designOptions.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs font-semibold text-slate-700">Reference: jerseys we&apos;ve produced</h3>
          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6">
            {designOptions.map((o) => (
              <PhotoCheckbox key={o.id} option={o} checked={designIds.includes(o.id)} onToggle={() => toggle(designIds, setDesignIds, o.id)} />
            ))}
          </div>
        </div>
      )}

      {brandPhotoOptions.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs font-semibold text-slate-700">Reference: brand photos</h3>
          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6">
            {brandPhotoOptions.map((o) => (
              <PhotoCheckbox key={o.id} option={o} checked={brandPhotoIds.includes(o.id)} onToggle={() => toggle(brandPhotoIds, setBrandPhotoIds, o.id)} />
            ))}
          </div>
        </div>
      )}

      <div className="mt-4">
        <label className="text-xs font-semibold text-slate-700">Describe the new photo</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. this jersey being worn by a player on an outdoor field, natural daylight, action shot"
          rows={2}
          className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        />
      </div>

      <div className="mt-3 flex items-center gap-3">
        <label className="text-sm text-slate-700">How many:</label>
        <select value={count} onChange={(e) => setCount(Number(e.target.value))} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
          {[1, 2, 3, 4].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={submit}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {isPending ? "Generating…" : "Generate photos"}
        </button>
        <span className="text-xs text-slate-500">{helperText}</span>
      </div>
    </section>
  );
}
