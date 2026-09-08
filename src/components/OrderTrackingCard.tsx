import {
  ORDER_TRACKING_STATUSES,
  ORDER_TRACKING_LABELS,
  PAYMENT_STATUSES,
  PAYMENT_STATUS_LABELS,
  PICKUP_ADDRESS,
  SHIPPING_STATUSES,
  SHIPPING_STATUS_LABELS,
  type Order,
} from "@/lib/types";
import {
  deleteInvoice,
  updateOrderTracking,
  uploadInvoice,
} from "@/app/(app)/actions";
import { FILE_INPUT_CLASS } from "@/lib/ui";

export function OrderTrackingCard({
  customerId,
  orderId,
  order,
  invoiceUrl,
}: {
  customerId: string;
  orderId: string;
  order: Order;
  invoiceUrl: string | null;
}) {
  const updateOrderTrackingWithIds = updateOrderTracking.bind(
    null,
    customerId,
    orderId
  );
  const uploadInvoiceWithIds = uploadInvoice.bind(null, customerId, orderId);
  const deleteInvoiceWithIds = deleteInvoice.bind(null, customerId, orderId);
  const formId = `order-tracking-form-${orderId}`;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">
          Order tracking
        </h2>
        <button
          type="submit"
          form={formId}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          Save
        </button>
      </div>

      <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2">
        <label className="block text-xs font-semibold uppercase tracking-wide text-red-700">
          Deadline
        </label>
        <input
          form={formId}
          type="date"
          name="deadline"
          defaultValue={order.deadline ?? ""}
          className="mt-1 rounded-md border border-red-300 bg-white px-2 py-1 text-lg font-bold text-red-700"
        />
      </div>

      <form
        id={formId}
        action={updateOrderTrackingWithIds}
        className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2"
      >
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-slate-600">
            Order label
          </label>
          <input
            name="label"
            defaultValue={order.label ?? ""}
            placeholder="e.g. Spring 2026 kit run"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">
            Order date
          </label>
          <input
            type="date"
            name="order_date"
            defaultValue={order.order_date}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">
            Order status
          </label>
          <select
            name="order_status"
            defaultValue={order.order_status}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          >
            {ORDER_TRACKING_STATUSES.map((s) => (
              <option key={s} value={s}>
                {ORDER_TRACKING_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">
            Payment status
          </label>
          <select
            name="payment_status"
            defaultValue={order.payment_status}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          >
            {PAYMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {PAYMENT_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">
            Payment due date
          </label>
          <input
            type="date"
            name="payment_due_date"
            defaultValue={order.payment_due_date ?? ""}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">
            Shipping status
          </label>
          <select
            name="shipping_status"
            defaultValue={order.shipping_status}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          >
            {SHIPPING_STATUSES.map((s) => (
              <option key={s} value={s}>
                {SHIPPING_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">
            Tracking URL
          </label>
          <input
            name="tracking_url"
            type="url"
            defaultValue={order.tracking_url ?? ""}
            placeholder="e.g. https://bdex.com.bd/track/..."
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">
            Tracking number
          </label>
          <input
            name="tracking_number"
            defaultValue={order.tracking_number ?? ""}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
        <p className="sm:col-span-2 text-xs text-slate-500">
          Pickup address (when the customer collects instead of shipping):{" "}
          {PICKUP_ADDRESS}
        </p>
        <div className="sm:col-span-2">
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Save
          </button>
        </div>
      </form>

      <div className="mt-4 border-t border-slate-100 pt-4">
        <label className="block text-xs font-medium text-slate-600">
          Invoice (Reckon PDF)
        </label>
        <form
          action={uploadInvoiceWithIds}
          className="mt-1 flex flex-wrap items-center gap-2"
        >
          <input
            type="file"
            name="file"
            accept=".pdf,image/*"
            required
            className={FILE_INPUT_CLASS}
          />
          <button
            type="submit"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Upload
          </button>
        </form>
        {invoiceUrl && (
          <div className="mt-2 flex items-center gap-3 text-sm">
            <a
              href={invoiceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-slate-900 underline"
            >
              View current invoice
            </a>
            <form action={deleteInvoiceWithIds}>
              <button
                type="submit"
                className="text-xs text-slate-400 hover:text-red-600"
              >
                Delete
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
