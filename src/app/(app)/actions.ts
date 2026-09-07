"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type {
  ContactChannel,
  CustomerStatus,
  NoteSource,
} from "@/lib/types";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function addCustomer(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("customers")
    .insert({
      owner_id: user.id,
      name,
      contact_channel: String(
        formData.get("contact_channel") ?? "facebook"
      ) as ContactChannel,
      contact_handle: String(formData.get("contact_handle") ?? "").trim() || null,
      status: "lead",
    })
    .select("id")
    .single();

  if (error || !data) return;

  revalidatePath("/");
  redirect(`/customers/${data.id}`);
}

export async function updateCustomer(customerId: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const status = String(formData.get("status") ?? "lead") as CustomerStatus;
  const contact_channel = String(
    formData.get("contact_channel") ?? "facebook"
  ) as ContactChannel;
  const contact_handle =
    String(formData.get("contact_handle") ?? "").trim() || null;
  const tagsRaw = String(formData.get("tags") ?? "");
  const tags = tagsRaw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  if (!name) return;

  const supabase = await createClient();
  await supabase
    .from("customers")
    .update({
      name,
      status,
      contact_channel,
      contact_handle,
      tags,
      updated_at: new Date().toISOString(),
    })
    .eq("id", customerId);

  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/");
}

export async function addNote(customerId: string, formData: FormData) {
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.from("notes").insert({
    owner_id: user.id,
    customer_id: customerId,
    body,
    source: String(formData.get("source") ?? "facebook") as NoteSource,
    is_order_relevant: formData.get("is_order_relevant") === "on",
  });

  revalidatePath(`/customers/${customerId}`);
}

export async function deleteNote(customerId: string, noteId: string) {
  const supabase = await createClient();
  await supabase.from("notes").delete().eq("id", noteId);
  revalidatePath(`/customers/${customerId}`);
}

export async function addPricing(customerId: string, formData: FormData) {
  const product_name = String(formData.get("product_name") ?? "").trim();
  const priceRaw = String(formData.get("price") ?? "");
  const price = Number(priceRaw);
  if (!product_name || !Number.isFinite(price)) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.from("pricing").insert({
    owner_id: user.id,
    customer_id: customerId,
    product_name,
    price,
    currency: String(formData.get("currency") ?? "AUD").trim() || "AUD",
    note: String(formData.get("note") ?? "").trim() || null,
  });

  revalidatePath(`/customers/${customerId}`);
}

export async function markOrderSent(customerId: string, summaryText: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.from("orders").insert({
    owner_id: user.id,
    customer_id: customerId,
    status: "sent",
    summary_text: summaryText,
    sent_at: new Date().toISOString(),
  });

  revalidatePath(`/customers/${customerId}/order`);
  revalidatePath(`/customers/${customerId}`);
}
