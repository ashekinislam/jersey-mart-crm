import { getOrderMoney } from "@/lib/orderMoney";
import type { Order } from "@/lib/types";

function fmt(n: number) {
  return n.toLocaleString("en-AU", { style: "currency", currency: "AUD" });
}

function Figure({
  label,
  value,
  className = "text-slate-900",
}: {
  label: string;
  value: number | null;
  className?: string;
}) {
  return (
    <div>
      <p className="text-[0.65rem] uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className={`text-sm font-medium tabular-nums ${className}`}>
        {value == null ? "—" : fmt(value)}
      </p>
    </div>
  );
}

/** Total / paid / unpaid for an order row on the dashboard and Orders page. */
export function OrderMoney({
  order,
}: {
  order: Pick<
    Order,
    "reckon_total" | "reckon_balance" | "sale_amount" | "payment_status"
  >;
}) {
  const money = getOrderMoney(order);

  if (money.total == null) {
    return (
      <p className="text-xs text-slate-400 sm:w-60 sm:shrink-0 sm:text-right">
        No invoice amount yet
      </p>
    );
  }

  const title =
    money.source === "reckon"
      ? "From the linked Reckon invoice (as of the last Reckon sync)"
      : "From the sale amount in the CRM. This order isn't linked to a Reckon invoice yet, so paid/unpaid is worked out from its payment status.";

  return (
    <div
      title={title}
      className="grid grid-cols-3 gap-x-4 text-left sm:w-60 sm:shrink-0 sm:text-right"
    >
      <Figure label="Total" value={money.total} />
      <Figure label="Paid" value={money.paid} className="text-emerald-700" />
      <Figure
        label="Unpaid"
        value={money.unpaid}
        className={money.unpaid ? "text-red-600" : "text-slate-900"}
      />
    </div>
  );
}
