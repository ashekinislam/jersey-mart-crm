"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getReckonConnection,
  getValidAccessToken,
  mapReckonInvoiceToPaymentStatus,
  reckonApiGet,
  reckonInvoiceGrandTotal,
  type ReckonInvoice,
} from "@/lib/reckon";
import type { AiDraftPayload, Order } from "@/lib/types";

export async function updateReckonBookId(formData: FormData) {
  const book_id = String(formData.get("book_id") ?? "").trim() || null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("reckon_connections")
    .update({ book_id, updated_at: new Date().toISOString() })
    .eq("owner_id", user.id);

  revalidatePath("/settings/reckon");
}

export async function syncReckon() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const connection = await getReckonConnection(supabase);
  if (!connection?.book_id) {
    redirect("/settings/reckon?syncError=not_ready");
  }

  const accessToken = await getValidAccessToken(supabase, connection);
  if (!accessToken) redirect("/settings/reckon?syncError=token_failed");

  const result = await reckonApiGet(accessToken, connection.book_id, "/invoices");
  if (!result.ok) redirect("/settings/reckon?syncError=fetch_failed");

  const invoices = ((result.body as { list?: ReckonInvoice[] })?.list ??
    []) as ReckonInvoice[];

  const { data: existingOrders } = await supabase
    .from("orders")
    .select("id, label, payment_status, reckon_invoice_id");

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
    .eq("status", "pending");
  const alreadyDrafted = new Set(
    ((pendingDrafts ?? []) as { payload: AiDraftPayload }[])
      .map((d) => d.payload.new_order?.reckon_invoice_id)
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
      .ilike("name", `%${hint}%`);
    const matched_customer_id =
      matches && matches.length === 1 ? matches[0].id : null;

    const payload: AiDraftPayload = {
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

    await supabase.from("ai_drafts").insert({
      owner_id: user.id,
      raw_prompt: `Synced from Reckon — Invoice #${invoice.invoiceNumber} for ${hint}`,
      payload,
      status: "pending",
    });
    drafted++;
  }

  revalidatePath("/orders");
  revalidatePath("/ai-drafts");
  revalidatePath("/");
  redirect(
    `/settings/reckon?synced=1&updated=${updated}&linked=${linked}&drafted=${drafted}`
  );
}

export async function disconnectReckon() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("reckon_connections").delete().eq("owner_id", user.id);

  revalidatePath("/settings/reckon");
}
