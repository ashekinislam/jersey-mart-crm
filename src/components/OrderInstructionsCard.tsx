import { updateOrderInstructions } from "@/app/(app)/actions";
import type { Order } from "@/lib/types";

export function OrderInstructionsCard({
  customerId,
  orderId,
  order,
}: {
  customerId: string;
  orderId: string;
  order: Order;
}) {
  const updateInstructionsWithIds = updateOrderInstructions.bind(
    null,
    customerId,
    orderId
  );

  const hasInstructions = !!order.special_instructions;

  return (
    <section
      className={`rounded-lg border p-4 ${
        hasInstructions
          ? "border-amber-300 bg-amber-50"
          : "border-slate-200 bg-white"
      }`}
    >
      <h2
        className={`text-sm font-semibold ${hasInstructions ? "text-amber-900" : "text-slate-900"}`}
      >
        ⚠ Special instructions
      </h2>
      <p
        className={`mt-1 text-xs ${hasInstructions ? "text-amber-800" : "text-slate-500"}`}
      >
        Production constraints to keep an eye on — e.g. no name/number, no
        pockets on shorts.
      </p>

      <form action={updateInstructionsWithIds} className="mt-3 space-y-2">
        <textarea
          name="special_instructions"
          rows={hasInstructions ? 3 : 2}
          defaultValue={order.special_instructions ?? ""}
          placeholder="e.g. Customer doesn't want jersey name/number. No pockets on shorts."
          className={`w-full rounded-md border px-3 py-1.5 text-sm ${
            hasInstructions
              ? "border-amber-300 bg-white"
              : "border-slate-300"
          }`}
        />
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          Save
        </button>
      </form>
    </section>
  );
}
