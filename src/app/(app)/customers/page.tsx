import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  CUSTOMER_STATUSES,
  FOLLOW_UP_STATUS_LABELS,
  ORDER_TRACKING_COLORS,
  ORDER_TRACKING_LABELS,
  ORDER_TRACKING_STATUSES,
  STATUS_COLORS,
  STATUS_LABELS,
  type Customer,
  type CustomerStatus,
  type FollowUp,
  type Order,
} from "@/lib/types";
import { deleteCustomer, updateOrderStatusQuick } from "../actions";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { AutoSubmitSelect } from "@/components/AutoSubmitSelect";

const STATUS_DOT_COLORS: Record<CustomerStatus, string> = {
  lead: "bg-emerald-500",
  active: "bg-emerald-500",
  potential: "bg-amber-500",
  repeat: "bg-indigo-500",
  inactive: "bg-red-500",
};

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

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; recency?: string }>;
}) {
  const { q = "", status = "all", recency = "all" } = await searchParams;

  const supabase = await createClient();
  let query = supabase.from("customers").select("*");

  if (q) query = query.ilike("name", `%${q}%`);
  if (status !== "all") query = query.eq("status", status);

  const { data: customers } = await query;
  const list = (customers ?? []) as Customer[];

  const latestFollowUpByCustomer = new Map<string, FollowUp>();
  const latestActionableByCustomer = new Map<string, FollowUp>();
  if (list.length > 0) {
    const { data: followUps } = await supabase
      .from("follow_ups")
      .select("*")
      .in(
        "customer_id",
        list.map((c) => c.id)
      )
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });

    for (const f of (followUps ?? []) as FollowUp[]) {
      if (!latestFollowUpByCustomer.has(f.customer_id)) {
        latestFollowUpByCustomer.set(f.customer_id, f);
      }
      if (
        f.status !== "other" &&
        !latestActionableByCustomer.has(f.customer_id)
      ) {
        latestActionableByCustomer.set(f.customer_id, f);
      }
    }
  }

  const latestOrderByCustomer = new Map<string, Order>();
  if (list.length > 0) {
    const { data: orders } = await supabase
      .from("orders")
      .select("*")
      .in(
        "customer_id",
        list.map((c) => c.id)
      )
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });

    for (const o of (orders ?? []) as Order[]) {
      if (!latestOrderByCustomer.has(o.customer_id)) {
        latestOrderByCustomer.set(o.customer_id, o);
      }
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  function followUpDot(customerId: string) {
    const actionable = latestActionableByCustomer.get(customerId);
    if (
      actionable &&
      (actionable.status === "scheduled_call" ||
        actionable.status === "scheduled_email")
    ) {
      return { color: "bg-red-500", title: "Upcoming call/email" };
    }
    if (latestFollowUpByCustomer.has(customerId)) {
      return { color: "bg-emerald-500", title: "Already contacted" };
    }
    return null;
  }

  function followUpBadge(customerId: string) {
    const actionable = latestActionableByCustomer.get(customerId);
    if (
      actionable &&
      (actionable.status === "scheduled_call" ||
        actionable.status === "scheduled_email") &&
      actionable.due_date
    ) {
      const label = actionable.status === "scheduled_call" ? "Call" : "Email";
      if (actionable.due_date < today) {
        return {
          text: `${label} overdue — ${new Date(actionable.due_date).toLocaleDateString()}`,
          color: "bg-red-100 text-red-700",
        };
      }
      if (actionable.due_date === today) {
        return {
          text: `${label} due today`,
          color: "bg-amber-100 text-amber-800",
        };
      }
      return {
        text: `${label} on ${new Date(actionable.due_date).toLocaleDateString()}`,
        color: "bg-slate-100 text-slate-700",
      };
    }

    const last = latestFollowUpByCustomer.get(customerId);
    if (last) {
      return {
        text: `Last: ${FOLLOW_UP_STATUS_LABELS[last.status]} · ${new Date(last.created_at).toLocaleDateString()}`,
        muted: true,
      };
    }

    return null;
  }

  // Filter by order recency, then sort most-recently-ordered first, then
  // group into month buckets. Customers with no order at all sit in their
  // own trailing group and are excluded by any relative-recency filter
  // (there's no order date for them to match against).
  let withOrder = list.map((customer) => ({
    customer,
    order: latestOrderByCustomer.get(customer.id) ?? null,
  }));

  if (recency !== "all") {
    const cutoff = new Date().getTime() - Number(recency) * 24 * 60 * 60 * 1000;
    withOrder = withOrder.filter(
      (r) => r.order && new Date(r.order.created_at).getTime() >= cutoff
    );
  }

  withOrder.sort((a, b) => {
    if (!a.order && !b.order) return 0;
    if (!a.order) return 1;
    if (!b.order) return -1;
    return (
      new Date(b.order.created_at).getTime() -
      new Date(a.order.created_at).getTime()
    );
  });

  const groups: { label: string; rows: typeof withOrder }[] = [];
  for (const row of withOrder) {
    const label = row.order
      ? MONTH_FORMAT.format(new Date(row.order.created_at))
      : "No orders yet";
    const group = groups.find((g) => g.label === label);
    if (group) group.rows.push(row);
    else groups.push({ label, rows: [row] });
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Customers</h1>
        <Link
          href="/customers/new"
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          + Add customer
        </Link>
      </div>

      <form className="mt-4 flex flex-wrap gap-2" method="get">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search by name..."
          className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
        />
        <select
          name="status"
          defaultValue={status}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        >
          <option value="all">All statuses</option>
          {CUSTOMER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
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
            No customers match these filters.
          </p>
        )}
        {groups.map((group) => (
          <div key={group.label}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {group.label}
            </h2>
            <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
              {group.rows.map(({ customer, order }) => {
                const badge = followUpBadge(customer.id);
                const dot = followUpDot(customer.id);
                const deleteCustomerWithId = deleteCustomer.bind(
                  null,
                  customer.id
                );
                const updateOrderStatusWithIds = order
                  ? updateOrderStatusQuick.bind(null, customer.id, order.id)
                  : null;
                return (
                  <div
                    key={customer.id}
                    className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50"
                  >
                    <Link
                      href={`/customers/${customer.id}`}
                      className="min-w-0 flex-1"
                    >
                      <p className="truncate font-medium text-slate-900">
                        {customer.name}
                      </p>
                      <p className="truncate text-sm text-slate-500">
                        {customer.contact_channel}
                        {customer.contact_handle
                          ? ` · ${customer.contact_handle}`
                          : ""}
                        {customer.tags.length > 0
                          ? ` · ${customer.tags.join(", ")}`
                          : ""}
                        {" · Added "}
                        {new Date(customer.created_at).toLocaleDateString()}
                      </p>
                      {badge && (
                        <p className="mt-1">
                          {badge.muted ? (
                            <span className="text-xs text-slate-400">
                              {badge.text}
                            </span>
                          ) : (
                            <span
                              className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${badge.color}`}
                            >
                              {badge.text}
                            </span>
                          )}
                        </p>
                      )}
                    </Link>
                    <div className="flex shrink-0 items-center gap-2">
                      {dot && (
                        <span
                          title={dot.title}
                          className={`h-2 w-2 rounded-full ${dot.color}`}
                        />
                      )}
                      <span
                        title={STATUS_LABELS[customer.status]}
                        className={`h-2 w-2 rounded-full ${STATUS_DOT_COLORS[customer.status]}`}
                      />
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[customer.status]}`}
                      >
                        {STATUS_LABELS[customer.status]}
                      </span>
                      {order && updateOrderStatusWithIds && (
                        <form action={updateOrderStatusWithIds}>
                          <AutoSubmitSelect
                            name="order_status"
                            defaultValue={order.order_status}
                            className={`rounded-full border-0 px-2 py-0.5 text-xs font-medium ${ORDER_TRACKING_COLORS[order.order_status]}`}
                          >
                            {ORDER_TRACKING_STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {ORDER_TRACKING_LABELS[s]}
                              </option>
                            ))}
                          </AutoSubmitSelect>
                        </form>
                      )}
                      <form action={deleteCustomerWithId}>
                        <ConfirmSubmitButton
                          confirmMessage={`Delete ${customer.name}? This removes all their orders, teams, players, designs, notes, pricing, and parcels too. This can't be undone.`}
                          className="text-xs text-slate-400 hover:text-red-600"
                        >
                          Delete
                        </ConfirmSubmitButton>
                      </form>
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
