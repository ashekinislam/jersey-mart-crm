import { createClient } from "@/lib/supabase/server";
import { LOAN_KIND_LABELS, LOAN_KIND_SIGN, type LoanEntry } from "@/lib/types";

function csvCell(value: string | number | null): string {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Amounts are signed (lent = +, anything paid back = -) so SUM() in a spreadsheet is the balance. */
export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("loan_entries")
    .select("*")
    .order("entry_date", { ascending: true })
    .order("created_at", { ascending: true });

  const rows = ((data ?? []) as LoanEntry[]).map((e) => {
    const sign = LOAN_KIND_SIGN[e.kind];
    return [
      e.entry_date,
      e.person,
      LOAN_KIND_LABELS[e.kind],
      e.description,
      e.aud_amount == null ? null : sign * e.aud_amount,
      e.bdt_amount == null ? null : sign * e.bdt_amount,
    ];
  });

  const csv = [["Date", "Person", "Type", "Notes", "AUD", "BDT"], ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="ledger.csv"',
    },
  });
}
