"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseSupplierText } from "@/lib/supplierFormat";
import type {
  ContactChannel,
  CustomerStatus,
  DesignStage,
  PaymentStatus,
} from "@/lib/types";

/** Shared by approving a new_customer draft and manually adding a customer
 * straight from the AI drafts page -- same fields, same form, same result;
 * the only difference is whether there's a draft row to mark reviewed after. */
async function createCustomerFromForm(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  formData: FormData
): Promise<string | null> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return null;

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
      owner_id: userId,
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
  if (customerError || !customer) return null;

  const order_label = String(formData.get("order_label") ?? "").trim() || null;
  const deadline = String(formData.get("deadline") ?? "").trim() || null;
  const team_name = String(formData.get("team_name") ?? "").trim();
  const players_text = String(formData.get("players_text") ?? "").trim();
  const order_product_types = [
    ...new Set([
      ...formData.getAll("order_product_types").map((v) => String(v).trim()),
      ...String(formData.get("order_product_types_other") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ]),
  ];

  const needsOrder =
    order_label || deadline || team_name || order_product_types.length > 0;
  if (needsOrder) {
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        owner_id: userId,
        customer_id: customer.id,
        label: order_label,
        deadline,
        product_types: order_product_types,
      })
      .select("id")
      .single();

    if (!orderError && order && team_name) {
      const { data: team, error: teamError } = await supabase
        .from("teams")
        .insert({ owner_id: userId, order_id: order.id, team_name })
        .select("id")
        .single();

      if (!teamError && team && players_text) {
        const parsed = parseSupplierText(players_text);
        if (parsed.length > 0) {
          await supabase.from("players").insert(
            parsed.map((p) => ({
              owner_id: userId,
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

  return customer.id;
}

export async function approveAiDraft(draftId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const customerId = await createCustomerFromForm(supabase, user.id, formData);
  if (!customerId) return;

  await supabase
    .from("ai_drafts")
    .update({
      status: "approved",
      created_customer_id: customerId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", draftId);

  revalidatePath("/ai-drafts");
  revalidatePath("/customers");
  revalidatePath("/orders");
  revalidatePath("/");
  redirect(`/customers/${customerId}`);
}

export async function createCustomerManually(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const customerId = await createCustomerFromForm(supabase, user.id, formData);
  if (!customerId) return;

  revalidatePath("/ai-drafts");
  revalidatePath("/customers");
  revalidatePath("/orders");
  revalidatePath("/");
  redirect(`/customers/${customerId}`);
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

  const has_new_order = formData.get("has_new_order") === "1";
  let new_order_id: string | null = null;
  if (has_new_order) {
    const parseAmount = (key: string) => {
      const raw = String(formData.get(key) ?? "").trim();
      if (!raw) return null;
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    };

    const payment_status = String(
      formData.get("new_order_payment_status") ?? ""
    ).trim() as PaymentStatus | "";
    const reckon_invoice_id =
      String(formData.get("new_order_reckon_invoice_id") ?? "").trim() || null;
    const new_order_special_instructions =
      String(formData.get("new_order_special_instructions") ?? "").trim() || null;
    const new_order_product_types = [
      ...new Set([
        ...formData.getAll("new_order_product_types").map((v) => String(v).trim()),
        ...String(formData.get("new_order_product_types_other") ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      ]),
    ];

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        owner_id: user.id,
        customer_id,
        label: String(formData.get("new_order_label") ?? "").trim() || null,
        deadline: String(formData.get("new_order_deadline") ?? "").trim() || null,
        sale_amount: parseAmount("new_order_sale_amount"),
        supplier_cost: parseAmount("new_order_supplier_cost"),
        freight_cost: parseAmount("new_order_freight_cost"),
        ...(payment_status ? { payment_status } : {}),
        reckon_invoice_id,
        special_instructions: new_order_special_instructions,
        product_types: new_order_product_types,
      })
      .select("id")
      .single();

    if (!orderError && order) {
      new_order_id = order.id;
      const new_order_team_name = String(formData.get("new_order_team_name") ?? "").trim();
      if (new_order_team_name) {
        const { data: team, error: teamError } = await supabase
          .from("teams")
          .insert({ owner_id: user.id, order_id: order.id, team_name: new_order_team_name })
          .select("id")
          .single();

        if (!teamError && team) {
          const new_order_players_text = String(
            formData.get("new_order_players_text") ?? ""
          ).trim();
          if (new_order_players_text) {
            const parsed = parseSupplierText(new_order_players_text);
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
    }
  }

  let existing_order_id: string | null = null;
  if (team_id) {
    const { data: team } = await supabase
      .from("teams")
      .select("order_id")
      .eq("id", team_id)
      .single();
    existing_order_id = team?.order_id ?? null;
  }

  if (note) {
    await supabase.from("notes").insert({
      owner_id: user.id,
      customer_id,
      order_id: existing_order_id ?? new_order_id,
      body: note,
      source: "other",
    });
  }

  const special_instructions = String(
    formData.get("special_instructions") ?? ""
  ).trim();
  if (special_instructions && existing_order_id) {
    await supabase
      .from("orders")
      .update({
        special_instructions,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing_order_id);
  }

  const product_types = [
    ...new Set([
      ...formData.getAll("product_types").map((v) => String(v).trim()),
      ...String(formData.get("product_types_other") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ]),
  ];
  if (product_types.length > 0 && existing_order_id) {
    await supabase
      .from("orders")
      .update({
        product_types,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing_order_id);
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
