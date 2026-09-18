import { updateOrderProductTypes } from "@/app/(app)/actions";
import { PRODUCT_TYPE_OPTIONS, type Order } from "@/lib/types";
import { FormWithToast } from "@/components/FormWithToast";

export function OrderProductTypesCard({
  customerId,
  orderId,
  order,
}: {
  customerId: string;
  orderId: string;
  order: Order;
}) {
  const updateProductTypesWithIds = updateOrderProductTypes.bind(
    null,
    customerId,
    orderId
  );

  const customTypes = order.product_types.filter(
    (t) => !PRODUCT_TYPE_OPTIONS.includes(t)
  );

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">
        What&rsquo;s in this order?
      </h2>
      <FormWithToast
        action={updateProductTypesWithIds}
        successMessage="Saved"
        className="mt-3 space-y-3"
      >
        <div className="flex flex-wrap gap-3">
          {PRODUCT_TYPE_OPTIONS.map((option) => (
            <label
              key={option}
              className="flex items-center gap-1.5 text-sm text-slate-700"
            >
              <input
                type="checkbox"
                name="product_types"
                value={option}
                defaultChecked={order.product_types.includes(option)}
                className="rounded border-slate-300"
              />
              {option}
            </label>
          ))}
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">
            Other (comma separated)
          </label>
          <input
            name="product_types_other"
            defaultValue={customTypes.join(", ")}
            placeholder="e.g. Bibs, Bags"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          Save
        </button>
      </FormWithToast>
    </section>
  );
}
