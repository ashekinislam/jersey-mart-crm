import type { SupabaseClient } from "@supabase/supabase-js";
import { getOrderMoney, moneyFields } from "@/lib/orderMoney";
import type {
  Expense,
  ExpenseAllocation,
  ExpenseKind,
  Order,
  OrderTrackingStatus,
} from "@/lib/types";

// ---- Basic money helpers ------------------------------------------------------

export const cents = (n: number) => Math.round(n * 100) / 100;

/** GST inside a GST-inclusive price -- same rule as the ledger spreadsheet (price / 11). */
export const gstOf = (incGst: number) => cents(incGst / 11);
export const exGst = (incGst: number) => cents(incGst - incGst / 11);

/** Splits `total` across `weights` so the parts add up to EXACTLY the total, to
 * the cent (largest-remainder rounding). If every weight is zero it splits evenly. */
export function splitByWeights(total: number, weights: number[]): number[] {
  if (weights.length === 0) return [];
  const totalCents = Math.round(total * 100);
  const usable = weights.some((w) => w > 0) ? weights.map((w) => Math.max(w, 0)) : weights.map(() => 1);
  const sum = usable.reduce((a, b) => a + b, 0);
  const raw = usable.map((w) => (totalCents * w) / sum);
  const floors = raw.map(Math.floor);
  let leftover = totalCents - floors.reduce((a, b) => a + b, 0);
  const byFraction = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of byFraction) {
    if (leftover <= 0) break;
    floors[i] += 1;
    leftover -= 1;
  }
  return floors.map((c) => c / 100);
}

/** "Today" as a YYYY-MM-DD date in Brisbane, where the business runs. */
export function brisbaneToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Brisbane" }).format(new Date());
}

/** First day of the month after `month` (YYYY-MM), as YYYY-MM-DD. */
function nextMonthStart(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
}

export function monthRange(month: string): { start: string; end: string } {
  return { start: `${month}-01`, end: nextMonthStart(month) };
}

export const inMonth = (date: string, month: string) => {
  const { start, end } = monthRange(month);
  return date >= start && date < end;
};

// ---- Saving a bill ------------------------------------------------------------

/** What the Costs forms send to the server when saving a bill. */
export interface ExpenseInput {
  kind: ExpenseKind;
  expense_date: string;
  amount: number;
  payee: string;
  reference: string;
  notes: string;
  /** null = not paid yet */
  paid_date: string | null;
  /** Only for supplier bills / shipping invoices. */
  allocations: { order_id: string; amount: number }[];
}

export type ActionResult = { ok: true } | { ok: false; error: string };

// ---- Per-order costs ----------------------------------------------------------

export interface OrderCostEntry {
  allocationId: string;
  /** This order's share of the bill. */
  amount: number;
  expense: Pick<
    Expense,
    "id" | "kind" | "expense_date" | "payee" | "reference" | "amount" | "paid_date"
  >;
}

export interface OrderCosts {
  total: number;
  supplier: number;
  shipping: number;
  hasSupplier: boolean;
  hasShipping: boolean;
  entries: OrderCostEntry[];
}

const emptyCosts = (): OrderCosts => ({
  total: 0,
  supplier: 0,
  shipping: 0,
  hasSupplier: false,
  hasShipping: false,
  entries: [],
});

/** Groups bill allocations by order into per-order cost totals. */
export function buildCostsByOrder(
  expenses: Expense[],
  allocations: Pick<ExpenseAllocation, "id" | "expense_id" | "order_id" | "amount">[]
): Map<string, OrderCosts> {
  const expenseById = new Map(expenses.map((e) => [e.id, e]));
  const byOrder = new Map<string, OrderCosts>();

  for (const a of allocations) {
    const e = expenseById.get(a.expense_id);
    if (!e) continue;
    const costs = byOrder.get(a.order_id) ?? emptyCosts();
    costs.entries.push({
      allocationId: a.id,
      amount: a.amount,
      expense: {
        id: e.id,
        kind: e.kind,
        expense_date: e.expense_date,
        payee: e.payee,
        reference: e.reference,
        amount: e.amount,
        paid_date: e.paid_date,
      },
    });
    costs.total = cents(costs.total + a.amount);
    if (e.kind === "supplier") {
      costs.supplier = cents(costs.supplier + a.amount);
      costs.hasSupplier = true;
    } else if (e.kind === "shipping") {
      costs.shipping = cents(costs.shipping + a.amount);
      costs.hasShipping = true;
    }
    byOrder.set(a.order_id, costs);
  }

  for (const costs of byOrder.values()) {
    costs.entries.sort((a, b) => a.expense.expense_date.localeCompare(b.expense.expense_date));
  }
  return byOrder;
}

/** Loads bill allocations and groups them per order. Pass `orderIds` to load just those orders. */
export async function loadOrderCosts(
  supabase: SupabaseClient,
  orderIds?: string[]
): Promise<Map<string, OrderCosts>> {
  let allocQuery = supabase
    .from("expense_allocations")
    .select("id, expense_id, order_id, amount");
  if (orderIds) allocQuery = allocQuery.in("order_id", orderIds);
  const { data: allocs } = await allocQuery;
  const allocations = (allocs ?? []) as Pick<
    ExpenseAllocation,
    "id" | "expense_id" | "order_id" | "amount"
  >[];
  if (allocations.length === 0) return new Map();

  const { data: exps } = await supabase
    .from("expenses")
    .select("*")
    .in("id", [...new Set(allocations.map((a) => a.expense_id))]);
  return buildCostsByOrder((exps ?? []) as Expense[], allocations);
}

/** Records one already-known cost against a single order (used when an AI draft
 * that carries supplier/freight costs is approved). Not paid yet -- the owner can tick it. */
export async function recordOrderCost(
  supabase: SupabaseClient,
  args: {
    ownerId: string;
    orderId: string;
    kind: "supplier" | "shipping";
    amount: number;
    date: string;
    payee: string;
  }
): Promise<void> {
  const { data: expense } = await supabase
    .from("expenses")
    .insert({
      owner_id: args.ownerId,
      kind: args.kind,
      expense_date: args.date,
      amount: args.amount,
      payee: args.payee,
    })
    .select("id")
    .single();
  if (!expense) return;
  await supabase.from("expense_allocations").insert({
    owner_id: args.ownerId,
    expense_id: expense.id,
    order_id: args.orderId,
    amount: args.amount,
  });
}

/** Quotes and cancelled orders aren't expected to have costs yet. */
export const expectsCosts = (status: OrderTrackingStatus) =>
  status !== "quote_sent" && status !== "cancelled";

/** Revenue (ex GST), profit and margin for one order, or null when the order has no total yet. */
export function orderProfit(
  totalIncGst: number | null,
  costsTotal: number
): { revenueExGst: number; profit: number; marginPct: number | null } | null {
  if (totalIncGst == null) return null;
  const revenueExGst = exGst(totalIncGst);
  const profit = cents(revenueExGst - costsTotal);
  return {
    revenueExGst,
    profit,
    marginPct: revenueExGst > 0 ? (profit / revenueExGst) * 100 : null,
  };
}

// ---- Monthly summary ----------------------------------------------------------

export interface MonthSummary {
  orderCount: number;
  salesIncGst: number;
  gst: number;
  salesExGst: number;
  orderCosts: number;
  grossProfit: number;
  adSpend: number;
  otherExpenses: number;
  netProfit: number;
  adSpendPerOrder: number | null;
  /** Orders in the month still missing a supplier bill or a shipping cost. */
  ordersMissingCosts: number;
  /** Orders in the month with no total amount at all. */
  ordersWithoutTotal: number;
}

/** Sales and order costs are for orders PLACED in the month (quotes and cancelled
 * orders excluded); ad spend and other expenses are for charges DATED in the month. */
export function summariseMonth(args: {
  month: string;
  orders: Order[];
  costsByOrder: Map<string, OrderCosts>;
  expenses: Expense[];
}): MonthSummary {
  const monthOrders = args.orders.filter(
    (o) => inMonth(o.order_date, args.month) && expectsCosts(o.order_status)
  );

  let salesIncGst = 0;
  let salesExGst = 0;
  let orderCosts = 0;
  let ordersMissingCosts = 0;
  let ordersWithoutTotal = 0;

  for (const o of monthOrders) {
    const total = getOrderMoney(moneyFields(o)).total;
    if (total == null) ordersWithoutTotal++;
    else {
      salesIncGst += total;
      salesExGst += exGst(total);
    }
    const costs = args.costsByOrder.get(o.id);
    orderCosts += costs?.total ?? 0;
    if (!costs?.hasSupplier || !costs?.hasShipping) ordersMissingCosts++;
  }

  const monthExpenses = args.expenses.filter((e) => inMonth(e.expense_date, args.month));
  const adSpend = monthExpenses.filter((e) => e.kind === "ads").reduce((s, e) => s + e.amount, 0);
  const otherExpenses = monthExpenses
    .filter((e) => e.kind === "other")
    .reduce((s, e) => s + e.amount, 0);

  const grossProfit = salesExGst - orderCosts;
  return {
    orderCount: monthOrders.length,
    salesIncGst: cents(salesIncGst),
    gst: cents(salesIncGst - salesExGst),
    salesExGst: cents(salesExGst),
    orderCosts: cents(orderCosts),
    grossProfit: cents(grossProfit),
    adSpend: cents(adSpend),
    otherExpenses: cents(otherExpenses),
    netProfit: cents(grossProfit - adSpend - otherExpenses),
    adSpendPerOrder: monthOrders.length > 0 ? cents(adSpend / monthOrders.length) : null,
    ordersMissingCosts,
    ordersWithoutTotal,
  };
}

/** Supplier/shipping money on bills that hasn't been assigned to an order yet, across all time. */
export function unassignedTotal(
  expenses: Expense[],
  allocations: Pick<ExpenseAllocation, "expense_id" | "amount">[]
): number {
  const assigned = new Map<string, number>();
  for (const a of allocations) {
    assigned.set(a.expense_id, (assigned.get(a.expense_id) ?? 0) + a.amount);
  }
  let total = 0;
  for (const e of expenses) {
    if (e.kind !== "supplier" && e.kind !== "shipping") continue;
    const left = e.amount - (assigned.get(e.id) ?? 0);
    if (left > 0.005) total += left;
  }
  return cents(total);
}
