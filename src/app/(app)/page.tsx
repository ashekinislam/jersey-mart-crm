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
} from "./actions";
import { AutoSubmitSelect } from "@/components/AutoSubmitSelect";
import { BreakdownCard, StatTile } from "@/components/StatBreakdown";

const CHANNEL_LABELS: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  email: "Email",
  phone: "Phone",
  other: "Other",
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const [{ data: customers }, { data: orders }] = await Promise.all([
    supabase.from("customers").select("id, state, contact_channel"),
    supabase
      .from("orders")
      .select("*")
      .order("order_date", { ascending: false }),
  ]);

  const customerList = (customers ?? []) as Pick<
    Customer,
    "id" | "state" | "contact_channel"
  >[];
  const orderList = (orders ?? []) as Order[];

  const ongoingOrders = orderList.filter(
    (o) => o.order_status !== "delivered" && o.order_status !== "cancelled"
  );

  const unpaidOrders = orderList.filter(
    (o) => o.payment_status !== "paid"
  ).length;

  const today = new Date().toISOString().slice(0, 10);
  const overdue = orderList.filter(
    (o) =>
      o.payment_status !== "paid" &&
      o.payment_due_date !== null &&
      o.payment_due_date < today
  ).length;

  const customerById = new Map<string, Customer>();
  if (ongoingOrders.length > 0) {
    const { data: relevantCustomers } = await supabase
      .from("customers")
      .select("*")
      .in("id", [...new Set(ongoingOrders.map((o) => o.customer_id))]);
    for (const c of (relevantCustomers ?? []) as Customer[]) {
      customerById.set(c.id, c);
    }
  }

  const stateMap = new Map<string, number>();
  for (const c of customerList) {
    const key = c.state?.trim() || "Not set";
    stateMap.set(key, (stateMap.get(key) ?? 0) + 1);
  }
  const stateItems = [...stateMap.entries()].map(([label, count]) => ({
    label,
    count,
  }));

  const channelMap = new Map<string, number>();
  for (const c of customerList) {
    const key = c.contact_channel;
    channelMap.set(key, (channelMap.get(key) ?? 0) + 1);
  }
  const channelItems = [...channelMap.entries()].map(([channel, count]) => ({
    label: CHANNEL_LABELS[channel] ?? channel,
    count,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Dashboard</h1>
        <Link
          href="/customers"
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          View customers
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Customers" value={customerList.length} />
        <StatTile label="Open orders" value={ongoingOrders.length} />
        <StatTile label="Unpaid orders" value={unpaidOrders} accent="amber" />
        <StatTile label="Overdue payments" value={overdue} accent="red" />
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">
            Ongoing orders
          </h2>
          <Link
            href="/orders"
            className="text-xs text-slate-500 hover:underline"
          >
            View all orders →
          </Link>
        </div>

        {ongoingOrders.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            No open orders right now.
          </p>
        ) : (
          <div className="mt-3 divide-y divide-slate-200">
            {ongoingOrders.map((order) => {
              const customer = customerById.get(order.customer_id);
              const updateOrderStatusWithIds = updateOrderStatusQuick.bind(
                null,
                order.customer_id,
                order.id
              );
              const updatePaymentStatusWithIds = updatePaymentStatusQuick.bind(
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
                  className="flex flex-col gap-3 py-3 hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
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
                        `Order — ${new Date(order.order_date).toLocaleDateString()}`}
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
        )}
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <BreakdownCard title="Customers by state" items={stateItems} />
        <BreakdownCard title="Customers by channel" items={channelItems} />
      </div>
    </div>
  );
}
