export function BreakdownCard({
  title,
  items,
}: {
  title: string;
  items: { label: string; count: number }[];
}) {
  const total = items.reduce((sum, i) => sum + i.count, 0);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      <div className="mt-3 space-y-2">
        {total === 0 ? (
          <p className="text-sm text-slate-500">No data yet.</p>
        ) : (
          items
            .filter((item) => item.count > 0)
            .sort((a, b) => b.count - a.count)
            .map((item) => (
              <div key={item.label}>
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>{item.label}</span>
                  <span className="font-medium text-slate-900">
                    {item.count}
                  </span>
                </div>
                <div className="mt-0.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-slate-900"
                    style={{ width: `${(item.count / total) * 100}%` }}
                  />
                </div>
              </div>
            ))
        )}
      </div>
    </div>
  );
}

export function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: "red" | "amber" | "default";
}) {
  const valueClass =
    accent === "red"
      ? "text-red-600"
      : accent === "amber"
        ? "text-amber-600"
        : "text-slate-900";

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}
