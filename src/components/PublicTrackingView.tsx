import { PICKUP_ADDRESS, SHIPPING_STATUS_COLORS, SHIPPING_STATUS_LABELS } from "@/lib/types";
import type { PublicTrackingData } from "@/lib/tracking";

const AU_DATETIME = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Brisbane",
  dateStyle: "medium",
  timeStyle: "short",
});

/** The page a customer sees at /track/[token] -- no CRM login, no pricing or costs,
 * just this one order's shipping status. Pure presentation, so it can be previewed
 * with made-up data without touching the database. */
export function PublicTrackingView({ data }: { data: PublicTrackingData }) {
  const isPickup = data.shippingStatus === "ready_for_pickup" || data.shippingStatus === "picked_up";

  return (
    <div className="mx-auto min-h-screen max-w-md bg-slate-50 px-4 py-10">
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Jersey Mart</p>
        <h1 className="mt-1 text-lg font-semibold text-slate-900">
          Hi {data.customerName}, here&rsquo;s your order tracking
        </h1>
        {data.orderLabel && <p className="mt-1 text-sm text-slate-500">{data.orderLabel}</p>}

        <div className="mt-5">
          <p className="text-xs font-medium text-slate-500">Status</p>
          <span
            className={`mt-1 inline-block rounded-full px-3 py-1 text-sm font-medium ${SHIPPING_STATUS_COLORS[data.shippingStatus]}`}
          >
            {SHIPPING_STATUS_LABELS[data.shippingStatus]}
          </span>
        </div>

        {isPickup && (
          <p className="mt-3 text-sm text-slate-600">
            Pickup address: <span className="font-medium text-slate-900">{PICKUP_ADDRESS}</span>
          </p>
        )}

        {data.trackingNumber && (
          <div className="mt-4">
            <p className="text-xs font-medium text-slate-500">Tracking number</p>
            <p className="text-sm font-medium text-slate-900">{data.trackingNumber}</p>
          </div>
        )}

        {data.trackingUrl && (
          <a
            href={data.trackingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Track on carrier&rsquo;s website
          </a>
        )}

        <p className="mt-6 text-xs text-slate-400">
          Last updated {AU_DATETIME.format(new Date(data.updatedAt))} (AEST). This page updates whenever
          Jersey Mart updates your order -- refresh it to check again.
        </p>
      </div>
    </div>
  );
}
