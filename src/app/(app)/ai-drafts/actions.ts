"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseSupplierText } from "@/lib/supplierFormat";
import type { ContactChannel, CustomerStatus } from "@/lib/types";

export async function approveAiDraft(draftId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const contact_channel = String(
    formData.get("contact_channel") ?? "phone"
  ) as ContactChannel;
  const status = String(formData.get("status") ?? "lead") as CustomerStatus;
  const contact_handle = String(formData.get("contact_handle") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const address = String(formData.get("address") ?? "").trim() || null;
  const state = String(formData.get("state") ?? "").trim() || null;
  const fabric_preference =
    String(formData.get("fabric_preference") ?? "").trim() || null;

  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .insert({
      owner_id: user.id,
      name,
      contact_channel,
      contact_handle,
      phone,
      email,
      address,
      state,
      fabric_preference,
      status,
    })
    .select("id")
    .single();
  if (customerError || !customer) return;

  const order_label = String(formData.get("order_label") ?? "").trim() || null;
  const deadline = String(formData.get("deadline") ?? "").trim() || null;
  const team_name = String(formData.get("team_name") ?? "").trim();
  const players_text = String(formData.get("players_text") ?? "").trim();

  const needsOrder = order_label || deadline || team_name;
  if (needsOrder) {
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        owner_id: user.id,
        customer_id: customer.id,
        label: order_label,
        deadline,
      })
      .select("id")
      .single();

    if (!orderError && order && team_name) {
      const { data: team, error: teamError } = await supabase
        .from("teams")
        .insert({ owner_id: user.id, order_id: order.id, team_name })
        .select("id")
        .single();

      if (!teamError && team && players_text) {
        const parsed = parseSupplierText(players_text);
        if (parsed.length > 0) {
          await supabase.from("players").insert(
            parsed.map((p) => ({
              owner_id: user.id,
              team_id: team.id,
              player_name: p.player_name,
              name_on_back: p.name_on_back,
              jersey_size: p.jersey_size,
              jersey_number: p.jersey_number,
            }))
          );
        }
      }
    }
  }

  await supabase
    .from("ai_drafts")
    .update({
      status: "approved",
      created_customer_id: customer.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", draftId);

  revalidatePath("/ai-drafts");
  revalidatePath("/customers");
  revalidatePath("/orders");
  revalidatePath("/");
  redirect(`/customers/${customer.id}`);
}

export async function rejectAiDraft(draftId: string) {
  const supabase = await createClient();
  await supabase
    .from("ai_drafts")
    .update({ status: "rejected", reviewed_at: new Date().toISOString() })
    .eq("id", draftId);

  revalidatePath("/ai-drafts");
}
