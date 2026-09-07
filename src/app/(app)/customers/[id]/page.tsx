import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  CUSTOMER_STATUSES,
  STATUS_LABELS,
  type Customer,
  type Design,
  type Note,
  type Player,
  type PricingEntry,
} from "@/lib/types";
import {
  addNote,
  addPlayer,
  addPricing,
  deleteCustomer,
  deleteNote,
  deletePlayer,
  importPlayers,
  updateCustomer,
  updatePlayerJerseyNumber,
} from "../../actions";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { DesignsSection } from "@/components/DesignsSection";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: customer },
    { data: notes },
    { data: pricing },
    { data: players },
    { data: designs },
  ] = await Promise.all([
    supabase.from("customers").select("*").eq("id", id).single(),
    supabase
      .from("notes")
      .select("*")
      .eq("customer_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("pricing")
      .select("*")
      .eq("customer_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("players")
      .select("*")
      .eq("customer_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("designs")
      .select("*")
      .eq("customer_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (!customer) notFound();

  const c = customer as Customer;
  const noteList = (notes ?? []) as Note[];
  const pricingList = (pricing ?? []) as PricingEntry[];
  const playerList = (players ?? []) as Player[];
  const designList = (designs ?? []) as Design[];

  const designUrls: Record<string, string> = {};
  if (designList.length > 0) {
    const { data: signedUrls } = await supabase.storage
      .from("designs")
      .createSignedUrls(
        designList.map((d) => d.storage_path),
        3600
      );
    for (const s of signedUrls ?? []) {
      if (s.signedUrl && s.path) designUrls[s.path] = s.signedUrl;
    }
  }

  const updateCustomerWithId = updateCustomer.bind(null, id);
  const addNoteWithId = addNote.bind(null, id);
  const addPricingWithId = addPricing.bind(null, id);
  const importPlayersWithId = importPlayers.bind(null, id);
  const addPlayerWithId = addPlayer.bind(null, id);
  const deleteCustomerWithId = deleteCustomer.bind(null, id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">{c.name}</h1>
        <div className="flex items-center gap-2">
          <Link
            href={`/customers/${id}/order`}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Build supplier order
          </Link>
          <form action={deleteCustomerWithId}>
            <ConfirmSubmitButton
              confirmMessage={`Delete ${c.name}? This removes all their notes, pricing, players, and parcels too. This can't be undone.`}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-500 hover:border-red-300 hover:text-red-600"
            >
              Delete customer
            </ConfirmSubmitButton>
          </form>
        </div>
      </div>

      {/* Profile */}
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Profile</h2>
        <form
          action={updateCustomerWithId}
          className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          <div>
            <label className="block text-xs font-medium text-slate-600">
              Name
            </label>
            <input
              name="name"
              defaultValue={c.name}
              required
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">
              Status
            </label>
            <select
              name="status"
              defaultValue={c.status}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            >
              {CUSTOMER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">
              Channel
            </label>
            <select
              name="contact_channel"
              defaultValue={c.contact_channel}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            >
              <option value="facebook">Facebook</option>
              <option value="email">Email</option>
              <option value="phone">Phone</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">
              Handle / contact
            </label>
            <input
              name="contact_handle"
              defaultValue={c.contact_handle ?? ""}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">
              Phone
            </label>
            <input
              name="phone"
              defaultValue={c.phone ?? ""}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">
              Email
            </label>
            <input
              name="email"
              type="email"
              defaultValue={c.email ?? ""}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600">
              Address
            </label>
            <textarea
              name="address"
              defaultValue={c.address ?? ""}
              rows={2}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600">
              Fabric preference
            </label>
            <textarea
              name="fabric_preference"
              defaultValue={c.fabric_preference ?? ""}
              rows={2}
              placeholder="e.g. prefers mesh/polyester blend, sensitive to tight collars..."
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600">
              Tags (comma separated)
            </label>
            <input
              name="tags"
              defaultValue={c.tags.join(", ")}
              placeholder="e.g. club, bulk-order, VIP"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Save profile
            </button>
          </div>
        </form>
      </section>

      {/* Pricing */}
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">
          Pricing given to this customer
        </h2>
        <form
          action={addPricingWithId}
          className="mt-3 flex flex-wrap items-end gap-2"
        >
          <div>
            <label className="block text-xs font-medium text-slate-600">
              Product
            </label>
            <input
              name="product_name"
              required
              placeholder="e.g. Home jersey (adult)"
              className="mt-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">
              Price
            </label>
            <input
              name="price"
              type="number"
              step="0.01"
              required
              className="mt-1 w-28 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div className="min-w-[10rem] flex-1">
            <label className="block text-xs font-medium text-slate-600">
              Note (optional)
            </label>
            <input
              name="note"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Add price
          </button>
        </form>

        <div className="mt-4 divide-y divide-slate-100">
          {pricingList.length === 0 && (
            <p className="py-3 text-sm text-slate-500">
              No pricing recorded yet.
            </p>
          )}
          {pricingList.map((p) => (
            <div key={p.id} className="flex items-center justify-between py-2 text-sm">
              <div>
                <span className="font-medium text-slate-900">
                  {p.product_name}
                </span>
                {p.note && (
                  <span className="ml-2 text-slate-500">{p.note}</span>
                )}
              </div>
              <div className="text-right">
                <p className="font-medium text-slate-900">
                  {p.currency} {p.price.toFixed(2)}
                </p>
                <p className="text-xs text-slate-400">
                  {new Date(p.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Team order */}
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Team order</h2>
        <p className="mt-1 text-xs text-slate-500">
          Import the filled-in Player Order Form (Excel), or add players
          manually below.
        </p>

        <form
          action={importPlayersWithId}
          className="mt-3 flex flex-wrap items-center gap-2"
        >
          <input
            type="file"
            name="file"
            accept=".xlsx,.xls"
            required
            className="text-sm"
          />
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Import players
          </button>
        </form>

        {playerList.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs text-slate-500">
                  <th className="pb-2 pr-2">Player</th>
                  <th className="pb-2 pr-2">Name on back</th>
                  <th className="pb-2 pr-2">Jersey size</th>
                  <th className="pb-2 pr-2">Shorts size</th>
                  <th className="pb-2 pr-2">Notes</th>
                  <th className="pb-2 pr-2">Jersey #</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {playerList.map((player) => {
                  const updateJerseyNumberWithIds =
                    updatePlayerJerseyNumber.bind(null, id, player.id);
                  const deletePlayerWithIds = deletePlayer.bind(
                    null,
                    id,
                    player.id
                  );
                  return (
                    <tr key={player.id}>
                      <td className="py-1.5 pr-2">{player.player_name}</td>
                      <td className="py-1.5 pr-2">
                        {player.name_on_back ?? "—"}
                      </td>
                      <td className="py-1.5 pr-2">
                        {player.jersey_size ?? "—"}
                      </td>
                      <td className="py-1.5 pr-2">
                        {player.shorts_size ?? "—"}
                      </td>
                      <td className="py-1.5 pr-2 max-w-[12rem] truncate" title={player.notes ?? undefined}>
                        {player.notes ?? "—"}
                      </td>
                      <td className="py-1.5 pr-2">
                        <form
                          action={updateJerseyNumberWithIds}
                          className="flex items-center gap-1"
                        >
                          <input
                            name="jersey_number"
                            defaultValue={player.jersey_number ?? ""}
                            placeholder="#"
                            className="w-14 rounded-md border border-slate-300 px-2 py-1 text-sm"
                          />
                          <button
                            type="submit"
                            className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                          >
                            Save
                          </button>
                        </form>
                      </td>
                      <td className="py-1.5 text-right">
                        <form action={deletePlayerWithIds}>
                          <button
                            type="submit"
                            className="text-xs text-slate-400 hover:text-red-600"
                          >
                            Delete
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <details className="mt-4">
          <summary className="cursor-pointer text-xs font-medium text-slate-600">
            Add a player manually
          </summary>
          <form
            action={addPlayerWithId}
            className="mt-2 flex flex-wrap items-end gap-2"
          >
            <div>
              <label className="block text-xs font-medium text-slate-600">
                Player name
              </label>
              <input
                name="player_name"
                required
                className="mt-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600">
                Name on back
              </label>
              <input
                name="name_on_back"
                className="mt-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600">
                Jersey size
              </label>
              <input
                name="jersey_size"
                placeholder="e.g. Kids 12 or L"
                className="mt-1 w-28 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600">
                Shorts size
              </label>
              <input
                name="shorts_size"
                className="mt-1 w-28 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600">
                Jersey #
              </label>
              <input
                name="jersey_number"
                className="mt-1 w-16 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              />
            </div>
            <button
              type="submit"
              className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              Add player
            </button>
          </form>
        </details>
      </section>

      <DesignsSection customerId={id} designs={designList} urls={designUrls} />

      {/* Notes */}
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">
          Conversation notes
        </h2>
        <form action={addNoteWithId} className="mt-3 space-y-2">
          <textarea
            name="body"
            required
            rows={3}
            placeholder="Paste or type what was discussed (sizes, quantities, deadline...)"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <div className="flex flex-wrap items-center gap-3">
            <select
              name="source"
              defaultValue="facebook"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            >
              <option value="facebook">Facebook</option>
              <option value="email">Email</option>
              <option value="call">Call</option>
              <option value="other">Other</option>
            </select>
            <label className="flex items-center gap-1.5 text-sm text-slate-700">
              <input type="checkbox" name="is_order_relevant" />
              Order-relevant (include in supplier order)
            </label>
            <button
              type="submit"
              className="ml-auto rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              Add note
            </button>
          </div>
        </form>

        <div className="mt-4 space-y-3">
          {noteList.length === 0 && (
            <p className="text-sm text-slate-500">No notes yet.</p>
          )}
          {noteList.map((note) => {
            const deleteNoteWithIds = deleteNote.bind(null, id, note.id);
            return (
              <div
                key={note.id}
                className="rounded-md border border-slate-100 bg-slate-50 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="whitespace-pre-wrap text-sm text-slate-800">
                    {note.body}
                  </p>
                  <form action={deleteNoteWithIds}>
                    <button
                      type="submit"
                      className="shrink-0 text-xs text-slate-400 hover:text-red-600"
                    >
                      Delete
                    </button>
                  </form>
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  {note.source}
                  {note.is_order_relevant ? " · order-relevant" : ""} ·{" "}
                  {new Date(note.created_at).toLocaleString()}
                </p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
