import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  ORDER_TRACKING_COLORS,
  ORDER_TRACKING_LABELS,
  ORDER_TRACKING_STATUSES,
  PAYMENT_STATUS_COLORS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUSES,
  SHIPPING_STATUS_COLORS,
  SHIPPING_STATUS_LABELS,
  SHIPPING_STATUSES,
  type Customer,
  type Order,
} from "@/lib/types";
import {
  updateOrderStatusQuick,
  updatePaymentStatusQuick,
  updateShippingStatusQuick,
} from "../actions";
import { AutoSubmitSelect } from "@/components/AutoSubmitSelect";

const RECENCY_OPTIONS = [
  { value: "all", label: "All time" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 3 months" },
];

const MONTH_FORMAT = new Intl.DateTimeFormat("en-AU", {
  month: "long",
  year: "numeric",
});

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ recency?: string }>;
}) {
  const { recency = "all" } = await searchParams;

  const supabase = await createClient();
  let query = supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (recency !== "all") {
    const cutoff = new Date(
      new Date().getTime() - Number(recency) * 24 * 60 * 60 * 1000
    ).toISOString();
    query = query.gte("created_at", cutoff);
  }

  const { data: orders } = await query;
  const orderList = (orders ?? []) as Order[];

  const customerById = new Map<string, Customer>();
  if (orderList.length > 0) {
    const { data: customers } = await supabase
      .from("customers")
      .select("*")
      .in("id", [...new Set(orderList.map((o) => o.customer_id))]);
    for (const c of (customers ?? []) as Customer[]) {
      customerById.set(c.id, c);
    }
  }

  const groups: { label: string; rows: Order[] }[] = [];
  for (const order of orderList) {
    const label = MONTH_FORMAT.format(new Date(order.created_at));
    const group = groups.find((g) => g.label === label);
    if (group) group.rows.push(order);
    else groups.push({ label, rows: [order] });
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Orders</h1>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Every order across all customers, grouped by the month it was placed.
      </p>

      <form className="mt-4 flex flex-wrap gap-2" method="get">
        <select
          name="recency"
          defaultValue={recency}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        >
          {RECENCY_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
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

      <div className="mt-6 space-y-6">
        {groups.length === 0 && (
          <p className="rounded-lg border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
            No orders in this range.
          </p>
        )}
        {groups.map((group) => (
          <div key={group.label}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {group.label}
            </h2>
            <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
              {group.rows.map((order) => {
                const customer = customerById.get(order.customer_id);
                const updateOrderStatusWithIds = updateOrderStatusQuick.bind(
                  null,
                  order.customer_id,
                  order.id
                );
                const updatePaymentStatusWithIds =
                  updatePaymentStatusQuick.bind(
                    null,
                    order.customer_id,
                    order.id
                  );
                const updateShippingStatusWithIds =
                  updateShippingStatusQuick.bind(
                    null,
                    order.customer_id,
                    order.id
                  );
                return (
                  <div
                    key={order.id}
                    className="flex flex-col gap-3 px-4 py-3 hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <Link
                      href={`/customers/${order.customer_id}/orders/${order.id}`}
                      className="min-w-0 sm:flex-1"
                    >
                      <p className="truncate font-medium text-slate-900">
                        {customer?.name ?? "Unknown customer"}
                      </p>
                      <p className="truncate text-sm text-slate-500">
                        {order.label ||
                          `Order — ${new Date(order.created_at).toLocaleDateString()}`}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        Ordered {new Date(order.created_at).toLocaleDateString()}
                      </p>
                    </Link>
                    <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
                      <AutoSubmitSelect
                        name="payment_status"
                        defaultValue={order.payment_status}
                        action={updatePaymentStatusWithIds}
                        className={`rounded-full border-0 px-2 py-0.5 text-xs font-medium ${PAYMENT_STATUS_COLORS[order.payment_status]}`}
                      >
                        {PAYMENT_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {PAYMENT_STATUS_LABELS[s]}
                          </option>
                        ))}
                      </AutoSubmitSelect>
                      <AutoSubmitSelect
                        name="shipping_status"
                        defaultValue={order.shipping_status}
                        action={updateShippingStatusWithIds}
                        className={`rounded-full border-0 px-2 py-0.5 text-xs font-medium ${SHIPPING_STATUS_COLORS[order.shipping_status]}`}
                      >
                        {SHIPPING_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {SHIPPING_STATUS_LABELS[s]}
                          </option>
                        ))}
                      </AutoSubmitSelect>
                      <AutoSubmitSelect
                        name="order_status"
                        defaultValue={order.order_status}
                        action={updateOrderStatusWithIds}
                        className={`rounded-full border-0 px-2 py-0.5 text-xs font-medium ${ORDER_TRACKING_COLORS[order.order_status]}`}
                      >
                        {ORDER_TRACKING_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {ORDER_TRACKING_LABELS[s]}
                          </option>
                        ))}
                      </AutoSubmitSelect>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
