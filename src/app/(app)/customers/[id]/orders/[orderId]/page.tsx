import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  ORDER_TRACKING_STATUSES,
  ORDER_TRACKING_LABELS,
  PAYMENT_STATUSES,
  PAYMENT_STATUS_LABELS,
  PICKUP_ADDRESS,
  SHIPPING_STATUSES,
  SHIPPING_STATUS_LABELS,
  type Customer,
  type Design,
  type Order,
  type Player,
  type Team,
} from "@/lib/types";
import {
  addTeam,
  deleteInvoice,
  deleteOrder,
  updateOrderTracking,
  uploadInvoice,
} from "../../../../actions";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { FILE_INPUT_CLASS } from "@/lib/ui";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string; orderId: string }>;
}) {
  const { id, orderId } = await params;
  const supabase = await createClient();

  const [{ data: customer }, { data: order }, { data: teams }] =
    await Promise.all([
      supabase.from("customers").select("*").eq("id", id).single(),
      supabase.from("orders").select("*").eq("id", orderId).single(),
      supabase
        .from("teams")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true }),
    ]);

  if (!customer || !order) notFound();

  const c = customer as Customer;
  const o = order as Order;
  const teamList = (teams ?? []) as Team[];

  const teamIds = teamList.map((t) => t.id);
  const playerCounts: Record<string, number> = {};
  const designSummaries: Record<string, { approved: number; total: number }> = {};

  if (teamIds.length > 0) {
    const [{ data: players }, { data: designs }] = await Promise.all([
      supabase.from("players").select("id, team_id").in("team_id", teamIds),
      supabase
        .from("designs")
        .select("id, team_id, status")
        .in("team_id", teamIds),
    ]);

    for (const p of (players ?? []) as Pick<Player, "id" | "team_id">[]) {
      playerCounts[p.team_id] = (playerCounts[p.team_id] ?? 0) + 1;
    }
    for (const d of (designs ?? []) as Pick<Design, "id" | "team_id" | "status">[]) {
      const entry = designSummaries[d.team_id] ?? { approved: 0, total: 0 };
      entry.total += 1;
      if (d.status === "approved") entry.approved += 1;
      designSummaries[d.team_id] = entry;
    }
  }

  let invoiceUrl: string | null = null;
  if (o.invoice_storage_path) {
    const { data: signed } = await supabase.storage
      .from("invoices")
      .createSignedUrl(o.invoice_storage_path, 3600);
    invoiceUrl = signed?.signedUrl ?? null;
  }

  const updateOrderTrackingWithIds = updateOrderTracking.bind(null, id, orderId);
  const uploadInvoiceWithIds = uploadInvoice.bind(null, id, orderId);
  const deleteInvoiceWithIds = deleteInvoice.bind(null, id, orderId);
  const deleteOrderWithIds = deleteOrder.bind(null, id, orderId);
  const addTeamWithIds = addTeam.bind(null, id, orderId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`/customers/${id}`}
            className="text-xs text-slate-500 hover:underline"
          >
            ← {c.name}
          </Link>
          <h1 className="text-lg font-semibold text-slate-900">
            {o.label || `Order — ${new Date(o.created_at).toLocaleDateString()}`}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/customers/${id}/orders/${orderId}/build`}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Build supplier order
          </Link>
          <form action={deleteOrderWithIds}>
            <ConfirmSubmitButton
              confirmMessage="Delete this order? This removes all its teams, players, designs, and history. This can't be undone."
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-500 hover:border-red-300 hover:text-red-600"
            >
              Delete order
            </ConfirmSubmitButton>
          </form>
        </div>
      </div>

      {/* Order tracking */}
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">
            Order tracking
          </h2>
          <button
            type="submit"
            form="order-tracking-form"
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Save
          </button>
        </div>

        <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2">
          <label className="block text-xs font-semibold uppercase tracking-wide text-red-700">
            Deadline
          </label>
          <input
            form="order-tracking-form"
            type="date"
            name="deadline"
            defaultValue={o.deadline ?? ""}
            className="mt-1 rounded-md border border-red-300 bg-white px-2 py-1 text-lg font-bold text-red-700"
          />
        </div>

        <form
          id="order-tracking-form"
          action={updateOrderTrackingWithIds}
          className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600">
              Order label
            </label>
            <input
              name="label"
              defaultValue={o.label ?? ""}
              placeholder="e.g. Spring 2026 kit run"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">
              Order status
            </label>
            <select
              name="order_status"
              defaultValue={o.order_status}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            >
              {ORDER_TRACKING_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {ORDER_TRACKING_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">
              Payment status
            </label>
            <select
              name="payment_status"
              defaultValue={o.payment_status}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            >
              {PAYMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {PAYMENT_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">
              Payment due date
            </label>
            <input
              type="date"
              name="payment_due_date"
              defaultValue={o.payment_due_date ?? ""}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">
              Shipping status
            </label>
            <select
              name="shipping_status"
              defaultValue={o.shipping_status}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            >
              {SHIPPING_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {SHIPPING_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">
              Tracking URL
            </label>
            <input
              name="tracking_url"
              type="url"
              defaultValue={o.tracking_url ?? ""}
              placeholder="e.g. https://bdex.com.bd/track/..."
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">
              Tracking number
            </label>
            <input
              name="tracking_number"
              defaultValue={o.tracking_number ?? ""}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <p className="sm:col-span-2 text-xs text-slate-500">
            Pickup address (when the customer collects instead of shipping):{" "}
            {PICKUP_ADDRESS}
          </p>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              Save
            </button>
          </div>
        </form>

        <div className="mt-4 border-t border-slate-100 pt-4">
          <label className="block text-xs font-medium text-slate-600">
            Invoice (Reckon PDF)
          </label>
          <form
            action={uploadInvoiceWithIds}
            className="mt-1 flex flex-wrap items-center gap-2"
          >
            <input
              type="file"
              name="file"
              accept=".pdf,image/*"
              required
              className={FILE_INPUT_CLASS}
            />
            <button
              type="submit"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Upload
            </button>
          </form>
          {invoiceUrl && (
            <div className="mt-2 flex items-center gap-3 text-sm">
              <a
                href={invoiceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-slate-900 underline"
              >
                View current invoice
              </a>
              <form action={deleteInvoiceWithIds}>
                <button
                  type="submit"
                  className="text-xs text-slate-400 hover:text-red-600"
                >
                  Delete
                </button>
              </form>
            </div>
          )}
        </div>
      </section>

      {/* Teams */}
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Teams</h2>
        <p className="mt-1 text-xs text-slate-500">
          Up to 9-10 teams can go in one order — each gets its own roster and
          design approval tracking.
        </p>

        <form
          action={addTeamWithIds}
          className="mt-3 flex flex-wrap items-end gap-2"
        >
          <div className="min-w-[10rem] flex-1">
            <label className="block text-xs font-medium text-slate-600">
              Team name
            </label>
            <input
              name="team_name"
              required
              placeholder="e.g. U12 Green"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            + Add team
          </button>
        </form>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {teamList.length === 0 && (
            <p className="text-sm text-slate-500 sm:col-span-2 lg:col-span-3">
              No teams yet.
            </p>
          )}
          {teamList.map((team) => {
            const designSummary = designSummaries[team.id];
            return (
              <Link
                key={team.id}
                href={`/customers/${id}/orders/${orderId}/teams/${team.id}`}
                className="rounded-md border border-slate-100 bg-slate-50 p-3 hover:bg-slate-100"
              >
                <p className="font-medium text-slate-900">{team.team_name}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {playerCounts[team.id] ?? 0} player
                  {(playerCounts[team.id] ?? 0) === 1 ? "" : "s"}
                  {designSummary
                    ? ` · designs: ${designSummary.approved}/${designSummary.total} approved`
                    : " · no designs yet"}
                </p>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
