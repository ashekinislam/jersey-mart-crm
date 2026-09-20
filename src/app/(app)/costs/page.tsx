import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  brisbaneToday,
  buildCostsByOrder,
  cents,
  inMonth,
  summariseMonth,
  unassignedTotal,
} from "@/lib/costs";
import { getOrderMoney, moneyFields } from "@/lib/orderMoney";
import type { Customer, Expense, ExpenseAllocation, Order } from "@/lib/types";
import { AdSpendQuickAdd } from "@/components/AdSpendQuickAdd";
import { AdSpendList } from "@/components/AdSpendList";
import { BillForm, type OrderOption } from "@/components/BillForm";
import { BillsList, type BillRow } from "@/components/BillsList";
import { CostsMonthSummary } from "@/components/CostsMonthSummary";

const fmt = (n: number) => n.toLocaleString("en-AU", { style: "currency", currency: "AUD" });

const MONTH_LABEL = new Intl.DateTimeFormat("en-AU", { month: "long", year: "numeric" });
const monthLabel = (month: string) => MONTH_LABEL.format(new Date(`${month}-01T00:00:00`));

export default async function CostsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; show?: string; order?: string }>;
}) {
  const sp = await searchParams;
  const today = brisbaneToday();
  const month = sp.month && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.month) ? sp.month : today.slice(0, 7);
  const showUnpaid = sp.show === "unpaid";

  const supabase = await createClient();
  const [
    { data: ordersData },
    { data: customersData },
    { data: teamsData },
    { data: playersData },
    { data: expensesData },
    { data: allocationsData },
  ] = await Promise.all([
    supabase.from("orders").select("*").order("order_date", { ascending: false }),
    supabase.from("customers").select("id, name"),
    supabase.from("teams").select("id, order_id"),
    supabase.from("players").select("team_id"),
    supabase
      .from("expenses")
      .select("*")
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("expense_allocations").select("id, expense_id, order_id, amount"),
  ]);

  const orders = (ordersData ?? []) as Order[];
  const customers = (customersData ?? []) as Pick<Customer, "id" | "name">[];
  const expenses = (expensesData ?? []) as Expense[];
  const allocations = (allocationsData ?? []) as Pick<
    ExpenseAllocation,
    "id" | "expense_id" | "order_id" | "amount"
  >[];

  const customerName = new Map(customers.map((c) => [c.id, c.name]));
  const orderByTeam = new Map(
    ((teamsData ?? []) as { id: string; order_id: string }[]).map((t) => [t.id, t.order_id])
  );
  const playersByOrder = new Map<string, number>();
  for (const p of (playersData ?? []) as { team_id: string | null }[]) {
    const orderId = p.team_id ? orderByTeam.get(p.team_id) : undefined;
    if (orderId) playersByOrder.set(orderId, (playersByOrder.get(orderId) ?? 0) + 1);
  }

  const orderOptions: OrderOption[] = orders.map((o) => ({
    id: o.id,
    title: customerName.get(o.customer_id) ?? "Unknown customer",
    subtitle: o.label || `Order — ${new Date(o.order_date).toLocaleDateString("en-AU")}`,
    href: `/customers/${o.customer_id}/orders/${o.id}`,
    players: playersByOrder.get(o.id) ?? 0,
    value: getOrderMoney(moneyFields(o)).total,
  }));

  const costsByOrder = buildCostsByOrder(expenses, allocations);
  const summary = summariseMonth({ month, orders, costsByOrder, expenses });
  const unassigned = unassignedTotal(expenses, allocations);

  const allocationsByExpense = new Map<string, { order_id: string; amount: number }[]>();
  for (const a of allocations) {
    allocationsByExpense.set(a.expense_id, [
      ...(allocationsByExpense.get(a.expense_id) ?? []),
      { order_id: a.order_id, amount: a.amount },
    ]);
  }

  const bills = expenses.filter((e) => e.kind !== "ads");
  const unpaidBills = bills.filter((e) => e.paid_date == null);
  const owed = cents(unpaidBills.reduce((s, e) => s + e.amount, 0));
  const shownBills: BillRow[] = (showUnpaid ? unpaidBills : bills).map((e) => ({
    id: e.id,
    kind: e.kind,
    expense_date: e.expense_date,
    amount: e.amount,
    payee: e.payee,
    reference: e.reference,
    notes: e.notes,
    paid_date: e.paid_date,
    allocations: allocationsByExpense.get(e.id) ?? [],
  }));

  const monthAds = expenses.filter((e) => e.kind === "ads" && inMonth(e.expense_date, month));
  const defaultOrderId = orders.some((o) => o.id === sp.order) ? sp.order : undefined;

  const tabClass = (active: boolean) =>
    `rounded-full border px-3 py-1 text-xs font-medium ${
      active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-600 hover:bg-white"
    }`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Costs</h1>
        <p className="mt-1 text-sm text-slate-500">
          Enter each bill once. Supplier bills and shipping invoices get assigned to the orders they cover, so every
          order shows its real profit. Ads and other expenses count against the month. All amounts in AUD.
        </p>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Profit for {monthLabel(month)}</h2>
          <form method="get" className="flex items-center gap-2">
            <label className="sr-only" htmlFor="month">
              Month
            </label>
            <input
              id="month"
              type="month"
              name="month"
              defaultValue={month}
              className="rounded-md border border-slate-300 px-2 py-1 text-sm"
            />
            {showUnpaid && <input type="hidden" name="show" value="unpaid" />}
            <button
              type="submit"
              className="rounded-md border border-slate-300 px-2.5 py-1 text-sm text-slate-700 hover:bg-slate-50"
            >
              Show
            </button>
          </form>
        </div>
        <div className="mt-3">
          <CostsMonthSummary summary={summary} monthLabel={monthLabel(month)} unassigned={unassigned} />
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Facebook ad charges</h2>
        <p className="mt-1 text-xs text-slate-500">
          Type the amount and press Enter — it clears ready for the next charge.
        </p>
        <div className="mt-3">
          <AdSpendQuickAdd today={today} />
        </div>
        <AdSpendList ads={monthAds} monthLabel={monthLabel(month)} />
      </section>

      <section id="add-bill" className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Add a bill</h2>
        <p className="mt-1 text-xs text-slate-500">
          A supplier bill for several orders, a shipping invoice, or another business expense.
        </p>
        <div className="mt-3">
          <BillForm orders={orderOptions} today={today} defaultOrderId={defaultOrderId} />
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Bills</h2>
          <div className="flex gap-2">
            <Link href={`/costs?month=${month}`} className={tabClass(!showUnpaid)}>
              All
            </Link>
            <Link href={`/costs?month=${month}&show=unpaid`} className={tabClass(showUnpaid)}>
              Not paid yet ({unpaidBills.length})
            </Link>
          </div>
        </div>
        {unpaidBills.length > 0 ? (
          <p className="mt-2 text-sm text-amber-800">
            You still owe {fmt(owed)} across {unpaidBills.length} bill{unpaidBills.length === 1 ? "" : "s"}.
          </p>
        ) : (
          <p className="mt-2 text-sm text-emerald-700">All bills are paid.</p>
        )}
        <BillsList bills={shownBills} orders={orderOptions} today={today} />
      </section>
    </div>
  );
}
