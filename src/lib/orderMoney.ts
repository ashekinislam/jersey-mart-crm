import type { Order } from "@/lib/types";

export interface OrderMoney {
  total: number | null;
  paid: number | null;
  unpaid: number | null;
  /** "reckon" = read from the linked Reckon invoice; "crm" = worked out from the
   * CRM's own sale amount + payment status; null = no amount known at all. */
  source: "reckon" | "crm" | null;
}

const cents = (n: number) => Math.round(n * 100) / 100;

/** Total / paid / unpaid for one order. Prefers the linked Reckon invoice's
 * figures (refreshed on each Reckon sync). Orders with no Reckon link fall back
 * to the CRM sale amount, where paid/unpaid can only be inferred from the
 * payment status -- and "partially paid" can't be split, so it stays unknown
 * rather than guessed. */
export function getOrderMoney(
  order: Pick<
    Order,
    "reckon_total" | "reckon_balance" | "sale_amount" | "payment_status"
  >
): OrderMoney {
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
  switch (order.payment_status) {
    case "paid":
      return { total, paid: total, unpaid: 0, source: "crm" };
    case "unpaid":
    case "invoice_sent":
      return { total, paid: 0, unpaid: total, source: "crm" };
    default:
      return { total, paid: null, unpaid: null, source: "crm" };
  }
}
