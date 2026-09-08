import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  CUSTOMER_STATUSES,
  FOLLOW_UP_STATUS_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
  type Customer,
  type FollowUp,
} from "@/lib/types";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q = "", status = "all" } = await searchParams;

  const supabase = await createClient();
  let query = supabase
    .from("customers")
    .select("*")
    .order("updated_at", { ascending: false });

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

  const today = new Date().toISOString().slice(0, 10);

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
        <button
          type="submit"
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-white"
        >
          Filter
        </button>
      </form>

      <div className="mt-6 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {list.length === 0 && (
          <p className="p-6 text-center text-sm text-slate-500">
            No customers yet.
          </p>
        )}
        {list.map((customer) => {
          const badge = followUpBadge(customer.id);
          return (
            <Link
              key={customer.id}
              href={`/customers/${customer.id}`}
              className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-900">
                  {customer.name}
                </p>
                <p className="truncate text-sm text-slate-500">
                  {customer.contact_channel}
                  {customer.contact_handle ? ` · ${customer.contact_handle}` : ""}
                  {customer.tags.length > 0
                    ? ` · ${customer.tags.join(", ")}`
                    : ""}
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
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[customer.status]}`}
              >
                {STATUS_LABELS[customer.status]}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
