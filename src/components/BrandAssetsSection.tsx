"use client";

import { useTransition } from "react";
import type { VideoBrandAsset } from "@/lib/types";
import { deleteBrandAsset, uploadBrandAsset } from "@/app/(app)/videos/actions";
import { FILE_INPUT_CLASS } from "@/lib/ui";
import { FormWithToast } from "@/components/FormWithToast";
import { useToast } from "@/components/ToastProvider";

function DeleteAssetButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  const showToast = useToast();
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (!window.confirm("Delete this brand asset?")) return;
        startTransition(async () => {
          const result = await deleteBrandAsset(id);
          showToast(result.ok ? "Deleted" : result.error, result.ok ? "success" : "error");
        });
      }}
      className="absolute right-1 top-1 rounded-full bg-black/60 px-1.5 text-xs text-white hover:bg-red-600 disabled:opacity-50"
    >
      ×
    </button>
  );
}

/** General brand photos/logo -- not tied to a specific order -- that the
 * video generator can mix in alongside a customer's own Design photos. */
export function BrandAssetsSection({ assets, urls }: { assets: VideoBrandAsset[]; urls: Record<string, string> }) {
  const photos = assets.filter((a) => a.kind === "photo");
  const logos = assets.filter((a) => a.kind === "logo");

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">Brand assets</h2>
      <p className="mt-1 text-xs text-slate-500">
        General photos and your logo, for videos that aren&apos;t about one specific order.
      </p>

      <FormWithToast action={uploadBrandAsset} successMessage="Uploaded" className="mt-3 flex flex-wrap items-end gap-2">
        <select name="kind" defaultValue="photo" className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
          <option value="photo">Photo</option>
          <option value="logo">Logo</option>
        </select>
        <input type="file" name="file" accept="image/*" required className={FILE_INPUT_CLASS} />
        <input
          name="caption"
          placeholder="Caption (optional)"
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        />
        <button type="submit" className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800">
          Upload
        </button>
      </FormWithToast>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
        {[...logos, ...photos].map((a) => {
          const url = urls[a.storage_path];
          return (
            <div key={a.id} className="relative">
              {url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt={a.caption ?? a.kind} className="aspect-square w-full rounded-md border border-slate-200 object-cover" />
              ) : (
                <div className="flex aspect-square items-center justify-center rounded-md bg-slate-100 text-xs text-slate-400">
                  No preview
                </div>
              )}
              <DeleteAssetButton id={a.id} />
              <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[10px] text-white">
                {a.kind === "logo" ? "Logo" : a.generation_prompt ? "AI photo" : "Photo"}
              </span>
            </div>
          );
        })}
        {assets.length === 0 && <p className="col-span-full text-xs text-slate-500">No brand assets uploaded yet.</p>}
      </div>
    </section>
  );
}
