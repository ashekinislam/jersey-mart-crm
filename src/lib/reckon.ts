import type { SupabaseClient } from "@supabase/supabase-js";
import type { PaymentStatus, ReckonConnection } from "@/lib/types";

const TOKEN_URL = "https://identity.reckon.com/connect/token";
const API_BASE = "https://api-v2.reckonone.com";

export interface ReckonInvoice {
  id: string;
  invoiceNumber: string;
  customer: { id: string; name: string };
  invoiceDate: string;
  totalAmount: number;
  totalTaxAmount: number | null;
  amountTaxStatus: "Inclusive" | "Exclusive";
  balance: number;
  status: string;
  emailStatus: string;
}

/** Reckon has no "partially paid" invoice status of its own -- balance vs. the
 * grand total is the only signal, so we derive our four-state payment_status from it. */
export function reckonInvoiceGrandTotal(invoice: ReckonInvoice): number {
  if (invoice.amountTaxStatus === "Inclusive") return invoice.totalAmount;
  return invoice.totalAmount + (invoice.totalTaxAmount ?? 0);
}

export function mapReckonInvoiceToPaymentStatus(
  invoice: ReckonInvoice
): PaymentStatus {
  const grandTotal = reckonInvoiceGrandTotal(invoice);
  if (invoice.balance <= 0) return "paid";
  if (invoice.balance < grandTotal) return "partially_paid";
  return invoice.emailStatus === "Sent" ? "invoice_sent" : "unpaid";
}

async function refreshAccessToken(
  supabase: SupabaseClient,
  connection: ReckonConnection
): Promise<string | null> {
  const clientId = process.env.RECKON_CLIENT_ID;
  const clientSecret = process.env.RECKON_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64"
  );

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: connection.refresh_token,
    }),
  });

  if (!res.ok) return null;

  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
  await supabase
    .from("reckon_connections")
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("owner_id", connection.owner_id);

  return data.access_token;
}

export async function getReckonConnection(
  supabase: SupabaseClient
): Promise<ReckonConnection | null> {
  const { data } = await supabase
    .from("reckon_connections")
    .select("*")
    .maybeSingle();
  return data as ReckonConnection | null;
}

/** Returns a valid access token for this connection, refreshing it first if it's expired or about to be. */
export async function getValidAccessToken(
  supabase: SupabaseClient,
  connection: ReckonConnection
): Promise<string | null> {
  const expiresAt = new Date(connection.expires_at).getTime();
  const bufferMs = 60_000;
  if (expiresAt - bufferMs > Date.now()) return connection.access_token;
  return refreshAccessToken(supabase, connection);
}

export interface ReckonApiResult {
  ok: boolean;
  status: number;
  body: unknown;
}

/** Makes an authenticated GET call to the Reckon One API v2 for this connection's book. */
export async function reckonApiGet(
  accessToken: string,
  bookId: string,
  path: string
): Promise<ReckonApiResult> {
  const subscriptionKey = process.env.RECKON_SUBSCRIPTION_KEY;
  if (!subscriptionKey) {
    return { ok: false, status: 0, body: { error: "RECKON_SUBSCRIPTION_KEY not configured" } };
  }

  const res = await fetch(`${API_BASE}/${bookId}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Ocp-Apim-Subscription-Key": subscriptionKey,
      Accept: "application/json",
    },
  });

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = await res.text().catch(() => null);
  }

  return { ok: res.ok, status: res.status, body };
}
