import type { Order, PaymentStatus } from "@/lib/types";

export type OrderMoneyFields = Pick<
  Order,
  | "reckon_total"
  | "reckon_balance"
  | "sale_amount"
  | "payment_status"
  | "manual_total"
  | "manual_paid"
>;

export interface OrderMoney {
  total: number | null;
  paid: number | null;
  unpaid: number | null;
  /** "manual" = the owner edited total and/or paid in the CRM; "reckon" = read from
   * the linked Reckon invoice; "crm" = worked out from the CRM's own sale amount +
   * payment status; null = no amount known at all. */
  source: "manual" | "reckon" | "crm" | null;
}

const cents = (n: number) => Math.round(n * 100) / 100;
const sameAmount = (a: number | null, b: number | null) =>
  a === b || (a != null && b != null && Math.abs(a - b) < 0.005);

/** Just the fields the money display needs -- keeps the data sent to the browser small. */
export function moneyFields(order: OrderMoneyFields): OrderMoneyFields {
  return {
    reckon_total: order.reckon_total ?? null,
    reckon_balance: order.reckon_balance ?? null,
    sale_amount: order.sale_amount ?? null,
    payment_status: order.payment_status,
    manual_total: order.manual_total ?? null,
    manual_paid: order.manual_paid ?? null,
  };
}

/** Paid amount implied by the payment status alone. "Partially paid" can't be
 * split, so it stays unknown rather than guessed. */
function paidFromStatus(status: PaymentStatus, total: number): number | null {
  switch (status) {
    case "paid":
      return total;
    case "unpaid":
    case "invoice_sent":
      return 0;
    default:
      return null;
  }
}

/** The figures before any owner edits: the linked Reckon invoice (refreshed on
 * each sync), else the CRM sale amount with paid/unpaid inferred from status. */
export function getBaseOrderMoney(order: OrderMoneyFields): OrderMoney {
  if (order.reckon_total != null && order.reckon_balance != null) {
    const total = order.reckon_total;
    // A negative balance (overpayment/credit) still counts as fully paid.
    const unpaid = cents(Math.min(Math.max(order.reckon_balance, 0), Math.max(total, 0)));
    return { total: cents(total), paid: cents(total - unpaid), unpaid, source: "reckon" };
  }

  if (order.sale_amount == null) {
    return { total: null, paid: null, unpaid: null, source: null };
  }

  const total = cents(order.sale_amount);
  const paid = paidFromStatus(order.payment_status, total);
  return {
    total,
    paid,
    unpaid: paid == null ? null : cents(total - paid),
    source: "crm",
  };
}

/** Total / paid / unpaid for one order, with any owner edits applied on top. */
export function getOrderMoney(order: OrderMoneyFields): OrderMoney {
  const base = getBaseOrderMoney(order);
  if (order.manual_total == null && order.manual_paid == null) return base;

  const total = order.manual_total != null ? cents(order.manual_total) : base.total;
  const paid =
    order.manual_paid != null
      ? cents(order.manual_paid)
      : base.paid ?? (total != null ? paidFromStatus(order.payment_status, total) : null);
  const unpaid =
    total != null && paid != null ? cents(Math.max(total - paid, 0)) : null;
  return { total, paid, unpaid, source: "manual" };
}

/** Turns what the owner typed into the values to store. A blank box, or a value
 * equal to what Reckon/the CRM already shows, stores nothing (null) -- so only
 * the figure they actually changed is pinned, and the other keeps following
 * Reckon (e.g. a later payment still shows up after a sync). */
export function resolveManualAmounts(
  order: OrderMoneyFields,
  input: { total: number | null; paid: number | null }
): { manual_total: number | null; manual_paid: number | null } {
  const base = getBaseOrderMoney(order);
  const pin = (typed: number | null, current: number | null) =>
    typed == null || sameAmount(cents(typed), current) ? null : cents(typed);
  return {
    manual_total: pin(input.total, base.total),
    manual_paid: pin(input.paid, base.paid),
  };
}
