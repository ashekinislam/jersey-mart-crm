import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  ORDER_TRACKING_COLORS,
  ORDER_TRACKING_LABELS,
  PAYMENT_STATUS_COLORS,
  PAYMENT_STATUS_LABELS,
  type Order,
} from "@/lib/types";
import { addOrder, deleteOrder } from "@/app/(app)/actions";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { OrderTrackingCard } from "@/components/OrderTrackingCard";
import { OrderTeamsSection } from "@/components/OrderTeamsSection";

/**
 * Most customers only ever have one order, so when that's the case its
 * tracking + teams are shown inline right here — no click required. With
 * zero or multiple orders, a list/create form is shown instead.
 */
export async function CustomerOrdersSection({
  customerId,
}: {
  customerId: string;
}) {
  const supabase = await createClient();
  const { data: orders } = await supabase
    .from("orders")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  const orderList = (orders ?? []) as Order[];
  const addOrderWithId = addOrder.bind(null, customerId);

  if (orderList.length === 1) {
    const order = orderList[0];
    let invoiceUrl: string | null = null;
    if (order.invoice_storage_path) {
      const { data: signed } = await supabase.storage
        .from("invoices")
        .createSignedUrl(order.invoice_storage_path, 3600);
      invoiceUrl = signed?.signedUrl ?? null;
    }
    const deleteOrderWithIds = deleteOrder.bind(null, customerId, order.id);

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-sm font-semibold text-slate-900">
            Order: {order.label || new Date(order.created_at).toLocaleDateString()}
          </h2>
          <div className="flex items-center gap-2">
            <Link
              href={`/customers/${customerId}/orders/${order.id}/build`}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              Build supplier order
            </Link>
            <form action={addOrderWithId}>
              <button
                type="submit"
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                + New order
              </button>
            </form>
            <form action={deleteOrderWithIds}>
              <ConfirmSubmitButton
                confirmMessage="Delete this order? This removes all its teams, players, designs, and history. This can't be undone."
                className="text-xs text-slate-400 hover:text-red-600"
              >
                Delete order
              </ConfirmSubmitButton>
            </form>
          </div>
        </div>
        <OrderTrackingCard
          customerId={customerId}
          orderId={order.id}
          order={order}
          invoiceUrl={invoiceUrl}
        />
        <OrderTeamsSection customerId={customerId} orderId={order.id} />
      </div>
    );
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">Orders</h2>
      <form
        action={addOrderWithId}
        className="mt-3 flex flex-wrap items-end gap-2"
      >
        <div className="min-w-[12rem] flex-1">
          <label className="block text-xs font-medium text-slate-600">
            New order label (optional)
          </label>
          <input
            name="label"
            placeholder="e.g. Spring 2026 kit run"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          + New order
        </button>
      </form>

      <div className="mt-4 divide-y divide-slate-100">
        {orderList.length === 0 && (
          <p className="py-3 text-sm text-slate-500">No orders yet.</p>
        )}
        {orderList.map((order) => (
          <Link
            key={order.id}
            href={`/customers/${customerId}/orders/${order.id}`}
            className="flex items-center justify-between gap-3 py-3 hover:bg-slate-50"
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-900">
                {order.label ||
                  `Order — ${new Date(order.created_at).toLocaleDateString()}`}
              </p>
              {order.deadline && (
                <p className="text-xs text-red-600">
                  Deadline: {new Date(order.deadline).toLocaleDateString()}
                </p>
              )}
            </div>
            <div className="flex shrink-0 gap-1.5">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${ORDER_TRACKING_COLORS[order.order_status]}`}
              >
                {ORDER_TRACKING_LABELS[order.order_status]}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${PAYMENT_STATUS_COLORS[order.payment_status]}`}
              >
                {PAYMENT_STATUS_LABELS[order.payment_status]}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
