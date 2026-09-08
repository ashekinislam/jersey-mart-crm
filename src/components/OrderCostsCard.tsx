import { updateOrderCosts } from "@/app/(app)/actions";
import type { Order } from "@/lib/types";

function fmt(n: number) {
  return n.toLocaleString("en-AU", { style: "currency", currency: "AUD" });
}

export function OrderCostsCard({
  customerId,
  orderId,
  order,
}: {
  customerId: string;
  orderId: string;
  order: Order;
}) {
  const updateOrderCostsWithIds = updateOrderCosts.bind(
    null,
    customerId,
    orderId
  );

  const hasCosts =
    order.supplier_cost != null || order.freight_cost != null;
  const totalCosts =
    (order.supplier_cost ?? 0) + (order.freight_cost ?? 0);
  const grossProfit =
    order.sale_amount != null && hasCosts
      ? order.sale_amount - totalCosts
      : null;
  const marginPct =
    grossProfit != null && order.sale_amount
      ? (grossProfit / order.sale_amount) * 100
      : null;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">Costs</h2>
      <p className="mt-1 text-xs text-slate-500">
        Track what this order actually cost to fulfil, mirroring your ledger.
      </p>

      <form
        action={updateOrderCostsWithIds}
        className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3"
      >
        <div>
          <label className="block text-xs font-medium text-slate-600">
            Sale amount
          </label>
          <input
            type="number"
            step="0.01"
            name="sale_amount"
            defaultValue={order.sale_amount ?? ""}
            placeholder="0.00"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">
            Supplier cost
          </label>
          <input
            type="number"
            step="0.01"
            name="supplier_cost"
            defaultValue={order.supplier_cost ?? ""}
            placeholder="0.00"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">
            Freight cost
          </label>
          <input
            type="number"
            step="0.01"
            name="freight_cost"
            defaultValue={order.freight_cost ?? ""}
            placeholder="0.00"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div className="sm:col-span-3">
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Save
          </button>
        </div>
      </form>

      {hasCosts && (
        <div className="mt-4 grid grid-cols-1 gap-2 border-t border-slate-100 pt-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-slate-500">Total costs</p>
            <p className="text-sm font-medium text-slate-900">
              {fmt(totalCosts)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Gross profit</p>
            <p
              className={`text-sm font-medium ${grossProfit != null && grossProfit < 0 ? "text-red-600" : "text-slate-900"}`}
            >
              {grossProfit != null ? fmt(grossProfit) : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Margin</p>
            <p className="text-sm font-medium text-slate-900">
              {marginPct != null ? `${marginPct.toFixed(1)}%` : "—"}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
