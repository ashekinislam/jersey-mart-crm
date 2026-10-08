import { createClient } from "@/lib/supabase/server";
import { brisbaneToday } from "@/lib/costs";
import {
  LOAN_ENTRY_KINDS,
  LOAN_KIND_LABELS,
  LOAN_KIND_SIGN,
  type Customer,
  type LoanEntry,
  type Order,
} from "@/lib/types";
import { addLoanEntry, deleteLoanEntry } from "./actions";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { FormWithToast } from "@/components/FormWithToast";

const audFmt = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });
const bdtFmt = new Intl.NumberFormat("en-BD", { style: "currency", currency: "BDT" });
const dateFmt = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function balanceText(n: number, fmt: Intl.NumberFormat) {
  const rounded = Math.round(n * 100) / 100;
  if (rounded === 0) return "Settled";
  return rounded > 0
    ? `${fmt.format(rounded)} owed to you`
    : `${fmt.format(-rounded)} you owe them`;
}

export default async function LedgerPage() {
  const supabase = await createClient();

  const [{ data: entriesData }, { data: ordersData }, { data: customersData }] =
    await Promise.all([
      supabase
        .from("loan_entries")
        .select("*")
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("orders")
        .select("id, label, order_date, customer_id")
        .order("order_date", { ascending: false }),
      supabase.from("customers").select("id, name"),
    ]);

  const entries = (entriesData ?? []) as LoanEntry[];
  const orders = (ordersData ?? []) as Pick<
    Order,
    "id" | "label" | "order_date" | "customer_id"
  >[];
  const customerName = new Map(
    ((customersData ?? []) as Pick<Customer, "id" | "name">[]).map((c) => [c.id, c.name])
  );

  const orderLabels = new Map(
    orders.map((o) => [
      o.id,
      `${customerName.get(o.customer_id) ?? "Customer"} — ${o.label || o.order_date}`,
    ])
  );

  // One balance card per person; matched case-insensitively so "Dad"/"dad" don't split.
  const people = new Map<string, { name: string; aud: number; bdt: number }>();
  for (const e of [...entries].reverse()) {
    const key = e.person.trim().toLowerCase();
    const p = people.get(key) ?? { name: e.person.trim(), aud: 0, bdt: 0 };
    const sign = LOAN_KIND_SIGN[e.kind];
    p.aud += sign * (e.aud_amount ?? 0);
    p.bdt += sign * (e.bdt_amount ?? 0);
    people.set(key, p);
  }
  const personList = [...people.values()];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Ledger</h1>
          <p className="mt-1 text-sm text-slate-500">
            Money lent out, and bills or shipping paid back on your behalf —
            tracked in AUD and BDT separately.
          </p>
        </div>
        {entries.length > 0 && (
          <a
            href="/ledger/export"
            className="shrink-0 whitespace-nowrap text-sm text-slate-500 hover:text-slate-900 hover:underline"
          >
            Download CSV
          </a>
        )}
      </div>

      {personList.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {personList.map((p) => (
            <section
              key={p.name}
              className="rounded-lg border border-slate-200 bg-white p-4"
            >
              <h2 className="text-sm font-semibold text-slate-900">{p.name}</h2>
              <dl className="mt-2 space-y-1 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">AUD</dt>
                  <dd className="font-medium text-slate-900">
                    {balanceText(p.aud, audFmt)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">BDT</dt>
                  <dd className="font-medium text-slate-900">
                    {balanceText(p.bdt, bdtFmt)}
                  </dd>
                </div>
              </dl>
            </section>
          ))}
        </div>
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Add an entry</h2>
        <p className="mt-1 text-xs text-slate-500">
          AUD and BDT balances are tracked separately — put both amounts on
          each bill (where you know them) so they net off the loan properly.
        </p>
        <FormWithToast
          action={addLoanEntry}
          successMessage="Entry added"
          resetOnSuccess
          className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-6"
        >
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600">Date</label>
            <input
              type="date"
              name="entry_date"
              required
              defaultValue={brisbaneToday()}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600">Who</label>
            <input
              name="person"
              required
              list="ledger-people"
              defaultValue={personList.length === 1 ? personList[0].name : ""}
              placeholder="e.g. Dad"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
            <datalist id="ledger-people">
              {personList.map((p) => (
                <option key={p.name} value={p.name} />
              ))}
            </datalist>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600">Type</label>
            <select
              name="kind"
              defaultValue="lent"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            >
              {LOAN_ENTRY_KINDS.map((k) => (
                <option key={k} value={k}>
                  {LOAN_KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600">AUD</label>
            <input
              type="number"
              step="0.01"
              min="0"
              name="aud_amount"
              placeholder="0.00"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600">BDT</label>
            <input
              type="number"
              step="0.01"
              min="0"
              name="bdt_amount"
              placeholder="0.00"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600">
              For order (optional)
            </label>
            <select
              name="order_id"
              defaultValue=""
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            >
              <option value="">— none —</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {orderLabels.get(o.id)}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-6">
            <label className="block text-xs font-medium text-slate-600">
              Notes (optional)
            </label>
            <input
              name="description"
              placeholder="e.g. Supplier bill #123"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div className="sm:col-span-6">
            <button
              type="submit"
              className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              Add entry
            </button>
          </div>
        </FormWithToast>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white">
        {entries.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-500">
            No entries yet. Add the first one above.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Entry</th>
                  <th className="px-4 py-2 text-right">AUD</th>
                  <th className="px-4 py-2 text-right">BDT</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entries.map((e) => {
                  const sign = LOAN_KIND_SIGN[e.kind];
                  const tone = sign === 1 ? "text-slate-900" : "text-emerald-700";
                  const prefix = sign === 1 ? "" : "−";
                  const deleteWithId = deleteLoanEntry.bind(null, e.id);
                  return (
                    <tr key={e.id} className="align-top">
                      <td className="whitespace-nowrap px-4 py-2 text-slate-600">
                        {dateFmt.format(new Date(e.entry_date))}
                      </td>
                      <td className="px-4 py-2">
                        <p className="font-medium text-slate-900">
                          {e.person} · {LOAN_KIND_LABELS[e.kind]}
                        </p>
                        {e.description && (
                          <p className="text-xs text-slate-500">{e.description}</p>
                        )}
                        {e.order_id && orderLabels.has(e.order_id) && (
                          <p className="text-xs text-slate-400">
                            Order: {orderLabels.get(e.order_id)}
                          </p>
                        )}
                      </td>
                      <td className={`whitespace-nowrap px-4 py-2 text-right ${tone}`}>
                        {e.aud_amount != null
                          ? `${prefix}${audFmt.format(e.aud_amount)}`
                          : "—"}
                      </td>
                      <td className={`whitespace-nowrap px-4 py-2 text-right ${tone}`}>
                        {e.bdt_amount != null
                          ? `${prefix}${bdtFmt.format(e.bdt_amount)}`
                          : "—"}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <FormWithToast action={deleteWithId} successMessage="Entry deleted">
                          <ConfirmSubmitButton
                            confirmMessage="Delete this entry?"
                            className="text-xs text-slate-400 hover:text-red-600"
                          >
                            Delete
                          </ConfirmSubmitButton>
                        </FormWithToast>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
