"use client";

import { useTransition } from "react";
import { deleteExpense } from "@/app/(app)/costs/actions";
import { useToast } from "./ToastProvider";

/** Deletes one bill/charge after a confirmation. `confirmMessage` should say what's being removed. */
export function DeleteExpenseButton({
  id,
  confirmMessage,
  className = "text-xs text-slate-400 hover:text-red-600",
  children = "Delete",
}: {
  id: string;
  confirmMessage: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const [isPending, startTransition] = useTransition();
  const showToast = useToast();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (!window.confirm(confirmMessage)) return;
        startTransition(async () => {
          try {
            const result = await deleteExpense(id);
            showToast(result.ok ? "Deleted" : result.error, result.ok ? "success" : "error");
          } catch {
            showToast("Something went wrong -- try again", "error");
          }
        });
      }}
      className={`${className} disabled:opacity-50`}
    >
      {children}
    </button>
  );
}
