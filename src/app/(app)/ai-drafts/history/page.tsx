import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { AiDraft, AiDraftStatus } from "@/lib/types";
import { draftDisplayName } from "../helpers";

const FILTER_OPTIONS: { value: AiDraftStatus | "all"; label: string }[] = [
  { value: "all", label: "All reviewed" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

export default async function AiDraftsHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status = "all" } = await searchParams;

  const supabase = await createClient();
  let query = supabase
    .from("ai_drafts")
    .select("*")
    .order("reviewed_at", { ascending: false });

  query =
    status === "approved" || status === "rejected"
      ? query.eq("status", status)
      : query.in("status", ["approved", "rejected"]);

  const { data } = await query;
  const draftList = (data ?? []) as AiDraft[];

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/ai-drafts"
          className="text-xs text-slate-500 hover:underline"
        >
          ← AI drafts
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-slate-900">
          Draft history
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Every AI draft you&rsquo;ve approved or rejected.
        </p>
      </div>

      <form className="flex flex-wrap gap-2" method="get">
        <select
          name="status"
          defaultValue={status}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        >
          {FILTER_OPTIONS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-white"
        >
          Filter
        </button>
      </form>

      <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {draftList.length === 0 && (
          <p className="p-6 text-center text-sm text-slate-500">
            No reviewed drafts in this range.
          </p>
        )}
        {draftList.map((draft) => {
          const isUpdate = draft.payload.kind === "update_existing";
          const content = (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-slate-900">
                  {draftDisplayName(draft)}
                </p>
                <p className="truncate text-sm text-slate-500">
                  &ldquo;{draft.raw_prompt}&rdquo;
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {isUpdate ? "Update" : "New customer"} ·{" "}
                  {draft.reviewed_at
                    ? new Date(draft.reviewed_at).toLocaleString()
                    : ""}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  draft.status === "approved"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {draft.status}
              </span>
            </>
          );

          return draft.created_customer_id ? (
            <Link
              key={draft.id}
              href={`/customers/${draft.created_customer_id}`}
              className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50"
            >
              {content}
            </Link>
          ) : (
            <div
              key={draft.id}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}
