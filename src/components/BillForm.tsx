"use client";

import { FormEvent, useState, useTransition } from "react";
import { addExpense, updateExpense } from "@/app/(app)/costs/actions";
import { cents, splitByWeights, type ExpenseInput } from "@/lib/costs";
import { EXPENSE_KIND_LABELS, type ExpenseKind } from "@/lib/types";
import { useToast } from "./ToastProvider";

export type BillKind = Exclude<ExpenseKind, "ads">;
const BILL_KINDS: BillKind[] = ["supplier", "shipping", "other"];

export interface OrderOption {
  id: string;
  /** Customer name */
  title: string;
  /** Order label / date */
  subtitle: string;
  href: string;
  /** Number of players/jerseys on the order (for "split by jerseys"). */
  players: number;
  /** Order total incl. GST, if known (for "split by order value"). */
  value: number | null;
  /** True when this order has no supplier bill entered yet (false for quotes/cancelled orders, which aren't expected to have one). */
  missingSupplier: boolean;
  /** Same, for shipping. */
  missingShipping: boolean;
}

export interface BillInitial {
  id: string;
  kind: BillKind;
  expense_date: string;
  amount: number;
  payee: string;
  reference: string;
  notes: string;
  paid_date: string | null;
  allocations: { order_id: string; amount: number }[];
}

type SplitMode = "jerseys" | "value" | "even" | "manual";

const SPLIT_LABELS: Record<Exclude<SplitMode, "manual">, string> = {
  jerseys: "By number of jerseys",
  value: "By order value",
  even: "Evenly",
};

const fmt = (n: number) => n.toLocaleString("en-AU", { style: "currency", currency: "AUD" });

function parseMoney(text: string): number | null | "invalid" {
  const cleaned = text.trim().replace(/^\$/, "").replace(/,/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : "invalid";
}

const inputClass =
  "mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-900";
const labelClass = "block text-xs font-medium text-slate-600";

/** Add (or edit) a supplier bill, shipping invoice or other expense. For supplier
 * bills and shipping invoices you tick the orders it covers and the amount is split
 * between them -- always adding up to the bill exactly, with any remainder shown as
 * "not assigned yet" so it can be sorted out later. */
export function BillForm({
  orders,
  today,
  initial,
  defaultOrderId,
  defaultKind,
  onDone,
}: {
  orders: OrderOption[];
  today: string;
  initial?: BillInitial;
  defaultOrderId?: string;
  /** Which type a new bill starts as; follows the Costs page tab. */
  defaultKind?: BillKind;
  onDone?: () => void;
}) {
  const [kind, setKind] = useState<BillKind>(initial?.kind ?? defaultKind ?? "supplier");
  const [date, setDate] = useState(initial?.expense_date ?? today);
  const [payee, setPayee] = useState(initial?.payee ?? "");
  const [reference, setReference] = useState(initial?.reference ?? "");
  const [amountText, setAmountText] = useState(initial ? initial.amount.toFixed(2) : "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [paid, setPaid] = useState(initial ? initial.paid_date != null : defaultKind === "other");
  const [paidDate, setPaidDate] = useState(initial?.paid_date ?? today);
  const [selected, setSelected] = useState<string[]>(
    initial?.allocations.map((a) => a.order_id) ?? (defaultOrderId ? [defaultOrderId] : [])
  );
  const [mode, setMode] = useState<SplitMode>(initial ? "manual" : "jerseys");
  const [manual, setManual] = useState<Record<string, string>>(
    initial ? Object.fromEntries(initial.allocations.map((a) => [a.order_id, a.amount.toFixed(2)])) : {}
  );
  const [search, setSearch] = useState("");
  const [filterMissingSupplier, setFilterMissingSupplier] = useState(false);
  const [filterMissingShipping, setFilterMissingShipping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [paidTouched, setPaidTouched] = useState(false);
  // Switching tabs on the Costs page switches this form's type too (anything already typed is kept).
  const [seenDefaultKind, setSeenDefaultKind] = useState(defaultKind);
  if (!initial && defaultKind && defaultKind !== seenDefaultKind) {
    setSeenDefaultKind(defaultKind);
    changeKind(defaultKind);
  }
  const showToast = useToast();

  const total = parseMoney(amountText);
  const totalNumber = typeof total === "number" ? total : 0;
  const perOrder = kind !== "other";
  const chosen = orders.filter((o) => selected.includes(o.id));

  // The amount each ticked order gets: worked out automatically from the mode, or typed by hand.
  const amounts: Record<string, number> = {};
  if (mode === "manual") {
    for (const o of chosen) {
      const n = parseMoney(manual[o.id] ?? "");
      amounts[o.id] = typeof n === "number" ? n : 0;
    }
  } else {
    const weights = chosen.map((o) =>
      mode === "jerseys" ? o.players : mode === "value" ? (o.value ?? 0) : 1
    );
    splitByWeights(totalNumber, weights).forEach((part, i) => {
      amounts[chosen[i].id] = part;
    });
  }
  const assigned = cents(chosen.reduce((s, o) => s + amounts[o.id], 0));
  const left = cents(totalNumber - assigned);

  // Missing-bill filters work independently of which kind of bill is being added right
  // now, so "no shipping yet" can be checked while adding a supplier bill and vice versa.
  const missingSupplierCount = orders.filter((o) => o.missingSupplier).length;
  const missingShippingCount = orders.filter((o) => o.missingShipping).length;
  const anyMissingFilterActive = filterMissingSupplier || filterMissingShipping;
  const matchesMissingFilter = (o: OrderOption) =>
    (filterMissingSupplier && o.missingSupplier) || (filterMissingShipping && o.missingShipping);
  const isMissingAnything = (o: OrderOption) => o.missingSupplier || o.missingShipping;

  const visibleOrders = orders
    .filter((o) => `${o.title} ${o.subtitle}`.toLowerCase().includes(search.trim().toLowerCase()))
    .filter((o) => !anyMissingFilterActive || matchesMissingFilter(o))
    // Orders missing a bill float to the top so they're the first thing seen, without hiding the rest.
    .sort((a, b) => Number(isMissingAnything(b)) - Number(isMissingAnything(a)));

  function changeKind(next: BillKind) {
    setKind(next);
    // Overheads (printer, software...) are normally paid on the spot; supplier and
    // shipping bills usually aren't -- unless the owner has already chosen.
    if (!paidTouched) setPaid(next === "other");
  }

  function toggleOrder(id: string) {
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  function typeAmount(orderId: string, text: string) {
    // Editing a figure by hand switches to manual mode, keeping the other figures as they were.
    const base = Object.fromEntries(chosen.map((o) => [o.id, amounts[o.id].toFixed(2)]));
    setManual({ ...base, [orderId]: text });
    setMode("manual");
  }

  function reset() {
    setPayee("");
    setReference("");
    setAmountText("");
    setNotes("");
    setSelected([]);
    setManual({});
    setMode("jerseys");
    setPaid(kind === "other");
    setPaidTouched(false);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (isPending) return;
    if (typeof total !== "number" || total <= 0) {
      setError("Enter the bill's total amount, e.g. 480.00");
      return;
    }
    if (perOrder && left < -0.005) {
      setError(`The orders add up to more than the bill (over by ${fmt(-left)}).`);
      return;
    }
    setError(null);

    const input: ExpenseInput = {
      kind,
      expense_date: date,
      amount: total,
      payee,
      reference,
      notes,
      paid_date: paid ? paidDate : null,
      allocations: perOrder
        ? chosen
            .filter((o) => amounts[o.id] > 0.004)
            .map((o) => ({ order_id: o.id, amount: amounts[o.id] }))
        : [],
    };

    startTransition(async () => {
      try {
        const result = initial ? await updateExpense(initial.id, input) : await addExpense(input);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        showToast(initial ? "Bill updated" : `Saved ${fmt(total)} ${EXPENSE_KIND_LABELS[kind].toLowerCase()}`);
        if (initial) onDone?.();
        else reset();
      } catch {
        showToast("Something went wrong -- try again", "error");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} aria-busy={isPending} className="space-y-4">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Kind of cost">
        {BILL_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            onClick={() => changeKind(k)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              kind === k
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-300 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {EXPENSE_KIND_LABELS[k]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className={labelClass}>
          Total on the bill ($)
          <input
            inputMode="decimal"
            value={amountText}
            onChange={(e) => setAmountText(e.target.value)}
            placeholder="0.00"
            disabled={isPending}
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          Bill date
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            disabled={isPending}
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          {kind === "supplier" ? "Supplier" : kind === "shipping" ? "Shipping company" : "What was it for"}
          <input
            value={payee}
            onChange={(e) => setPayee(e.target.value)}
            placeholder={kind === "supplier" ? "e.g. the factory" : kind === "shipping" ? "e.g. BDEX" : "e.g. Printer – Officeworks"}
            disabled={isPending}
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          Their invoice number (optional)
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            disabled={isPending}
            className={inputClass}
          />
        </label>
      </div>

      {perOrder && (
        <div className="space-y-3 rounded-md border border-slate-200 p-3">
          <div>
            <p className="text-xs font-medium text-slate-700">
              Which order{kind === "supplier" ? "s does this bill cover" : " is this for"}?
            </p>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer or order…"
              aria-label="Search orders"
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
            {(missingSupplierCount > 0 || missingShippingCount > 0) && (
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-amber-800">
                {missingSupplierCount > 0 && (
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={filterMissingSupplier}
                      onChange={(e) => setFilterMissingSupplier(e.target.checked)}
                    />
                    Only show orders with no supplier bill yet ({missingSupplierCount})
                  </label>
                )}
                {missingShippingCount > 0 && (
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={filterMissingShipping}
                      onChange={(e) => setFilterMissingShipping(e.target.checked)}
                    />
                    Only show orders with no shipping yet ({missingShippingCount})
                  </label>
                )}
              </div>
            )}
            <div className="mt-2 max-h-48 overflow-y-auto rounded-md border border-slate-200">
              {visibleOrders.length === 0 ? (
                <p className="p-3 text-xs text-slate-500">
                  {anyMissingFilterActive ? "None -- every order has one." : "No matching orders."}
                </p>
              ) : (
                visibleOrders.map((o) => (
                  <label
                    key={o.id}
                    className="flex cursor-pointer items-center gap-2 border-b border-slate-100 px-3 py-1.5 text-sm last:border-b-0 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(o.id)}
                      onChange={() => toggleOrder(o.id)}
                      disabled={isPending}
                    />
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-medium text-slate-900">{o.title}</span>{" "}
                      <span className="text-slate-500">{o.subtitle}</span>
                    </span>
                    {o.missingSupplier && (
                      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                        No supplier bill yet
                      </span>
                    )}
                    {o.missingShipping && (
                      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                        No shipping yet
                      </span>
                    )}
                    <span className="shrink-0 text-xs text-slate-400">
                      {o.players} {o.players === 1 ? "jersey" : "jerseys"}
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>

          {chosen.length > 0 && (
            <div className="space-y-2">
              {chosen.length > 1 && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-slate-500">Split the bill:</span>
                  {(Object.keys(SPLIT_LABELS) as Exclude<SplitMode, "manual">[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMode(m)}
                      aria-pressed={mode === m}
                      className={`rounded-full border px-2.5 py-0.5 ${
                        mode === m
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-300 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {SPLIT_LABELS[m]}
                    </button>
                  ))}
                  {mode === "manual" && <span className="text-slate-500">(amounts typed by hand)</span>}
                </div>
              )}
              <ul className="space-y-1">
                {chosen.map((o) => (
                  <li key={o.id} className="flex items-center gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate text-slate-700">
                      {o.title} <span className="text-slate-400">{o.subtitle}</span>
                    </span>
                    <label className="flex items-center gap-1 text-xs text-slate-500">
                      <span className="sr-only">Amount for {o.title}</span>$
                      <input
                        inputMode="decimal"
                        value={mode === "manual" ? (manual[o.id] ?? "") : amounts[o.id].toFixed(2)}
                        onChange={(e) => typeAmount(o.id, e.target.value)}
                        disabled={isPending}
                        className="w-24 rounded-md border border-slate-300 px-2 py-1 text-right text-sm tabular-nums text-slate-900"
                      />
                    </label>
                  </li>
                ))}
              </ul>
              <p
                className={`text-xs ${
                  left < -0.005 ? "font-medium text-red-600" : left > 0.005 ? "text-amber-700" : "text-emerald-700"
                }`}
                aria-live="polite"
              >
                {left < -0.005
                  ? `Over by ${fmt(-left)} -- the orders add up to more than the bill`
                  : left > 0.005
                    ? `${fmt(left)} not assigned to an order yet (you can assign it later)`
                    : totalNumber > 0
                      ? "✓ Fully assigned"
                      : ""}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={paid}
            onChange={(e) => {
              setPaidTouched(true);
              setPaid(e.target.checked);
            }}
            disabled={isPending}
          />
          Already paid
        </label>
        {paid && (
          <label className="flex items-center gap-2 text-xs text-slate-600">
            Paid on
            <input
              type="date"
              value={paidDate}
              onChange={(e) => setPaidDate(e.target.value)}
              disabled={isPending}
              className="rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-900"
            />
          </label>
        )}
      </div>

      <label className={labelClass}>
        Notes (optional)
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={isPending}
          className={inputClass}
        />
      </label>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {isPending ? "Saving…" : initial ? "Save changes" : "Save bill"}
        </button>
        {initial && (
          <button
            type="button"
            onClick={onDone}
            disabled={isPending}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
