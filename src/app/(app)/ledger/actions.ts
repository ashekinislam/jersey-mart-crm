"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { LOAN_ENTRY_KINDS, type LoanEntryKind } from "@/lib/types";

type Result = { ok: true } | { ok: false; error: string };

/** Blank -> null; otherwise a non-negative amount rounded to cents, or NaN if it isn't one. */
function parseAmount(raw: FormDataEntryValue | null): number | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  const n = Number(text);
  if (!Number.isFinite(n) || n < 0) return NaN;
  return Math.round(n * 100) / 100;
}

export async function addLoanEntry(formData: FormData): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const person = String(formData.get("person") ?? "").trim();
  if (!person) return { ok: false, error: "Enter who this is with." };

  const kind = String(formData.get("kind") ?? "") as LoanEntryKind;
  if (!LOAN_ENTRY_KINDS.includes(kind)) {
    return { ok: false, error: "Pick what kind of entry this is." };
  }

  const entry_date = String(formData.get("entry_date") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry_date)) {
    return { ok: false, error: "Enter a valid date." };
  }

  const aud_amount = parseAmount(formData.get("aud_amount"));
  const bdt_amount = parseAmount(formData.get("bdt_amount"));
  if (Number.isNaN(aud_amount) || Number.isNaN(bdt_amount)) {
    return { ok: false, error: "Amounts must be numbers, zero or more." };
  }
  if (aud_amount === null && bdt_amount === null) {
    return { ok: false, error: "Enter an AUD amount, a BDT amount, or both." };
  }

  const description = String(formData.get("description") ?? "").trim() || null;
  const order_id = String(formData.get("order_id") ?? "").trim() || null;

  const { error } = await supabase.from("loan_entries").insert({
    owner_id: user.id,
    person,
    kind,
    entry_date,
    aud_amount,
    bdt_amount,
    description,
    order_id,
  });
  if (error) return { ok: false, error: "Couldn't save that entry. Try again." };

  revalidatePath("/ledger");
  return { ok: true };
}

export async function deleteLoanEntry(entryId: string) {
  const supabase = await createClient();
  await supabase.from("loan_entries").delete().eq("id", entryId);
  revalidatePath("/ledger");
}
