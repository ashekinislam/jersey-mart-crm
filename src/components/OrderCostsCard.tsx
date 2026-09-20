import Link from "next/link";
import { expectsCosts, gstOf, orderProfit, type OrderCosts } from "@/lib/costs";
import { getOrderMoney, moneyFields } from "@/lib/orderMoney";
import { EXPENSE_KIND_COLORS, EXPENSE_KIND_LABELS, type Order } from "@/lib/types";

const fmt = (n: number) => n.toLocaleString("en-AU", { style: "currency", currency: "AUD" });
const fmtDate = (d: string) =>
  new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(`${d}T00:00:00`)
  );

export function OrderCostsCard({
  orderId,
  order,
  costs,
}: {
  customerId: string;
  orderId: string;
  order: Order;
  costs: OrderCosts | undefined;
}) {
  const entries = costs?.entries ?? [];
  const total = costs?.total ?? 0;
  const money = getOrderMoney(moneyFields(order));
  const result = orderProfit(money.total, total);
  const missing: string[] = [];
  if (expectsCosts(order.order_status)) {
    if (!costs?.hasSupplier) missing.push("a supplier bill");
    if (!costs?.hasShipping) missing.push("a shipping cost");
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">Costs &amp; profit</h2>
        <Link
          href={`/costs?order=${orderId}#add-bill`}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
        >
          + Add a supplier bill or shipping cost
        </Link>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Bills are entered on the Costs page. A bill that covers several orders shows just this order&rsquo;s share
        here.
      </p>

      {missing.length > 0 && (
        <p className="mt-3 rounded-md bg-amber-50 p-2 text-xs text-amber-800">
          ⚠ No {missing.join(" or ")} has been added to this order yet, so the profit below is higher than it will
          end up.
        </p>
      )}

      {entries.length > 0 && (
        <ul className="mt-3 divide-y divide-slate-100">
          {entries.map((e) => (
            <li key={e.allocationId} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-slate-500">{fmtDate(e.expense.expense_date)}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${EXPENSE_KIND_COLORS[e.expense.kind]}`}
                >
                  {EXPENSE_KIND_LABELS[e.expense.kind]}
                </span>
                <span className="text-slate-800">{e.expense.payee || "—"}</span>
                {e.amount < e.expense.amount - 0.005 && (
                  <span className="text-xs text-slate-400">share of a {fmt(e.expense.amount)} bill</span>
                )}
                {!e.expense.paid_date && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                    not paid yet
                  </span>
                )}
              </span>
              <span className="font-medium tabular-nums text-slate-900">{fmt(e.amount)}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 sm:grid-cols-4">
        <div>
          <p className="text-xs text-slate-500">Order total (incl. GST)</p>
          <p className="text-sm font-medium tabular-nums text-slate-900">
            {money.total != null ? fmt(money.total) : "—"}
          </p>
          {money.total != null && (
            <p className="text-xs text-slate-400">GST {fmt(gstOf(money.total))}</p>
          )}
        </div>
        <div>
          <p className="text-xs text-slate-500">Total costs</p>
          <p className="text-sm font-medium tabular-nums text-slate-900">{fmt(total)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Profit (ex GST)</p>
          <p
            className={`text-sm font-medium tabular-nums ${result && result.profit < 0 ? "text-red-600" : "text-slate-900"}`}
          >
            {result ? fmt(result.profit) : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Margin</p>
          <p className="text-sm font-medium tabular-nums text-slate-900">
            {result?.marginPct != null ? `${result.marginPct.toFixed(1)}%` : "—"}
          </p>
        </div>
      </div>
      {money.total == null && (
        <p className="mt-2 text-xs text-slate-500">
          This order has no total yet — set it with &ldquo;Edit amounts&rdquo; on the Orders page.
        </p>
      )}
    </section>
  );
}
