import { expectsCosts, orderProfit, type OrderCosts } from "@/lib/costs";
import { getOrderMoney, moneyFields } from "@/lib/orderMoney";
import type { Order } from "@/lib/types";

const fmt = (n: number) => n.toLocaleString("en-AU", { style: "currency", currency: "AUD" });

/** Small "Costs $340 · Profit $410 (54%)" line under an order on the Orders page and
 * dashboard, plus reminders when a supplier bill or shipping cost hasn't been entered. */
export function OrderCostLine({ order, costs }: { order: Order; costs: OrderCosts | undefined }) {
  const total = costs?.total ?? 0;
  const money = getOrderMoney(moneyFields(order));
  const result = orderProfit(money.total, total);
  const missing: string[] = [];
  if (expectsCosts(order.order_status)) {
    if (!costs?.hasSupplier) missing.push("supplier bill");
    if (!costs?.hasShipping) missing.push("shipping");
  }

  if (total === 0 && missing.length === 0) return null;

  return (
    <div className="mt-1 space-y-0.5 text-xs">
      {total > 0 && (
        <p className="text-slate-500">
          Costs {fmt(total)}
          {result && (
            <>
              {" · "}
              <span className={result.profit < 0 ? "font-medium text-red-600" : "font-medium text-slate-700"}>
                Profit {fmt(result.profit)}
                {result.marginPct != null ? ` (${result.marginPct.toFixed(0)}%)` : ""}
              </span>
              <span className="text-slate-400"> ex GST</span>
            </>
          )}
        </p>
      )}
      {missing.length > 0 && <p className="text-amber-700">⚠ No {missing.join(" or ")} entered yet</p>}
    </div>
  );
}
