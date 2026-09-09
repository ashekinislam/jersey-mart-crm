"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ContactChannel, DesignStage } from "@/lib/types";

export async function convertLead(conversationId: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: conversation } = await supabase
    .from("meta_conversations")
    .select("*")
    .eq("id", conversationId)
    .single();
  if (!conversation) return;

  if (conversation.customer_id) {
    redirect(`/customers/${conversation.customer_id}`);
  }

  const { data: customer, error } = await supabase
    .from("customers")
    .insert({
      owner_id: user.id,
      name,
      contact_channel: conversation.platform as ContactChannel,
      contact_handle:
        String(formData.get("contact_handle") ?? "").trim() ||
        conversation.external_user_name ||
        conversation.external_user_id,
      phone: String(formData.get("phone") ?? "").trim() || null,
      email: String(formData.get("email") ?? "").trim() || null,
      status: "lead",
    })
    .select("id")
    .single();
  if (error || !customer) return;

  await supabase
    .from("meta_conversations")
    .update({ customer_id: customer.id })
    .eq("id", conversationId);

  revalidatePath("/leads");
  revalidatePath(`/leads/${conversationId}`);
  revalidatePath(`/customers/${customer.id}`);
  redirect(`/customers/${customer.id}`);
}

export async function deleteLead(conversationId: string) {
  const supabase = await createClient();
  const { data: conversation } = await supabase
    .from("meta_conversations")
    .select("customer_id")
    .eq("id", conversationId)
    .single();
  if (conversation?.customer_id) return;

  await supabase.from("meta_conversations").delete().eq("id", conversationId);

  revalidatePath("/leads");
}

export async function saveMessageAsDesign(
  customerId: string,
  messageId: string,
  formData: FormData
) {
  const teamId = String(formData.get("team_id") ?? "").trim();
  const stage = String(formData.get("stage") ?? "ai_concept") as DesignStage;
  if (!teamId || (stage !== "ai_concept" && stage !== "machine_ready")) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: message } = await supabase
    .from("meta_messages")
    .select("attachment_storage_path")
    .eq("id", messageId)
    .single();
  if (!message?.attachment_storage_path) return;

  const { data: team } = await supabase
    .from("teams")
    .select("id, order_id")
    .eq("id", teamId)
    .single();
  if (!team) return;

  const { data: order } = await supabase
    .from("orders")
    .select("customer_id")
    .eq("id", team.order_id)
    .single();
  if (!order || order.customer_id !== customerId) return;

  const { data: fileBlob, error: downloadError } = await supabase.storage
    .from("meta-attachments")
    .download(message.attachment_storage_path);
  if (downloadError || !fileBlob) return;

  const buffer = Buffer.from(await fileBlob.arrayBuffer());
  const safeName =
    message.attachment_storage_path.split("/").pop() ?? `${Date.now()}.jpg`;
  const storagePath = `${user.id}/${teamId}/${stage}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("designs")
    .upload(storagePath, buffer, { contentType: fileBlob.type || "image/jpeg" });
  if (uploadError) return;

  await supabase.from("designs").insert({
    owner_id: user.id,
    team_id: teamId,
    stage,
    storage_path: storagePath,
    label: String(formData.get("label") ?? "").trim() || null,
  });

  revalidatePath(`/customers/${customerId}`);
  revalidatePath(`/customers/${customerId}/orders/${team.order_id}/teams/${teamId}`);
}
