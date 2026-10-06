import Image from "next/image";
import { PICKUP_ADDRESS, SHIPPING_STATUS_COLORS, SHIPPING_STATUS_LABELS } from "@/lib/types";
import { formatDeliveryWindow, type PublicTrackingData } from "@/lib/tracking";
import { FACEBOOK_REVIEW_URL, GOOGLE_REVIEW_URL } from "@/lib/reviewLinks";

const AU_DATETIME = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Brisbane",
  dateStyle: "medium",
  timeStyle: "short",
});

/** The page a customer sees at /track/[token] -- no CRM login, no pricing or costs,
 * just this one order's shipping status, plus a friendly nudge to leave a review.
 * Pure presentation, so it can be previewed with made-up data without touching the database. */
export function PublicTrackingView({ data }: { data: PublicTrackingData }) {
  const isPickup = data.shippingStatus === "ready_for_pickup" || data.shippingStatus === "picked_up";
  // An estimate is only useful while the order is still on its way.
  const isFinished = isPickup || data.shippingStatus === "delivered";
  const deliveryWindow = isFinished ? null : formatDeliveryWindow(data.expectedDeliveryFrom, data.expectedDeliveryTo);

  return (
    <div className="mx-auto min-h-screen max-w-md bg-slate-50 px-4 py-10">
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex justify-center bg-[#072D20] px-6 py-3">
          <Image src="/jersey-mart-logo.png" alt="Jersey Mart Australia" width={190} height={180} priority />
        </div>

        <div className="p-6">
          <h1 className="text-lg font-semibold text-slate-900">
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

          {deliveryWindow && (
            <div className="mt-4">
              <p className="text-xs font-medium text-slate-500">Estimated delivery</p>
              <p className="text-sm font-semibold text-slate-900">{deliveryWindow}</p>
              <p className="mt-0.5 text-xs text-slate-400">
                This is an estimate and can shift a little with shipping — we&rsquo;ll keep this page up to date.
              </p>
            </div>
          )}

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
              className="mt-4 inline-block rounded-md bg-[#072D20] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#0c4030]"
            >
              Track on carrier&rsquo;s website
            </a>
          )}

          <p className="mt-6 text-xs text-slate-400">
            Last updated {AU_DATETIME.format(new Date(data.updatedAt))} (AEST). This page updates whenever
            Jersey Mart updates your order -- refresh it to check again.
          </p>
        </div>

        <div className="border-t border-amber-100 bg-amber-50 px-6 py-5 text-center">
          <p className="text-lg tracking-widest text-[#F1A90B]" aria-hidden="true">
            ★★★★★
          </p>
          <h2 className="mt-1 text-base font-semibold text-slate-900">Enjoying your Jersey Mart experience?</h2>
          <p className="mt-1 text-sm text-slate-600">
            If you like our service, a quick review would mean the world to us. It helps other teams find us and
            helps us grow as a business. Thank you!
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <a
              href={GOOGLE_REVIEW_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow-sm ring-1 ring-slate-300 hover:bg-slate-50"
            >
              Review us on Google
            </a>
            <a
              href={FACEBOOK_REVIEW_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md bg-[#1877F2] px-4 py-2 text-sm font-medium text-white hover:bg-[#1565c0]"
            >
              Review us on Facebook
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
