import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiDraftPayload, Order, PaymentStatus, ReckonConnection } from "@/lib/types";

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

export interface ReckonCustomerDetail {
  id: string;
  name: string;
  phoneNumbers?: {
    type: { name: string };
    countryCode: string;
    areaCode: string;
    number: string;
  }[];
  electronicAddresses?: { type: { name: string }; address: string }[];
  addresses?: {
    type: { name: string };
    line1: string;
    line2: string;
    line3: string;
    suburb: string;
    state: string;
    postcode: string;
  }[];
}

/** Pulls a phone/email/address out of Reckon's customer record for prefilling
 * a new-customer draft -- preferring Mobile over Phone, and Postal over
 * Shipping/Business for the address, same priority Reckon's own UI uses. */
export function extractReckonContact(customer: ReckonCustomerDetail): {
  phone: string | null;
  email: string | null;
  address: string | null;
  state: string | null;
} {
  const phoneByType = (name: string) =>
    customer.phoneNumbers?.find((p) => p.type.name === name && p.number.trim());
  const phoneEntry = phoneByType("Mobile") ?? phoneByType("Phone");
  const phone = phoneEntry
    ? `${phoneEntry.countryCode}${phoneEntry.areaCode}${phoneEntry.number}`.trim()
    : null;

  const email =
    customer.electronicAddresses?.find(
      (e) => e.type.name === "Email" && e.address.trim()
    )?.address ?? null;

  const addressByType = (name: string) =>
    customer.addresses?.find(
      (a) => a.type.name === name && (a.line1.trim() || a.suburb.trim())
    );
  const addressEntry =
    addressByType("Postal") ?? addressByType("Shipping") ?? addressByType("Business");
  const address = addressEntry
    ? [addressEntry.line1, addressEntry.line2, addressEntry.line3, addressEntry.suburb]
        .map((s) => s.trim())
        .filter(Boolean)
        .join(", ") || null
    : null;
  const state = addressEntry?.state.trim() || null;

  return { phone, email, address, state };
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
  supabase: SupabaseClient,
  ownerId?: string
): Promise<ReckonConnection | null> {
  let query = supabase.from("reckon_connections").select("*");
  if (ownerId) query = query.eq("owner_id", ownerId);
  const { data } = await query.maybeSingle();
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

export interface ReckonSyncSummary {
  ok: boolean;
  error?: string;
  detail?: unknown;
  updated: number;
  linked: number;
  drafted: number;
}

/** Pulls invoices from the connected Reckon One book and reconciles them against
 * orders for this owner. Shared by the interactive "Sync now" button and the
 * scheduled cron job -- same logic, same safety rules, either way. */
export async function runReckonSync(
  supabase: SupabaseClient,
  ownerId: string
): Promise<ReckonSyncSummary> {
  const connection = await getReckonConnection(supabase, ownerId);
  if (!connection?.book_id) {
    return { ok: false, error: "not_ready", updated: 0, linked: 0, drafted: 0 };
  }

  const accessToken = await getValidAccessToken(supabase, connection);
  if (!accessToken) {
    return { ok: false, error: "token_failed", updated: 0, linked: 0, drafted: 0 };
  }

  // The Reckon API defaults to page=1/perpage=10 when unpaginated -- fetching
  // just "/invoices" silently truncates to the first 10 invoices by their
  // default order, so anything beyond that (including newly created ones)
  // never gets seen. Page through everything explicitly instead.
  const perPage = 100;
  const invoices: ReckonInvoice[] = [];
  for (let page = 1; page <= 50; page++) {
    const result = await reckonApiGet(
      accessToken,
      connection.book_id,
      `/invoices?page=${page}&perpage=${perPage}`
    );
    if (!result.ok) {
      return {
        ok: false,
        error: "fetch_failed",
        detail: { status: result.status, body: result.body },
        updated: 0,
        linked: 0,
        drafted: 0,
      };
    }

    const pageInvoices = ((result.body as { list?: ReckonInvoice[] })?.list ??
      []) as ReckonInvoice[];
    invoices.push(...pageInvoices);
    if (pageInvoices.length < perPage) break;
  }

  const { data: existingOrders } = await supabase
    .from("orders")
    .select("id, label, payment_status, reckon_invoice_id")
    .eq("owner_id", ownerId);

  const byInvoiceId = new Map<string, Pick<Order, "id" | "payment_status">>();
  const unlinkedOrders: Pick<Order, "id" | "label">[] = [];
  for (const o of (existingOrders ?? []) as Pick<
    Order,
    "id" | "label" | "payment_status" | "reckon_invoice_id"
  >[]) {
    if (o.reckon_invoice_id) {
      byInvoiceId.set(o.reckon_invoice_id, o);
    } else {
      unlinkedOrders.push(o);
    }
  }

  const { data: pendingDrafts } = await supabase
    .from("ai_drafts")
    .select("payload")
    .eq("status", "pending")
    .eq("owner_id", ownerId);
  const alreadyDrafted = new Set(
    ((pendingDrafts ?? []) as { payload: AiDraftPayload }[])
      .map((d) => d.payload.new_order?.reckon_invoice_id ?? d.payload.order?.reckon_invoice_id)
      .filter((id): id is string => !!id)
  );

  let updated = 0;
  let linked = 0;
  let drafted = 0;

  for (const invoice of invoices) {
    const newStatus = mapReckonInvoiceToPaymentStatus(invoice);

    const linkedOrder = byInvoiceId.get(invoice.id);
    if (linkedOrder) {
      if (linkedOrder.payment_status !== newStatus) {
        await supabase
          .from("orders")
          .update({ payment_status: newStatus, updated_at: new Date().toISOString() })
          .eq("id", linkedOrder.id);
        updated++;
      }
      continue;
    }

    const invoiceNumber = invoice.invoiceNumber?.trim();
    const backfillMatch =
      invoiceNumber && invoiceNumber.length >= 3
        ? unlinkedOrders.find((o) => o.label?.includes(invoiceNumber))
        : undefined;

    if (backfillMatch) {
      await supabase
        .from("orders")
        .update({
          reckon_invoice_id: invoice.id,
          payment_status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", backfillMatch.id);
      linked++;
      continue;
    }

    if (alreadyDrafted.has(invoice.id)) continue;

    const hint = invoice.customer?.name?.trim();
    if (!hint) continue;

    const { data: matches } = await supabase
      .from("customers")
      .select("id")
      .eq("owner_id", ownerId)
      .ilike("name", `%${hint}%`);

    let payload: AiDraftPayload;
    if (!matches || matches.length === 0) {
      // Nobody in the CRM even loosely matches this name -- pull the
      // customer's contact details from Reckon so the owner doesn't have
      // to retype them by hand when approving.
      let contact: ReckonCustomerDetail | null = null;
      if (invoice.customer?.id) {
        const detailResult = await reckonApiGet(
          accessToken,
          connection.book_id,
          `/customers/${invoice.customer.id}`
        );
        if (detailResult.ok) contact = detailResult.body as ReckonCustomerDetail;
      }
      const { phone, email, address, state } = contact
        ? extractReckonContact(contact)
        : { phone: null, email: null, address: null, state: null };

      payload = {
        kind: "new_customer",
        customer: {
          name: hint,
          contact_channel: "phone",
          phone,
          email,
          address,
          state,
          status: "lead",
        },
        order: {
          label: `Invoice #${invoice.invoiceNumber}`,
          sale_amount: reckonInvoiceGrandTotal(invoice),
          payment_status: newStatus,
          reckon_invoice_id: invoice.id,
        },
      };
    } else {
      const matched_customer_id = matches.length === 1 ? matches[0].id : null;
      payload = {
        kind: "update_existing",
        customer_name_hint: hint,
        matched_customer_id,
        new_order: {
          label: `Invoice #${invoice.invoiceNumber}`,
          sale_amount: reckonInvoiceGrandTotal(invoice),
          payment_status: newStatus,
          reckon_invoice_id: invoice.id,
        },
      };
    }

    await supabase.from("ai_drafts").insert({
      owner_id: ownerId,
      raw_prompt: `Synced from Reckon — Invoice #${invoice.invoiceNumber} for ${hint}`,
      payload,
      status: "pending",
    });
    drafted++;
  }

  await supabase
    .from("reckon_connections")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("owner_id", ownerId);

  return { ok: true, updated, linked, drafted };
}
