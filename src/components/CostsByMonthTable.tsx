import { monthLabel, type PeriodSummary } from "@/lib/costs";

const fmt = (n: number) => n.toLocaleString("en-AU", { style: "currency", currency: "AUD" });

const cell = "px-3 py-1.5 text-right tabular-nums whitespace-nowrap";

function Money({ value }: { value: number }) {
  return <span className={value < 0 ? "text-red-600" : undefined}>{fmt(value)}</span>;
}

/** The period broken down month by month (newest first), with a totals row.
 * Only worth showing when the period covers more than one month. */
export function CostsByMonthTable({
  rows,
  total,
}: {
  rows: { month: string; summary: PeriodSummary }[];
  total: PeriodSummary;
}) {
  if (rows.length < 2) return null;

  return (
    <div className="mt-5">
      <h3 className="text-sm font-semibold text-slate-900">Month by month</h3>
      <div className="mt-2 overflow-x-auto rounded-md border border-slate-200">
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Month
              </th>
              <th scope="col" className={`${cell} font-medium`}>
                Orders
              </th>
              <th scope="col" className={`${cell} font-medium`}>
                Sales ex GST
              </th>
              <th scope="col" className={`${cell} font-medium`}>
                Order costs
              </th>
              <th scope="col" className={`${cell} font-medium`}>
                Gross profit
              </th>
              <th scope="col" className={`${cell} font-medium`}>
                Ads
              </th>
              <th scope="col" className={`${cell} font-medium`}>
                Other
              </th>
              <th scope="col" className={`${cell} font-medium`}>
                Profit after ads
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(({ month, summary: s }) => (
              <tr key={month}>
                <th scope="row" className="px-3 py-1.5 text-left font-normal text-slate-700 whitespace-nowrap">
                  {monthLabel(month)}
                </th>
                <td className={cell}>{s.orderCount}</td>
                <td className={cell}>
                  <Money value={s.salesExGst} />
                </td>
                <td className={cell}>
                  <Money value={s.orderCosts} />
                </td>
                <td className={cell}>
                  <Money value={s.grossProfit} />
                </td>
                <td className={cell}>
                  <Money value={s.adSpend} />
                </td>
                <td className={cell}>
                  <Money value={s.otherExpenses} />
                </td>
                <td className={`${cell} font-medium`}>
                  <Money value={s.netProfit} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
            <tr>
              <th scope="row" className="px-3 py-2 text-left">
                Total
              </th>
              <td className={cell}>{total.orderCount}</td>
              <td className={cell}>
                <Money value={total.salesExGst} />
              </td>
              <td className={cell}>
                <Money value={total.orderCosts} />
              </td>
              <td className={cell}>
                <Money value={total.grossProfit} />
              </td>
              <td className={cell}>
                <Money value={total.adSpend} />
              </td>
              <td className={cell}>
                <Money value={total.otherExpenses} />
              </td>
              <td className={cell}>
                <Money value={total.netProfit} />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="mt-1 text-xs text-slate-400">
        Sales and order costs sit in the month the order was placed; ads and expenses in the month they were charged.
      </p>
    </div>
  );
}
