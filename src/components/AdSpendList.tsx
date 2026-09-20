import type { Expense } from "@/lib/types";
import { cents } from "@/lib/costs";
import { DeleteExpenseButton } from "./DeleteExpenseButton";

const fmt = (n: number) => n.toLocaleString("en-AU", { style: "currency", currency: "AUD" });
const fmtDay = (d: string) =>
  new Intl.DateTimeFormat("en-AU", { weekday: "short", day: "numeric", month: "short" }).format(
    new Date(`${d}T00:00:00`)
  );

/** A month's Facebook ad charges grouped by day, newest first, each removable. */
export function AdSpendList({ ads, monthLabel }: { ads: Expense[]; monthLabel: string }) {
  if (ads.length === 0) {
    return <p className="mt-3 text-sm text-slate-500">No ad charges entered for {monthLabel} yet.</p>;
  }

  const byDay = new Map<string, Expense[]>();
  for (const a of ads) byDay.set(a.expense_date, [...(byDay.get(a.expense_date) ?? []), a]);
  const days = [...byDay.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  const monthTotal = cents(ads.reduce((s, a) => s + a.amount, 0));

  return (
    <div className="mt-3">
      <p className="text-sm text-slate-600">
        {monthLabel} so far: <span className="font-semibold text-slate-900">{fmt(monthTotal)}</span> across{" "}
        {ads.length} charge{ads.length === 1 ? "" : "s"}
      </p>
      <ul className="mt-2 divide-y divide-slate-100">
        {days.map(([day, charges]) => (
          <li key={day} className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-sm">
            <span className="w-28 text-slate-600">{fmtDay(day)}</span>
            <span className="flex flex-1 flex-wrap items-center gap-2">
              {charges.map((c) => (
                <span
                  key={c.id}
                  className="inline-flex items-center gap-1 rounded bg-fuchsia-50 px-2 py-0.5 text-xs text-fuchsia-900"
                >
                  {fmt(c.amount)}
                  <DeleteExpenseButton
                    id={c.id}
                    confirmMessage={`Delete this ${fmt(c.amount)} ad charge from ${fmtDay(day)}?`}
                    className="text-fuchsia-400 hover:text-red-600"
                  >
                    ×
                  </DeleteExpenseButton>
                </span>
              ))}
            </span>
            <span className="font-medium tabular-nums text-slate-900">
              {fmt(cents(charges.reduce((s, c) => s + c.amount, 0)))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
