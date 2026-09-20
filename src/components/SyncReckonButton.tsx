"use client";

import { useTransition } from "react";
import { syncReckonInPlace } from "@/app/(app)/settings/reckon/actions";
import { isFrameworkNavigationError, useToast } from "./ToastProvider";

const ERROR_MESSAGES: Record<string, string> = {
  not_ready: "Connect Reckon and set a Book ID first",
  token_failed: "Couldn't refresh the Reckon connection -- try reconnecting",
  fetch_failed: "Reckon didn't return invoice data -- try again shortly",
};

/** Runs the Reckon sync without leaving the page. Disabled while running, so a
 * double-click can't start two syncs at once (which could draft the same invoice twice). */
export function SyncReckonButton() {
  const [isPending, startTransition] = useTransition();
  const showToast = useToast();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          try {
            const result = await syncReckonInPlace();
            if (!result.ok) {
              showToast(
                ERROR_MESSAGES[result.error ?? ""] ?? "Reckon sync failed -- try again",
                "error"
              );
              return;
            }
            showToast(
              result.drafted > 0
                ? `Synced with Reckon -- ${result.drafted} new draft${result.drafted === 1 ? "" : "s"} to review`
                : "Synced with Reckon"
            );
          } catch (err) {
            if (isFrameworkNavigationError(err)) throw err;
            showToast("Reckon sync failed -- try again", "error");
          }
        })
      }
      className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-white disabled:cursor-wait disabled:opacity-60"
    >
      {isPending ? "Syncing…" : "Sync now"}
    </button>
  );
}
