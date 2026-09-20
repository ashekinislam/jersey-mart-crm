import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { ReckonConnection } from "@/lib/types";
import { SyncReckonButton } from "./SyncReckonButton";

const AU_DATETIME_FORMAT = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Brisbane",
  dateStyle: "medium",
  timeStyle: "short",
});

/** One-line note above the order lists saying where the $ figures come from and
 * how fresh they are, with a button to pull the latest from Reckon. */
export async function ReckonSyncStatus() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reckon_connections")
    .select("book_id, last_synced_at")
    .maybeSingle();
  const connection = data as Pick<
    ReckonConnection,
    "book_id" | "last_synced_at"
  > | null;

  if (!connection?.book_id) {
    return (
      <p className="text-xs text-slate-500">
        Reckon isn&rsquo;t connected, so amounts shown are the sale amounts
        entered in the CRM.{" "}
        <Link href="/settings/reckon" className="underline hover:text-slate-700">
          Connect Reckon
        </Link>
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
      <span>
        Amounts come from your Reckon invoices. Last synced{" "}
        {connection.last_synced_at
          ? `${AU_DATETIME_FORMAT.format(new Date(connection.last_synced_at))} (AEST)`
          : "never"}
        .
      </span>
      <SyncReckonButton />
    </div>
  );
}
