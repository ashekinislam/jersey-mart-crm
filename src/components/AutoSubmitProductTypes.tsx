"use client";

import { useState, useTransition } from "react";

export function AutoSubmitProductTypes({
  options,
  defaultValues,
  customTypes,
  action,
}: {
  options: string[];
  defaultValues: string[];
  /** Any values not in `options` (e.g. typed into "Other" on the order's own
   * page) -- preserved on every toggle so this quick-select never wipes them. */
  customTypes: string[];
  action: (formData: FormData) => Promise<void>;
}) {
  const [selected, setSelected] = useState(new Set(defaultValues));
  const [isPending, startTransition] = useTransition();

  function toggle(option: string) {
    const next = new Set(selected);
    if (next.has(option)) next.delete(option);
    else next.add(option);
    setSelected(next);

    const formData = new FormData();
    for (const value of next) formData.append("product_types", value);
    formData.set("product_types_other", customTypes.join(", "));
    startTransition(() => {
      action(formData);
    });
  }

  return (
    <div className={`flex flex-wrap gap-1 ${isPending ? "opacity-60" : ""}`}>
      {options.map((option) => {
        const isSelected = selected.has(option);
        return (
          <button
            key={option}
            type="button"
            disabled={isPending}
            onClick={() => toggle(option)}
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
              isSelected
                ? "bg-indigo-100 text-indigo-700"
                : "border border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600"
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
