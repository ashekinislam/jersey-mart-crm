import type { SupabaseClient } from "@supabase/supabase-js";
import type { ShippingStatus } from "@/lib/types";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://jersey-mart-crm.vercel.app";

export function trackingShareUrl(token: string): string {
  return `${APP_URL.replace(/\/$/, "")}/track/${token}`;
}

/** The only fields a customer's tracking link may ever show -- no pricing, costs, notes,
 * or anything about other orders. Kept separate from the `orders`/`customers` row shapes
 * so adding a field elsewhere can never leak into this page by accident. */
export interface PublicTrackingData {
  customerName: string;
  orderLabel: string | null;
  orderDate: string;
  shippingStatus: ShippingStatus;
  trackingNumber: string | null;
  trackingUrl: string | null;
  updatedAt: string;
}

/** Looks up a tracking-share token with the service-role client (the visitor has no
 * Supabase session, so RLS would otherwise return nothing) and returns just the
 * customer-safe fields above, or null if the token doesn't match any order. Takes the
 * client as a parameter, rather than constructing one itself, so it can be exercised
 * with a stub in tests without ever touching the real database. */
export async function getPublicTrackingData(
  supabase: SupabaseClient,
  token: string
): Promise<PublicTrackingData | null> {
  if (!token) return null;

  const { data: order } = await supabase
    .from("orders")
    .select("label, order_date, shipping_status, tracking_number, tracking_url, updated_at, customer_id")
    .eq("tracking_share_token", token)
    .maybeSingle();
  if (!order) return null;

  const { data: customer } = await supabase
    .from("customers")
    .select("name")
    .eq("id", order.customer_id)
    .maybeSingle();

  return {
    customerName: customer?.name ?? "there",
    orderLabel: order.label,
    orderDate: order.order_date,
    shippingStatus: order.shipping_status,
    trackingNumber: order.tracking_number,
    trackingUrl: order.tracking_url,
    updatedAt: order.updated_at,
  };
}
