import type { SupabaseClient } from "@supabase/supabase-js";
import { cents } from "./costs";

/** Tags rows this sync created/owns, so it never touches a manually-entered
 * charge and can safely refresh its own rows (Meta's daily spend figure can
 * still move for a few days as attribution settles). */
const SYNC_REFERENCE = "facebook-api-sync";
const GRAPH_API_VERSION = "v21.0";

interface DailySpend {
  date: string;
  spend: number;
}

interface GraphPaging {
  next?: string;
}
interface GraphInsightsRow {
  date_start?: string;
  spend?: string;
}
interface GraphInsightsResponse {
  data?: GraphInsightsRow[];
  paging?: GraphPaging;
}

async function fetchDailySpend(since: string, until: string): Promise<DailySpend[]> {
  const accountId = process.env.META_ADS_ACCOUNT_ID;
  const accessToken = process.env.META_ADS_ACCESS_TOKEN;
  if (!accountId || !accessToken) {
    throw new Error("not_configured");
  }

  const results: DailySpend[] = [];
  let url: string | null =
    `https://graph.facebook.com/${GRAPH_API_VERSION}/act_${accountId}/insights` +
    `?fields=spend&level=account&time_increment=1` +
    `&time_range=${encodeURIComponent(JSON.stringify({ since, until }))}` +
    `&limit=100&access_token=${accessToken}`;

  while (url) {
    let res: Response;
    try {
      res = await fetch(url);
    } catch {
      throw new Error("fetch_failed");
    }
    if (!res.ok) throw new Error("fetch_failed");

    const json = (await res.json()) as GraphInsightsResponse;
    for (const row of json.data ?? []) {
      if (row.date_start && row.spend != null) {
        results.push({ date: row.date_start, spend: Number(row.spend) });
      }
    }
    url = json.paging?.next ?? null;
  }
  return results;
}

export type FacebookAdsSyncResult =
  | { ok: true; synced: number; skippedManual: number }
  | { ok: false; error: string };

/** Pulls daily ad spend for [since, until] (both inclusive, YYYY-MM-DD) from the
 * Marketing API and records each day as an "ads" expense. A day that already has
 * a manually-entered charge (added via the quick-add box) is left alone -- only
 * rows this sync created itself get inserted or refreshed. */
export async function runFacebookAdsSync(
  supabase: SupabaseClient,
  ownerId: string,
  args: { since: string; until: string }
): Promise<FacebookAdsSyncResult> {
  let days: DailySpend[];
  try {
    days = await fetchDailySpend(args.since, args.until);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "fetch_failed" };
  }

  const { data: existing, error: fetchError } = await supabase
    .from("expenses")
    .select("id, expense_date, reference")
    .eq("kind", "ads")
    .gte("expense_date", args.since)
    .lte("expense_date", args.until);
  if (fetchError) return { ok: false, error: "fetch_failed" };

  const existingByDate = new Map(
    ((existing ?? []) as { id: string; expense_date: string; reference: string | null }[]).map(
      (e) => [e.expense_date, e]
    )
  );

  let synced = 0;
  let skippedManual = 0;

  for (const day of days) {
    if (!(day.spend > 0)) continue;
    const amount = cents(day.spend);
    const match = existingByDate.get(day.date);

    if (match && match.reference !== SYNC_REFERENCE) {
      skippedManual++;
      continue;
    }

    if (match) {
      await supabase
        .from("expenses")
        .update({ amount, updated_at: new Date().toISOString() })
        .eq("id", match.id);
    } else {
      await supabase.from("expenses").insert({
        owner_id: ownerId,
        kind: "ads",
        expense_date: day.date,
        amount,
        payee: "Facebook ads",
        reference: SYNC_REFERENCE,
        paid_date: day.date,
      });
    }
    synced++;
  }

  return { ok: true, synced, skippedManual };
}
