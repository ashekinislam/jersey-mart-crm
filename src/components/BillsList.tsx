"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { setExpensePaid } from "@/app/(app)/costs/actions";
import { cents } from "@/lib/costs";
import { EXPENSE_KIND_COLORS, EXPENSE_KIND_LABELS, type ExpenseKind } from "@/lib/types";
import { BillForm, type BillInitial, type BillKind, type OrderOption } from "./BillForm";
import { DeleteExpenseButton } from "./DeleteExpenseButton";
import { useToast } from "./ToastProvider";

export interface BillRow {
  id: string;
  kind: ExpenseKind;
  expense_date: string;
  amount: number;
  payee: string | null;
  reference: string | null;
  notes: string | null;
  paid_date: string | null;
  allocations: { order_id: string; amount: number }[];
}

const fmt = (n: number) => n.toLocaleString("en-AU", { style: "currency", currency: "AUD" });
const fmtDate = (d: string) =>
  new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(`${d}T00:00:00`)
  );

function PaidControl({ bill }: { bill: BillRow }) {
  const [isPending, startTransition] = useTransition();
  const showToast = useToast();

  function set(paid: boolean) {
    startTransition(async () => {
      try {
        const result = await setExpensePaid(bill.id, paid);
        showToast(
          result.ok ? (paid ? "Marked as paid" : "Marked as not paid") : result.error,
          result.ok ? "success" : "error"
        );
      } catch {
        showToast("Something went wrong -- try again", "error");
      }
    });
  }

  if (bill.paid_date) {
    return (
      <span className="flex items-center gap-1.5 text-xs">
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800">
          Paid {fmtDate(bill.paid_date)}
        </span>
        <button
          type="button"
          disabled={isPending}
          onClick={() => set(false)}
          className="text-slate-400 underline hover:text-slate-700 disabled:opacity-50"
        >
          undo
        </button>
      </span>
    );
  }
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => set(true)}
      className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
    >
      {isPending ? "Saving…" : "Not paid – mark paid"}
    </button>
  );
}

const DEFAULT_VISIBLE_BILLS = 10;

export function BillsList({
  bills,
  orders,
  today,
  emptyText = "Nothing here yet.",
}: {
  bills: BillRow[];
  orders: OrderOption[];
  today: string;
  emptyText?: string;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const orderById = new Map(orders.map((o) => [o.id, o]));

  if (bills.length === 0) {
    return <p className="mt-3 text-sm text-slate-500">{emptyText}</p>;
  }

  const hasMore = bills.length > DEFAULT_VISIBLE_BILLS;
  const visibleBills = expanded ? bills : bills.slice(0, DEFAULT_VISIBLE_BILLS);

  return (
    <div className="mt-3 divide-y divide-slate-200">
      {visibleBills.map((bill) => {
        const assigned = cents(bill.allocations.reduce((s, a) => s + a.amount, 0));
        const unassigned = cents(bill.amount - assigned);
        const perOrder = bill.kind === "supplier" || bill.kind === "shipping";

        if (editingId === bill.id && bill.kind !== "ads") {
          const initial: BillInitial = {
            id: bill.id,
            kind: bill.kind as BillKind,
            expense_date: bill.expense_date,
            amount: bill.amount,
            payee: bill.payee ?? "",
            reference: bill.reference ?? "",
            notes: bill.notes ?? "",
            paid_date: bill.paid_date,
            allocations: bill.allocations,
          };
          return (
            <div key={bill.id} className="py-4">
              <BillForm
                orders={orders}
                today={today}
                initial={initial}
                onDone={() => setEditingId(null)}
              />
            </div>
          );
        }

        return (
          <div key={bill.id} className="space-y-1.5 py-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-slate-500">{fmtDate(bill.expense_date)}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${EXPENSE_KIND_COLORS[bill.kind]}`}
                  >
                    {EXPENSE_KIND_LABELS[bill.kind]}
                  </span>
                  <span className="font-medium text-slate-900">{bill.payee || "—"}</span>
                  {bill.reference && <span className="text-slate-500">#{bill.reference}</span>}
                </p>
                {bill.notes && <p className="text-xs text-slate-500">{bill.notes}</p>}
              </div>
              <p className="text-sm font-semibold tabular-nums text-slate-900">{fmt(bill.amount)}</p>
            </div>

            {perOrder && bill.allocations.length > 0 && (
              <ul className="flex flex-wrap gap-1.5">
                {bill.allocations.map((a) => {
                  const o = orderById.get(a.order_id);
                  return (
                    <li key={a.order_id}>
                      <Link
                        href={o?.href ?? "#"}
                        className="inline-block rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-200"
                      >
                        {o ? `${o.title} — ${o.subtitle}` : "Deleted order"} · {fmt(a.amount)}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
            {perOrder && unassigned > 0.005 && (
              <p className="text-xs text-amber-700">
                ⚠ {fmt(unassigned)} not assigned to an order yet
                {bill.allocations.length === 0 ? " — click Edit to choose the orders" : ""}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <PaidControl bill={bill} />
              {bill.kind !== "ads" && (
                <button
                  type="button"
                  onClick={() => setEditingId(bill.id)}
                  className="text-xs text-slate-500 underline hover:text-slate-800"
                >
                  Edit
                </button>
              )}
              <DeleteExpenseButton
                id={bill.id}
                confirmMessage={`Delete this ${fmt(bill.amount)} ${EXPENSE_KIND_LABELS[bill.kind].toLowerCase()}${
                  bill.payee ? ` from ${bill.payee}` : ""
                }? Any order costs from it will be removed too.`}
              />
            </div>
          </div>
        );
      })}
      {hasMore && (
        <div className="pt-3 text-center">
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="text-xs text-slate-500 underline hover:text-slate-800"
          >
            {expanded
              ? "Show fewer"
              : `Show all ${bills.length} (${bills.length - DEFAULT_VISIBLE_BILLS} more)`}
          </button>
        </div>
      )}
    </div>
  );
}
