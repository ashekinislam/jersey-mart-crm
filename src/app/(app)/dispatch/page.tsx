import { createClient } from "@/lib/supabase/server";
import type { Customer, Parcel } from "@/lib/types";
import { addParcel, deleteParcel, markParcelsDispatched } from "../actions";
import { CopyButton } from "@/components/CopyButton";

type ParcelWithCustomer = Parcel & {
  customers: Pick<Customer, "name" | "address" | "phone"> | null;
};

function buildParcelText(parcels: ParcelWithCustomer[]) {
  return parcels
    .map((p, i) => {
      const customer = p.customers;
      const lines = [`Parcel ${i + 1})`, ""];
      lines.push(`Name: ${customer?.name ?? "(unknown)"}`);
      lines.push(`Delivery address: ${customer?.address ?? "(no address on file)"}`);
      lines.push(`Contact number: ${customer?.phone ?? "(no phone on file)"}`);
      lines.push("");
      lines.push(p.contents);
      return lines.join("\n");
    })
    .join("\n\n");
}

export default async function DispatchPage() {
  const supabase = await createClient();

  const [{ data: customers }, { data: pending }, { data: dispatched }] =
    await Promise.all([
      supabase.from("customers").select("*").order("name", { ascending: true }),
      supabase
        .from("parcels")
        .select("*, customers(name, address, phone)")
        .is("dispatched_at", null)
        .order("created_at", { ascending: true }),
      supabase
        .from("parcels")
        .select("*, customers(name, address, phone)")
        .not("dispatched_at", "is", null)
        .order("dispatched_at", { ascending: false })
        .limit(50),
    ]);

  const customerList = (customers ?? []) as Customer[];
  const pendingParcels = (pending ?? []) as ParcelWithCustomer[];
  const dispatchedParcels = (dispatched ?? []) as ParcelWithCustomer[];

  const parcelText = buildParcelText(pendingParcels);

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">
        Dispatch / parcels
      </h1>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Add a parcel</h2>
        <form action={addParcel} className="mt-3 flex flex-wrap items-end gap-2">
          <div className="min-w-[10rem]">
            <label className="block text-xs font-medium text-slate-600">
              Customer
            </label>
            <select
              name="customer_id"
              required
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            >
              <option value="">Select customer...</option>
              {customerList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[16rem] flex-1">
            <label className="block text-xs font-medium text-slate-600">
              Contents
            </label>
            <input
              name="contents"
              required
              placeholder="e.g. 25 singlets and 25 shorts"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Add parcel
          </button>
        </form>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">
            Current batch ({pendingParcels.length})
          </h2>
          {pendingParcels.length > 0 && (
            <div className="flex gap-2">
              <CopyButton text={parcelText} />
              <form action={markParcelsDispatched}>
                <button
                  type="submit"
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Mark batch dispatched
                </button>
              </form>
            </div>
          )}
        </div>

        {pendingParcels.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            No parcels in the current batch.
          </p>
        ) : (
          <>
            <div className="mt-3 space-y-2">
              {pendingParcels.map((p, i) => {
                const deleteParcelWithId = deleteParcel.bind(null, p.id);
                return (
                  <div
                    key={p.id}
                    className="flex items-start justify-between gap-3 rounded-md border border-slate-100 bg-slate-50 p-3 text-sm"
                  >
                    <div>
                      <p className="font-medium text-slate-900">
                        Parcel {i + 1}) {p.customers?.name ?? "(unknown)"}
                      </p>
                      <p className="text-slate-600">{p.contents}</p>
                    </div>
                    <form action={deleteParcelWithId}>
                      <button
                        type="submit"
                        className="shrink-0 text-xs text-slate-400 hover:text-red-600"
                      >
                        Delete
                      </button>
                    </form>
                  </div>
                );
              })}
            </div>
            <pre className="mt-3 whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm text-slate-800">
              {parcelText}
            </pre>
          </>
        )}
      </section>

      {dispatchedParcels.length > 0 && (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">
            Dispatch history
          </h2>
          <div className="mt-3 space-y-2">
            {dispatchedParcels.map((p) => (
              <div
                key={p.id}
                className="rounded-md border border-slate-100 bg-slate-50 p-3 text-sm"
              >
                <p className="font-medium text-slate-900">
                  {p.customers?.name ?? "(unknown)"}
                </p>
                <p className="text-slate-600">{p.contents}</p>
                <p className="mt-1 text-xs text-slate-400">
                  Dispatched{" "}
                  {p.dispatched_at
                    ? new Date(p.dispatched_at).toLocaleString()
                    : ""}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
