import { createClient } from "@/lib/supabase/server";
import type { ReckonConnection } from "@/lib/types";
import { disconnectReckon, syncReckon, updateReckonBookId } from "./actions";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { FormWithToast } from "@/components/FormWithToast";

const AU_DATETIME_FORMAT = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Brisbane",
  dateStyle: "medium",
  timeStyle: "short",
});

const ERROR_MESSAGES: Record<string, string> = {
  not_configured:
    "The Reckon integration isn't fully set up yet (missing API credentials on the server).",
  invalid_state:
    "That connection attempt looked suspicious or took too long — please try again.",
  token_request_failed: "Couldn't reach Reckon to finish connecting. Try again.",
  token_exchange_failed: "Reckon rejected the connection request. Try again.",
  save_failed: "Connected to Reckon, but saving the connection failed. Try again.",
  not_ready: "Connect Reckon and set a Book ID before syncing.",
  token_failed: "Couldn't refresh the Reckon connection. Try reconnecting.",
  fetch_failed: "Reckon didn't return invoice data. Try again shortly.",
};

export default async function ReckonSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    connected?: string;
    error?: string;
    synced?: string;
    updated?: string;
    linked?: string;
    drafted?: string;
    syncError?: string;
  }>;
}) {
  const { connected, error, synced, updated, linked, drafted, syncError } =
    await searchParams;

  const supabase = await createClient();
  const { data } = await supabase
    .from("reckon_connections")
    .select("*")
    .maybeSingle();
  const connection = data as ReckonConnection | null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">
          Reckon integration
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Connect your Reckon One account so the CRM can pull in customers
          and invoices you create there.
        </p>
      </div>

      {connected && (
        <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
          Connected to Reckon successfully.
        </p>
      )}
      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {ERROR_MESSAGES[error] ?? `Something went wrong (${error}).`}
        </p>
      )}
      {syncError && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {ERROR_MESSAGES[syncError] ?? `Sync failed (${syncError}).`}
        </p>
      )}
      {synced && (
        <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
          Synced with Reckon: {updated ?? 0} order
          {updated === "1" ? "" : "s"} updated, {linked ?? 0} matched to
          existing orders, {drafted ?? 0} new draft
          {drafted === "1" ? "" : "s"} waiting for review.
        </p>
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        {connection ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-900">
                  Reckon is connected
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Connected {AU_DATETIME_FORMAT.format(new Date(connection.created_at))}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Last synced{" "}
                  {connection.last_synced_at
                    ? `${AU_DATETIME_FORMAT.format(new Date(connection.last_synced_at))} (AEST)`
                    : "never"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <form action={syncReckon}>
                  <button
                    type="submit"
                    className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
                  >
                    Sync now
                  </button>
                </form>
                <FormWithToast action={disconnectReckon} successMessage="Disconnected">
                  <ConfirmSubmitButton
                    confirmMessage="Disconnect Reckon? You'll need to reconnect to resume syncing."
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-500 hover:border-red-300 hover:text-red-600"
                  >
                    Disconnect
                  </ConfirmSubmitButton>
                </FormWithToast>
              </div>
            </div>

            <FormWithToast
              action={updateReckonBookId}
              successMessage="Book ID saved"
              className="flex flex-wrap items-end gap-2 border-t border-slate-100 pt-4"
            >
              <div className="min-w-[16rem] flex-1">
                <label className="block text-xs font-medium text-slate-600">
                  Book ID
                </label>
                <p className="mt-0.5 text-xs text-slate-400">
                  From your Reckon One book&rsquo;s URL — app.reckonone.com/
                  <span className="italic">BookId</span>/Core
                </p>
                <input
                  name="book_id"
                  defaultValue={connection.book_id ?? ""}
                  placeholder="e.g. a9eeb038-cd9c-42e4-abe6-fa5b28a397c0"
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                />
              </div>
              <button
                type="submit"
                className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
              >
                Save
              </button>
            </FormWithToast>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-900">
                Not connected
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Connect your Reckon One account to get started.
              </p>
            </div>
            <a
              href="/api/reckon/oauth/connect"
              className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              Connect Reckon
            </a>
          </div>
        )}
      </section>
    </div>
  );
}
