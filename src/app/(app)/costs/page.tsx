import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  brisbaneToday,
  buildCostsByOrder,
  cents,
  expectsCosts,
  inMonth,
  monthBreakdown,
  monthLabel,
  periodPresets,
  resolvePeriod,
  summarisePeriod,
  unassignedTotal,
  type PeriodKind,
} from "@/lib/costs";
import { getOrderMoney, moneyFields } from "@/lib/orderMoney";
import type { Customer, Expense, ExpenseAllocation, Order } from "@/lib/types";
import { AdSpendQuickAdd } from "@/components/AdSpendQuickAdd";
import { AdSpendList } from "@/components/AdSpendList";
import { FacebookAdsSyncButtons } from "@/components/FacebookAdsSyncButtons";
import { BillForm, type BillKind, type OrderOption } from "@/components/BillForm";
import { BillsList, type BillRow } from "@/components/BillsList";
import { CostsPeriodSummary } from "@/components/CostsPeriodSummary";
import { CostsByMonthTable } from "@/components/CostsByMonthTable";
import { CostsPeriodPicker } from "@/components/CostsPeriodPicker";

const fmt = (n: number) => n.toLocaleString("en-AU", { style: "currency", currency: "AUD" });

const BILL_TABS: { key: BillKind; label: string; plural: string; singular: string }[] = [
  { key: "supplier", label: "Supplier bills", plural: "supplier bills", singular: "supplier bill" },
  { key: "shipping", label: "Shipping", plural: "shipping invoices", singular: "shipping invoice" },
  { key: "other", label: "Other expenses", plural: "other expenses", singular: "other expense" },
];

export default async function CostsPage({
  searchParams,
}: {
  searchParams: Promise<{
    month?: string;
    show?: string;
    order?: string;
    tab?: string;
    period?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const sp = await searchParams;
  const today = brisbaneToday();
  const chosen = resolvePeriod(sp, today);
  const { month } = chosen;
  const showUnpaid = sp.show === "unpaid";
  const tab: BillKind = sp.tab === "shipping" || sp.tab === "other" ? sp.tab : "supplier";

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

  const costsByOrder = buildCostsByOrder(expenses, allocations);
  const orderOptions: OrderOption[] = orders.map((o) => {
    const costs = costsByOrder.get(o.id);
    const shouldHaveCosts = expectsCosts(o.order_status);
    return {
      id: o.id,
      title: customerName.get(o.customer_id) ?? "Unknown customer",
      subtitle: o.label || `Order — ${new Date(o.order_date).toLocaleDateString("en-AU")}`,
      href: `/customers/${o.customer_id}/orders/${o.id}`,
      players: playersByOrder.get(o.id) ?? 0,
      value: getOrderMoney(moneyFields(o)).total,
      missingSupplier: shouldHaveCosts && !costs?.hasSupplier,
      missingShipping: shouldHaveCosts && !costs?.hasShipping,
    };
  });

  const summary = summarisePeriod({ period: chosen.period, orders, costsByOrder, expenses });
  const monthRows = monthBreakdown({ period: chosen.period, orders, costsByOrder, expenses });
  const unassigned = unassignedTotal(expenses, allocations);

  const allocationsByExpense = new Map<string, { order_id: string; amount: number }[]>();
  for (const a of allocations) {
    allocationsByExpense.set(a.expense_id, [
      ...(allocationsByExpense.get(a.expense_id) ?? []),
      { order_id: a.order_id, amount: a.amount },
    ]);
  }

  const billsOfKind = (kind: BillKind) => expenses.filter((e) => e.kind === kind);
  const unpaidOf = (list: Expense[]) => list.filter((e) => e.paid_date == null);
  const tabBills = billsOfKind(tab);
  const tabUnpaid = unpaidOf(tabBills);
  const tabTotal = cents(tabBills.reduce((s, e) => s + e.amount, 0));
  const owed = cents(tabUnpaid.reduce((s, e) => s + e.amount, 0));
  const tabInfo = BILL_TABS.find((t) => t.key === tab)!;
  const periodParams = (): Record<string, string> => ({
    period: chosen.kind,
    month,
    ...(chosen.kind === "custom" ? { from: chosen.from, to: chosen.to } : {}),
  });
  const billsHref = (kind: BillKind, unpaidOnly: boolean) =>
    `/costs?${new URLSearchParams({ ...periodParams(), tab: kind, ...(unpaidOnly ? { show: "unpaid" } : {}) })}#bills`;
  const profitHref = (choice: { period: PeriodKind; from?: string; to?: string }) =>
    `/costs?${new URLSearchParams({
      month,
      period: choice.period,
      ...(choice.period === "custom" ? { from: choice.from ?? chosen.from, to: choice.to ?? chosen.to } : {}),
      tab,
      ...(showUnpaid ? { show: "unpaid" } : {}),
    })}#profit`;
  const shownBills: BillRow[] = (showUnpaid ? tabUnpaid : tabBills).map((e) => ({
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

      <section id="profit" className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">
          {chosen.kind === "all" ? "Profit — all time" : `Profit for ${chosen.label}`}
        </h2>
        <div className="mt-3">
          <CostsPeriodPicker
            kind={chosen.kind}
            month={month}
            from={chosen.from}
            to={chosen.to}
            presets={periodPresets(today)}
            hrefFor={profitHref}
            carry={{ tab, ...(showUnpaid ? { show: "unpaid" } : {}) }}
          />
        </div>
        <div className="mt-4">
          <CostsPeriodSummary summary={summary} phrase={chosen.phrase} unassigned={unassigned} />
        </div>
        <CostsByMonthTable rows={monthRows} total={summary} />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Facebook ad charges</h2>
        <p className="mt-1 text-xs text-slate-500">
          Type the amount and press Enter — it clears ready for the next charge.
          Or pull real spend straight from Facebook below (never overwrites a
          charge you&rsquo;ve entered by hand).
        </p>
        <div className="mt-3">
          <AdSpendQuickAdd today={today} />
        </div>
        <div className="mt-3">
          <FacebookAdsSyncButtons />
        </div>
        <AdSpendList ads={monthAds} monthLabel={monthLabel(month)} />
      </section>

      <section id="add-bill" className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Add a bill</h2>
        <p className="mt-1 text-xs text-slate-500">
          A supplier bill for several orders, a shipping invoice, or another business expense.
        </p>
        <div className="mt-3">
          <BillForm
            orders={orderOptions}
            today={today}
            defaultOrderId={defaultOrderId}
            defaultKind={tab}
          />
        </div>
      </section>

      <section id="bills" className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Bills</h2>

        <nav aria-label="Kind of bill" className="mt-3 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
          {BILL_TABS.map((t) => {
            const list = billsOfKind(t.key);
            const unpaidCount = unpaidOf(list).length;
            return (
              <Link
                key={t.key}
                href={billsHref(t.key, false)}
                aria-current={tab === t.key ? "page" : undefined}
                className={`${tabClass(tab === t.key)} inline-flex items-center gap-1.5`}
              >
                {t.label} ({list.length})
                {unpaidCount > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[0.65rem] font-semibold ${
                      tab === t.key ? "bg-amber-300 text-amber-950" : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {unpaidCount} unpaid
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-slate-600">
            {tabBills.length} {tabBills.length === 1 ? tabInfo.singular : tabInfo.plural} · {fmt(tabTotal)} in total
          </p>
          <div className="flex gap-2">
            <Link href={billsHref(tab, false)} className={tabClass(!showUnpaid)}>
              All
            </Link>
            <Link href={billsHref(tab, true)} className={tabClass(showUnpaid)}>
              Not paid yet ({tabUnpaid.length})
            </Link>
          </div>
        </div>
        {tabBills.length > 0 &&
          (tabUnpaid.length > 0 ? (
            <p className="mt-1 text-sm text-amber-800">
              You still owe {fmt(owed)} across {tabUnpaid.length}{" "}
              {tabUnpaid.length === 1 ? tabInfo.singular : tabInfo.plural}.
            </p>
          ) : (
            <p className="mt-1 text-sm text-emerald-700">All {tabInfo.plural} are paid.</p>
          ))}

        <BillsList
          bills={shownBills}
          orders={orderOptions}
          today={today}
          emptyText={
            showUnpaid && tabBills.length > 0
              ? `Nothing unpaid — all ${tabInfo.plural} are paid.`
              : `No ${tabInfo.plural} entered yet.`
          }
        />
      </section>
    </div>
  );
}
