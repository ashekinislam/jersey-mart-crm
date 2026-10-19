import { createClient } from "@/lib/supabase/server";
import { brisbaneToday } from "@/lib/costs";
import {
  LOAN_KIND_GROUPS,
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

  // Overall position per currency: what others owe the business vs what the business owes
  // others. Netted per person first, so lending and borrowing with the same person cancel.
  const position = { aud: { owedToYou: 0, youOwe: 0 }, bdt: { owedToYou: 0, youOwe: 0 } };
  for (const p of personList) {
    for (const cur of ["aud", "bdt"] as const) {
      const v = Math.round(p[cur] * 100) / 100;
      if (v > 0) position[cur].owedToYou += v;
      else if (v < 0) position[cur].youOwe += -v;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Ledger</h1>
          <p className="mt-1 text-sm text-slate-500">
            Money you lend out or borrow, and bills or shipping paid on your
            behalf — tracked in AUD and BDT separately.
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
          <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <h2 className="text-sm font-semibold text-emerald-900">Owed to you</h2>
            <p className="mt-0.5 text-xs text-emerald-800/70">Money you lent that hasn&apos;t come back yet</p>
            <dl className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-emerald-800/70">AUD</dt>
                <dd className="font-semibold text-emerald-900">{audFmt.format(position.aud.owedToYou)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-emerald-800/70">BDT</dt>
                <dd className="font-semibold text-emerald-900">{bdtFmt.format(position.bdt.owedToYou)}</dd>
              </div>
            </dl>
          </section>
          <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <h2 className="text-sm font-semibold text-amber-900">You owe</h2>
            <p className="mt-0.5 text-xs text-amber-800/70">Money you borrowed that you haven&apos;t paid back yet</p>
            <dl className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-amber-800/70">AUD</dt>
                <dd className="font-semibold text-amber-900">{audFmt.format(position.aud.youOwe)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-amber-800/70">BDT</dt>
                <dd className="font-semibold text-amber-900">{bdtFmt.format(position.bdt.youOwe)}</dd>
              </div>
            </dl>
          </section>
        </div>
      )}

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
          Lending to a supplier or anyone else? Choose &ldquo;Lent to them&rdquo;. Borrowed
          from someone? Choose &ldquo;Borrowed from them&rdquo;, then &ldquo;I paid them back&rdquo; as
          you repay. AUD and BDT are tracked separately — put both amounts on
          each entry where you know them.
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
              placeholder="e.g. Dad, or a supplier's name"
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
              {LOAN_KIND_GROUPS.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.kinds.map((k) => (
                    <option key={k} value={k}>
                      {LOAN_KIND_LABELS[k]}
                    </option>
                  ))}
                </optgroup>
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
        {entries.length > 0 && (
          <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-400">
            Plain amounts mean they owe you more (or you owe them less); green amounts with a minus mean they owe
            you less (or you owe them more).
          </p>
        )}
      </section>
    </div>
  );
}
