"use client";

import { useTransition } from "react";
import {
  backfillFacebookAds,
  syncFacebookAdsRecent,
} from "@/app/(app)/costs/actions";
import { useToast } from "./ToastProvider";

/** Pulls real ad spend straight from Facebook instead of typing it in by hand.
 * "Sync latest" refreshes the last two weeks (Meta's numbers can still move for
 * a few days); "Backfill full history" is a one-off pull of everything Meta
 * still has on file. Either way, any day you've already entered manually is
 * left untouched -- see runFacebookAdsSync. */
export function FacebookAdsSyncButtons() {
  const [isPending, startTransition] = useTransition();
  const showToast = useToast();

  function run(action: () => Promise<{ ok: boolean; error?: string; message?: string }>) {
    if (isPending) return;
    startTransition(async () => {
      try {
        const result = await action();
        if (!result.ok) {
          showToast(result.error ?? "Something went wrong -- try again", "error");
          return;
        }
        showToast(result.message ?? "Synced");
      } catch {
        showToast("Something went wrong -- try again", "error");
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={() => run(syncFacebookAdsRecent)}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
      >
        {isPending ? "Syncing…" : "Sync latest from Facebook"}
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={() => run(backfillFacebookAds)}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
      >
        {isPending ? "Syncing…" : "Backfill full history"}
      </button>
    </div>
  );
}
