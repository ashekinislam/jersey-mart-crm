"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { brisbaneToday, cents, isValidDate, type ActionResult, type ExpenseInput } from "@/lib/costs";

const KINDS = new Set(["supplier", "shipping", "ads", "other"]);

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

/** Costs feed the order rows, dashboard, order pages and monthly summary -- refresh them all. */
function refreshEverything() {
  revalidatePath("/", "layout");
}

/** Returns a cleaned-up copy of the input, or the reason it can't be saved. */
function validate(input: ExpenseInput): { ok: true; value: ExpenseInput } | { ok: false; error: string } {
  if (!KINDS.has(input.kind)) return { ok: false, error: "Pick what kind of cost this is." };
  if (!isValidDate(input.expense_date)) return { ok: false, error: "Enter a valid date." };
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { ok: false, error: "Enter the amount as a number greater than zero." };
  }
  if (input.paid_date != null && !isValidDate(input.paid_date)) {
    return { ok: false, error: "Enter a valid paid date." };
  }

  const amount = cents(input.amount);
  const perOrder = input.kind === "supplier" || input.kind === "shipping";
  const allocations = perOrder
    ? input.allocations.filter((a) => Number.isFinite(a.amount) && a.amount > 0.004)
    : [];

  if (!perOrder && input.allocations.length > 0) {
    return { ok: false, error: "Ads and other expenses aren't assigned to individual orders." };
  }
  if (new Set(allocations.map((a) => a.order_id)).size !== allocations.length) {
    return { ok: false, error: "An order is listed twice." };
  }
  const assigned = allocations.reduce((s, a) => s + a.amount, 0);
  if (assigned > amount + 0.005) {
    return {
      ok: false,
      error: `The orders add up to more than the bill (over by $${cents(assigned - amount).toFixed(2)}).`,
    };
  }

  return {
    ok: true,
    value: {
      kind: input.kind,
      expense_date: input.expense_date,
      amount,
      payee: input.payee.trim(),
      reference: input.reference.trim(),
      notes: input.notes.trim(),
      paid_date: input.paid_date,
      allocations: allocations.map((a) => ({ order_id: a.order_id, amount: cents(a.amount) })),
    },
  };
}

const expenseColumns = (v: ExpenseInput) => ({
  kind: v.kind,
  expense_date: v.expense_date,
  amount: v.amount,
  payee: v.payee || null,
  reference: v.reference || null,
  notes: v.notes || null,
  paid_date: v.paid_date,
});

export async function addExpense(input: ExpenseInput): Promise<ActionResult> {
  const checked = validate(input);
  if (!checked.ok) return checked;
  const v = checked.value;
  const { supabase, user } = await requireUser();

  const { data: expense, error } = await supabase
    .from("expenses")
    .insert({ owner_id: user.id, ...expenseColumns(v) })
    .select("id")
    .single();
  if (error || !expense) return { ok: false, error: "Couldn't save the bill -- try again." };

  if (v.allocations.length > 0) {
    const { error: allocError } = await supabase.from("expense_allocations").insert(
      v.allocations.map((a) => ({
        owner_id: user.id,
        expense_id: expense.id,
        order_id: a.order_id,
        amount: a.amount,
      }))
    );
    if (allocError) {
      // Don't leave a half-saved bill behind.
      await supabase.from("expenses").delete().eq("id", expense.id);
      return { ok: false, error: "Couldn't assign the bill to those orders -- try again." };
    }
  }

  refreshEverything();
  return { ok: true };
}

export async function updateExpense(id: string, input: ExpenseInput): Promise<ActionResult> {
  const checked = validate(input);
  if (!checked.ok) return checked;
  const v = checked.value;
  const { supabase, user } = await requireUser();

  const { error } = await supabase
    .from("expenses")
    .update({ ...expenseColumns(v), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: "Couldn't save the changes -- try again." };

  // Replace the order split. (Everything was validated above, so this only fails on a database problem.)
  const { error: deleteError } = await supabase
    .from("expense_allocations")
    .delete()
    .eq("expense_id", id);
  if (deleteError) return { ok: false, error: "Couldn't update the order split -- try again." };

  if (v.allocations.length > 0) {
    const { error: allocError } = await supabase.from("expense_allocations").insert(
      v.allocations.map((a) => ({
        owner_id: user.id,
        expense_id: id,
        order_id: a.order_id,
        amount: a.amount,
      }))
    );
    if (allocError) {
      return {
        ok: false,
        error: "The bill was saved but its order split wasn't -- open it and save again.",
      };
    }
  }

  refreshEverything();
  return { ok: true };
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) return { ok: false, error: "Couldn't delete it -- try again." };
  refreshEverything();
  return { ok: true };
}

export async function setExpensePaid(id: string, paid: boolean): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("expenses")
    .update({
      paid_date: paid ? brisbaneToday() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false, error: "Couldn't update it -- try again." };
  refreshEverything();
  return { ok: true };
}

/** One Facebook ad charge. Paid straight away (it comes off the card), no orders attached. */
export async function addAdSpend(input: {
  expense_date: string;
  amount: number;
}): Promise<ActionResult> {
  if (!isValidDate(input.expense_date)) return { ok: false, error: "Enter a valid date." };
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { ok: false, error: "Enter the amount as a number greater than zero." };
  }
  const { supabase, user } = await requireUser();

  const { error } = await supabase.from("expenses").insert({
    owner_id: user.id,
    kind: "ads",
    expense_date: input.expense_date,
    amount: cents(input.amount),
    payee: "Facebook ads",
    paid_date: input.expense_date,
  });
  if (error) return { ok: false, error: "Couldn't save it -- try again." };

  refreshEverything();
  return { ok: true };
}
