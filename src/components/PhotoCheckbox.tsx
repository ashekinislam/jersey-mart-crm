export interface DesignOption {
  id: string;
  url: string | null;
  caption: string;
}

export function PhotoCheckbox({
  option,
  checked,
  onToggle,
}: {
  option: DesignOption;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label className={`relative block cursor-pointer rounded-md border-2 ${checked ? "border-slate-900" : "border-transparent"}`}>
      <input type="checkbox" checked={checked} onChange={onToggle} className="peer sr-only" />
      {option.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={option.url} alt={option.caption} className="aspect-square w-full rounded object-cover" />
      ) : (
        <div className="flex aspect-square items-center justify-center rounded bg-slate-100 text-xs text-slate-400">No preview</div>
      )}
      {checked && (
        <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-xs text-white">
          ✓
        </span>
      )}
      <span className="mt-1 block truncate text-[11px] text-slate-500">{option.caption}</span>
    </label>
  );
}
