import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  ORDER_TRACKING_STATUSES,
  ORDER_TRACKING_LABELS,
  PAYMENT_STATUSES,
  PAYMENT_STATUS_LABELS,
  SHIPPING_STATUSES,
  SHIPPING_STATUS_LABELS,
  type Customer,
  type Order,
} from "@/lib/types";
import { BreakdownCard, StatTile } from "@/components/StatBreakdown";

const CHANNEL_LABELS: Record<string, string> = {
  facebook: "Facebook",
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
      .select("id, order_status, payment_status, shipping_status, payment_due_date"),
  ]);

  const customerList = (customers ?? []) as Pick<
    Customer,
    "id" | "state" | "contact_channel"
  >[];
  const orderList = (orders ?? []) as Pick<
    Order,
    "id" | "order_status" | "payment_status" | "shipping_status" | "payment_due_date"
  >[];

  const openOrders = orderList.filter(
    (o) => o.order_status !== "delivered" && o.order_status !== "cancelled"
  ).length;

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

  const orderStatusItems = ORDER_TRACKING_STATUSES.map((s) => ({
    label: ORDER_TRACKING_LABELS[s],
    count: orderList.filter((o) => o.order_status === s).length,
  }));

  const paymentStatusItems = PAYMENT_STATUSES.map((s) => ({
    label: PAYMENT_STATUS_LABELS[s],
    count: orderList.filter((o) => o.payment_status === s).length,
  }));

  const shippingStatusItems = SHIPPING_STATUSES.map((s) => ({
    label: SHIPPING_STATUS_LABELS[s],
    count: orderList.filter((o) => o.shipping_status === s).length,
  }));

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
        <StatTile label="Open orders" value={openOrders} />
        <StatTile label="Unpaid orders" value={unpaidOrders} accent="amber" />
        <StatTile label="Overdue payments" value={overdue} accent="red" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <BreakdownCard title="Orders by status" items={orderStatusItems} />
        <BreakdownCard title="Payment status" items={paymentStatusItems} />
        <BreakdownCard title="Shipping status" items={shippingStatusItems} />
        <BreakdownCard title="Customers by state" items={stateItems} />
        <BreakdownCard title="Customers by channel" items={channelItems} />
      </div>
    </div>
  );
}
