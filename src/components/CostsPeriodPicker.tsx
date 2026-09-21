import Link from "next/link";
import type { PeriodKind } from "@/lib/costs";

const tabClass = (active: boolean) =>
  `rounded-full border px-3 py-1 text-xs font-medium ${
    active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-600 hover:bg-white"
  }`;

const inputClass = "rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-900";

/** Chooses what the profit summary covers: one month, all time, or a custom date range
 * (with a few quick ranges). Plain links and GET forms, so it needs no JavaScript. */
export function CostsPeriodPicker({
  kind,
  month,
  from,
  to,
  presets,
  hrefFor,
  carry,
}: {
  kind: PeriodKind;
  month: string;
  from: string;
  to: string;
  presets: { label: string; from: string; to: string }[];
  /** Builds the link for a given choice (keeps the rest of the page's state). */
  hrefFor: (choice: { period: PeriodKind; from?: string; to?: string }) => string;
  /** Other query values the forms must keep, e.g. the bills tab. */
  carry: Record<string, string>;
}) {
  const carried = Object.entries(carry).map(([name, value]) => (
    <input key={name} type="hidden" name={name} value={value} />
  ));

  return (
    <div className="space-y-3">
      <nav aria-label="Profit period" className="flex flex-wrap gap-2">
        <Link
          href={hrefFor({ period: "month" })}
          aria-current={kind === "month" ? "page" : undefined}
          className={tabClass(kind === "month")}
        >
          Month
        </Link>
        <Link
          href={hrefFor({ period: "all" })}
          aria-current={kind === "all" ? "page" : undefined}
          className={tabClass(kind === "all")}
        >
          All time
        </Link>
        <Link
          href={hrefFor({ period: "custom" })}
          aria-current={kind === "custom" ? "page" : undefined}
          className={tabClass(kind === "custom")}
        >
          Custom dates
        </Link>
      </nav>

      {kind === "month" && (
        <form method="get" className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-slate-600" htmlFor="profit-month">
            Month
          </label>
          <input id="profit-month" type="month" name="month" defaultValue={month} className={inputClass} />
          <input type="hidden" name="period" value="month" />
          {carried}
          <button
            type="submit"
            className="rounded-md border border-slate-300 px-2.5 py-1 text-sm text-slate-700 hover:bg-slate-50"
          >
            Show
          </button>
        </form>
      )}

      {kind === "custom" && (
        <div className="space-y-2">
          <form method="get" className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-slate-600" htmlFor="profit-from">
              From
            </label>
            <input id="profit-from" type="date" name="from" defaultValue={from} required className={inputClass} />
            <label className="text-xs text-slate-600" htmlFor="profit-to">
              to
            </label>
            <input id="profit-to" type="date" name="to" defaultValue={to} required className={inputClass} />
            <input type="hidden" name="period" value="custom" />
            <input type="hidden" name="month" value={month} />
            {carried}
            <button
              type="submit"
              className="rounded-md border border-slate-300 px-2.5 py-1 text-sm text-slate-700 hover:bg-slate-50"
            >
              Show
            </button>
          </form>
          <p className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            Quick ranges:
            {presets.map((p) => (
              <Link
                key={p.label}
                href={hrefFor({ period: "custom", from: p.from, to: p.to })}
                className="rounded-full border border-slate-300 px-2.5 py-0.5 text-slate-600 hover:bg-white"
              >
                {p.label}
              </Link>
            ))}
          </p>
        </div>
      )}
    </div>
  );
}
