"use client";

import { FormEvent, useRef, useState, useTransition } from "react";
import { addAdSpend } from "@/app/(app)/costs/actions";
import { useToast } from "./ToastProvider";

const AU_DAY = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short" });

const fmt = (n: number) => n.toLocaleString("en-AU", { style: "currency", currency: "AUD" });

/** One-box entry for a Facebook ad charge, built for adding a couple a day:
 * type the amount, press Enter, and the box clears and refocuses for the next one.
 * The date stays put (defaults to today) so back-dated entries are quick too. */
export function AdSpendQuickAdd({ today }: { today: string }) {
  const [date, setDate] = useState(today);
  const [amountText, setAmountText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const amountRef = useRef<HTMLInputElement>(null);
  const showToast = useToast();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (isPending) return;
    const cleaned = amountText.trim().replace(/^\$/, "").replace(/,/g, "");
    const amount = Number(cleaned);
    if (!cleaned || !Number.isFinite(amount) || amount <= 0) {
      setError("Enter the charge amount, e.g. 16.50");
      amountRef.current?.focus();
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const result = await addAdSpend({ expense_date: date, amount });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        showToast(`Added ${fmt(amount)} ad spend for ${AU_DAY.format(new Date(`${date}T00:00:00`))}`);
        setAmountText("");
        amountRef.current?.focus();
      } catch {
        showToast("Something went wrong -- try again", "error");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-2">
      <label className="block text-xs font-medium text-slate-600">
        Amount ($)
        <input
          ref={amountRef}
          inputMode="decimal"
          value={amountText}
          onChange={(e) => setAmountText(e.target.value)}
          disabled={isPending}
          placeholder="0.00"
          autoComplete="off"
          className="mt-1 block w-32 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-900"
        />
      </label>
      <label className="block text-xs font-medium text-slate-600">
        Date
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          disabled={isPending}
          required
          className="mt-1 block rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-900"
        />
      </label>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
      >
        {isPending ? "Adding…" : "Add ad charge"}
      </button>
      {error && (
        <p role="alert" className="w-full text-xs text-red-600">
          {error}
        </p>
      )}
    </form>
  );
}
