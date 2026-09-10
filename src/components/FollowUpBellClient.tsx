"use client";

import Link from "next/link";
import { useState } from "react";

export interface PendingFollowUp {
  customerId: string;
  customerName: string;
  status: "scheduled_call" | "scheduled_email";
  dueDate: string;
}

export function FollowUpBellClient({ items }: { items: PendingFollowUp[] }) {
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const overdueCount = items.filter((i) => i.dueDate < today).length;

  return (
    <div className="fixed bottom-4 right-4 z-50 sm:bottom-auto sm:top-4">
      {open && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative z-50 flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white shadow-md hover:bg-slate-50"
        aria-label="Follow-up reminders"
      >
        <span aria-hidden className="text-lg">
          🔔
        </span>
        <span
          className={`absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold text-white ${
            overdueCount > 0 ? "bg-red-500" : "bg-amber-500"
          }`}
        >
          {items.length}
        </span>
      </button>

      {open && (
        <div className="absolute bottom-14 right-0 z-50 w-72 rounded-lg border border-slate-200 bg-white p-2 shadow-lg sm:bottom-auto sm:top-full sm:mt-2">
          <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Follow-ups due
          </p>
          <div className="max-h-80 overflow-y-auto">
            {items.map((item) => {
              const label = item.status === "scheduled_call" ? "Call" : "Email";
              const overdue = item.dueDate < today;
              return (
                <Link
                  key={item.customerId}
                  href={`/customers/${item.customerId}`}
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-2 py-2 text-sm hover:bg-slate-50"
                >
                  <p className="font-medium text-slate-900">
                    {item.customerName}
                  </p>
                  <p
                    className={`text-xs ${overdue ? "text-red-600" : "text-amber-700"}`}
                  >
                    {label} {overdue ? "overdue" : "due today"} —{" "}
                    {new Date(item.dueDate).toLocaleDateString()}
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
