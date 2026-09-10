"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseSupplierText } from "@/lib/supplierFormat";
import type { ContactChannel, CustomerStatus, DesignStage } from "@/lib/types";

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

export async function approveUpdateDraft(draftId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const customer_id = String(formData.get("customer_id") ?? "").trim();
  if (!customer_id) return;

  const team_id = String(formData.get("team_id") ?? "").trim() || null;
  const note = String(formData.get("note") ?? "").trim();
  const players_text = String(formData.get("players_text") ?? "").trim();
  const design_stage = String(formData.get("design_stage") ?? "") as DesignStage;
  const design_caption = String(formData.get("design_caption") ?? "").trim() || null;
  const design_image_url =
    String(formData.get("design_image_url") ?? "").trim() || null;
  const file = formData.get("design_file");

  if (note) {
    const { data: order } = team_id
      ? await supabase.from("teams").select("order_id").eq("id", team_id).single()
      : { data: null };

    await supabase.from("notes").insert({
      owner_id: user.id,
      customer_id,
      order_id: order?.order_id ?? null,
      body: note,
      source: "other",
    });
  }

  if (team_id && players_text) {
    const parsed = parseSupplierText(players_text);
    if (parsed.length > 0) {
      await supabase.from("players").insert(
        parsed.map((p) => ({
          owner_id: user.id,
          team_id,
          player_name: p.player_name,
          name_on_back: p.name_on_back,
          jersey_size: p.jersey_size,
          jersey_number: p.jersey_number,
        }))
      );
    }
  }

  if (team_id && (design_stage === "ai_concept" || design_stage === "machine_ready")) {
    let buffer: Buffer | null = null;
    let contentType = "image/jpeg";

    if (file instanceof File && file.size > 0) {
      buffer = Buffer.from(await file.arrayBuffer());
      contentType = file.type || contentType;
    } else if (design_image_url) {
      try {
        const res = await fetch(design_image_url);
        if (res.ok) {
          buffer = Buffer.from(await res.arrayBuffer());
          contentType = res.headers.get("content-type") || contentType;
        }
      } catch {
        // ignore fetch failures -- the draft's note/players still get applied
      }
    }

    if (buffer) {
      const extension = contentType.split("/")[1]?.split(";")[0] || "jpg";
      const storagePath = `${user.id}/${team_id}/${design_stage}/${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from("designs")
        .upload(storagePath, buffer, { contentType });

      if (!uploadError) {
        await supabase.from("designs").insert({
          owner_id: user.id,
          team_id,
          stage: design_stage,
          storage_path: storagePath,
          label: design_caption,
        });
      }
    }
  }

  await supabase
    .from("ai_drafts")
    .update({
      status: "approved",
      created_customer_id: customer_id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", draftId);

  revalidatePath("/ai-drafts");
  revalidatePath(`/customers/${customer_id}`);
  redirect(`/customers/${customer_id}`);
}

export async function rejectAiDraft(draftId: string) {
  const supabase = await createClient();
  await supabase
    .from("ai_drafts")
    .update({ status: "rejected", reviewed_at: new Date().toISOString() })
    .eq("id", draftId);

  revalidatePath("/ai-drafts");
}
