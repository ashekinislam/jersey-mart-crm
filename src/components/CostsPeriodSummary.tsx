import type { PeriodSummary } from "@/lib/costs";

const fmt = (n: number) => n.toLocaleString("en-AU", { style: "currency", currency: "AUD" });

function Row({
  label,
  value,
  hint,
  strong,
  negative,
}: {
  label: string;
  value: number;
  hint?: string;
  strong?: boolean;
  negative?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 py-1 ${strong ? "border-t border-slate-200 pt-2 font-semibold" : ""}`}
    >
      <span className={strong ? "text-slate-900" : "text-slate-600"}>
        {label}
        {hint && <span className="ml-1.5 text-xs font-normal text-slate-400">{hint}</span>}
      </span>
      <span
        className={`tabular-nums ${strong ? "text-slate-900" : "text-slate-800"} ${
          strong && value < 0 ? "text-red-600" : ""
        }`}
      >
        {negative && value !== 0 ? `−${fmt(Math.abs(value))}` : fmt(value)}
      </span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-50 px-3 py-2">
      <p className="text-[0.65rem] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-sm font-semibold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}

/** Profit for a month, all time, or a custom date range -- worked out the same way as
 * the ledger spreadsheet: sales excluding GST, minus the supplier + shipping costs of
 * those orders, minus ad spend and other business expenses. `phrase` says which period
 * it is, e.g. "in September 2026" or "between 1 Jul 2026 and 21 Sep 2026". */
export function CostsPeriodSummary({
  summary,
  phrase,
  unassigned,
}: {
  summary: PeriodSummary;
  phrase: string;
  unassigned: number;
}) {
  const s = summary;
  return (
    <div>
      <p className="text-xs text-slate-500">
        {s.orderCount} order{s.orderCount === 1 ? "" : "s"} placed {phrase} (quotes and cancelled orders left out).
        Ad spend and other expenses are the charges dated in the same period.
      </p>

      <div className="mt-3 text-sm">
        <Row label="Sales" hint="incl. GST" value={s.salesIncGst} />
        <Row label="GST" value={s.gst} negative />
        <Row label="Sales excluding GST" value={s.salesExGst} />
        <Row label="Supplier bills + shipping for these orders" value={s.orderCosts} negative />
        <Row label="Gross profit" value={s.grossProfit} strong />
        <Row label="Facebook ad spend" value={s.adSpend} negative />
        <Row label="Other expenses" value={s.otherExpenses} negative />
        <Row label="Profit after ads and expenses" value={s.netProfit} strong />
      </div>

      {s.orderCount > 0 && (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Stat
            label="Margin (gross profit ÷ sales ex GST)"
            value={s.marginPct != null ? `${s.marginPct.toFixed(1)}%` : "—"}
          />
          <Stat
            label="Profit per order (after ads)"
            value={s.profitPerOrder != null ? fmt(s.profitPerOrder) : "—"}
          />
          <Stat
            label="Ad spend per order"
            value={s.adSpendPerOrder != null && s.adSpend > 0 ? fmt(s.adSpendPerOrder) : "—"}
          />
        </div>
      )}

      <div className="mt-3 space-y-1 text-xs text-amber-700">
        {s.ordersMissingCosts > 0 && (
          <p>
            ⚠ {s.ordersMissingCosts} of these order{s.ordersMissingCosts === 1 ? " is" : "s are"} still waiting for
            a supplier bill or a shipping cost, so the profit above is higher than it will end up.
          </p>
        )}
        {s.ordersWithoutTotal > 0 && (
          <p>
            ⚠ {s.ordersWithoutTotal} order{s.ordersWithoutTotal === 1 ? " has" : "s have"} no total amount yet, so{" "}
            {s.ordersWithoutTotal === 1 ? "it isn't" : "they aren't"} counted in sales.
          </p>
        )}
        {unassigned > 0.005 && (
          <p>⚠ {fmt(unassigned)} of supplier/shipping bills isn&rsquo;t assigned to any order yet (see bills below).</p>
        )}
      </div>
    </div>
  );
}
