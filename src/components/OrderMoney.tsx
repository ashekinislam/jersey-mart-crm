"use client";

import { FormEvent, KeyboardEvent, useState, useTransition } from "react";
import {
  getOrderMoney,
  type OrderMoneyFields,
} from "@/lib/orderMoney";
import { isFrameworkNavigationError, useToast } from "./ToastProvider";

function fmt(n: number) {
  return n.toLocaleString("en-AU", { style: "currency", currency: "AUD" });
}

const amountInputValue = (n: number | null) => (n == null ? "" : n.toFixed(2));

function Figure({
  label,
  value,
  className = "text-slate-900",
}: {
  label: string;
  value: number | null;
  className?: string;
}) {
  return (
    <div>
      <p className="text-[0.65rem] uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className={`text-sm font-medium tabular-nums ${className}`}>
        {value == null ? "—" : fmt(value)}
      </p>
    </div>
  );
}

const SOURCE_TITLES = {
  manual: "Includes amounts you edited in the CRM. They stay until you use the Reckon figures again.",
  reckon: "From the linked Reckon invoice (as of the last Reckon sync)",
  crm: "From the sale amount in the CRM. This order isn't linked to a Reckon invoice yet, so paid/unpaid is worked out from its payment status.",
} as const;

/** Total / paid / unpaid for an order row on the dashboard and Orders page, with
 * an inline editor. `saveAction` and `resetAction` are already bound to this order. */
export function OrderMoney({
  order,
  saveAction,
  resetAction,
}: {
  order: OrderMoneyFields;
  saveAction: (formData: FormData) => Promise<void>;
  resetAction: () => Promise<void>;
}) {
  const money = getOrderMoney(order);
  const [editing, setEditing] = useState(false);
  const [totalText, setTotalText] = useState("");
  const [paidText, setPaidText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const showToast = useToast();

  function startEditing() {
    setTotalText(amountInputValue(money.total));
    setPaidText(amountInputValue(money.paid));
    setError(null);
    setEditing(true);
  }

  function run(action: () => Promise<void>, successMessage: string) {
    startTransition(async () => {
      try {
        await action();
        showToast(successMessage);
        setEditing(false);
      } catch (err) {
        if (isFrameworkNavigationError(err)) throw err;
        showToast("Something went wrong -- try again", "error");
      }
    });
  }

  function parse(text: string): number | null | "invalid" {
    const cleaned = text.trim().replace(/^\$/, "").replace(/,/g, "");
    if (!cleaned) return null;
    const n = Number(cleaned);
    return Number.isFinite(n) && n >= 0 ? n : "invalid";
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const total = parse(totalText);
    const paid = parse(paidText);
    if (total === "invalid" || paid === "invalid") {
      setError("Enter amounts as numbers, e.g. 1250.00");
      return;
    }
    setError(null);
    // Send cleaned numbers (no "$" or thousands commas); blank stays blank.
    const formData = new FormData();
    formData.set("total", total == null ? "" : String(total));
    formData.set("paid", paid == null ? "" : String(paid));
    run(() => saveAction(formData), "Amounts saved");
  }

  if (editing) {
    const total = parse(totalText);
    const paid = parse(paidText);
    const unpaidPreview =
      typeof total === "number" && typeof paid === "number"
        ? Math.max(total - paid, 0)
        : null;

    return (
      <form
        onSubmit={onSubmit}
        onKeyDown={(e: KeyboardEvent) => {
          if (e.key === "Escape" && !isPending) setEditing(false);
        }}
        aria-busy={isPending}
        className="space-y-2 sm:w-60 sm:shrink-0"
      >
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-[0.65rem] uppercase tracking-wide text-slate-400">
            Total ($)
            <input
              autoFocus
              inputMode="decimal"
              value={totalText}
              onChange={(e) => setTotalText(e.target.value)}
              disabled={isPending}
              placeholder="0.00"
              className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1 text-sm normal-case tracking-normal text-slate-900"
            />
          </label>
          <label className="block text-[0.65rem] uppercase tracking-wide text-slate-400">
            Paid ($)
            <input
              inputMode="decimal"
              value={paidText}
              onChange={(e) => setPaidText(e.target.value)}
              disabled={isPending}
              placeholder="0.00"
              className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1 text-sm normal-case tracking-normal text-slate-900"
            />
          </label>
        </div>
        <p className="text-xs text-slate-500">
          Unpaid:{" "}
          <span className={unpaidPreview ? "font-medium text-red-600" : "font-medium text-slate-900"}>
            {unpaidPreview == null ? "—" : fmt(unpaidPreview)}
          </span>
        </p>
        {error && (
          <p role="alert" className="text-xs text-red-600">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {isPending ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => setEditing(false)}
            className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-white disabled:opacity-60"
          >
            Cancel
          </button>
          {money.source === "manual" && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(resetAction, "Back to Reckon figures")}
              className="text-xs text-slate-500 underline hover:text-slate-700 disabled:opacity-60"
            >
              Use Reckon figures
            </button>
          )}
        </div>
      </form>
    );
  }

  if (money.source == null) {
    return (
      <div className="flex items-center gap-2 text-xs sm:w-60 sm:shrink-0 sm:justify-end">
        <span className="text-slate-400">No invoice amount yet</span>
        <button
          type="button"
          onClick={startEditing}
          className="text-slate-500 underline hover:text-slate-700"
        >
          Add
        </button>
      </div>
    );
  }

  return (
    <div className="sm:w-60 sm:shrink-0">
      <div
        title={SOURCE_TITLES[money.source]}
        className="grid grid-cols-3 gap-x-4 text-left sm:text-right"
      >
        <Figure label="Total" value={money.total} />
        <Figure label="Paid" value={money.paid} className="text-emerald-700" />
        <Figure
          label="Unpaid"
          value={money.unpaid}
          className={money.unpaid ? "text-red-600" : "text-slate-900"}
        />
      </div>
      <div className="mt-0.5 flex items-center gap-2 text-xs sm:justify-end">
        {money.source === "manual" && (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[0.65rem] font-medium text-amber-800">
            Edited
          </span>
        )}
        <button
          type="button"
          onClick={startEditing}
          className="text-slate-400 underline hover:text-slate-700"
        >
          Edit amounts
        </button>
      </div>
    </div>
  );
}
