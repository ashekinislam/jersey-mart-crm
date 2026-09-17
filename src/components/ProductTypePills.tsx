export function ProductTypePills({ types }: { types: string[] }) {
  if (types.length === 0) return null;

  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {types.map((t) => (
        <span
          key={t}
          className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-medium text-indigo-700"
        >
          {t}
        </span>
      ))}
    </div>
  );
}
