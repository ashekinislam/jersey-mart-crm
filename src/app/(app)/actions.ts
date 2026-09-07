"use server";

import ExcelJS from "exceljs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseSupplierText } from "@/lib/supplierFormat";
import type {
  ContactChannel,
  CustomerStatus,
  DesignStage,
  DesignStatus,
  NoteSource,
  OrderTrackingStatus,
  PaymentStatus,
  ShippingStatus,
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

  revalidatePath("/customers");
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
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const address = String(formData.get("address") ?? "").trim() || null;
  const state = String(formData.get("state") ?? "").trim() || null;
  const fabric_preference =
    String(formData.get("fabric_preference") ?? "").trim() || null;
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
      phone,
      email,
      address,
      state,
      fabric_preference,
      tags,
      updated_at: new Date().toISOString(),
    })
    .eq("id", customerId);

  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/customers");
  revalidatePath("/");
}

export async function deleteCustomer(customerId: string) {
  const supabase = await createClient();
  await supabase.from("customers").delete().eq("id", customerId);

  revalidatePath("/customers");
  redirect("/customers");
}

export async function addNote(customerId: string, formData: FormData) {
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;

  const order_id = String(formData.get("order_id") ?? "").trim() || null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.from("notes").insert({
    owner_id: user.id,
    customer_id: customerId,
    order_id,
    body,
    source: String(formData.get("source") ?? "facebook") as NoteSource,
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
    currency: "AUD",
    note: String(formData.get("note") ?? "").trim() || null,
  });

  revalidatePath(`/customers/${customerId}`);
}

// ---- Orders ----------------------------------------------------------

export async function addOrder(customerId: string, formData: FormData) {
  const label = String(formData.get("label") ?? "").trim() || null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("orders")
    .insert({ owner_id: user.id, customer_id: customerId, label })
    .select("id")
    .single();

  if (error || !data) return;

  revalidatePath(`/customers/${customerId}`);
  redirect(`/customers/${customerId}/orders/${data.id}`);
}

export async function deleteOrder(customerId: string, orderId: string) {
  const supabase = await createClient();
  await supabase.from("orders").delete().eq("id", orderId);
  revalidatePath(`/customers/${customerId}`);
  redirect(`/customers/${customerId}`);
}

export async function updateOrderTracking(
  customerId: string,
  orderId: string,
  formData: FormData
) {
  const label = String(formData.get("label") ?? "").trim() || null;
  const deadline = String(formData.get("deadline") ?? "").trim() || null;
  const order_status = String(
    formData.get("order_status") ?? "quote_sent"
  ) as OrderTrackingStatus;
  const payment_status = String(
    formData.get("payment_status") ?? "unpaid"
  ) as PaymentStatus;
  const payment_due_date =
    String(formData.get("payment_due_date") ?? "").trim() || null;
  const shipping_status = String(
    formData.get("shipping_status") ?? "not_shipped"
  ) as ShippingStatus;
  const tracking_url = String(formData.get("tracking_url") ?? "").trim() || null;
  const tracking_number =
    String(formData.get("tracking_number") ?? "").trim() || null;

  const supabase = await createClient();
  await supabase
    .from("orders")
    .update({
      label,
      deadline,
      order_status,
      payment_status,
      payment_due_date,
      shipping_status,
      tracking_url,
      tracking_number,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  revalidatePath(`/customers/${customerId}/orders/${orderId}`);
  revalidatePath(`/customers/${customerId}/orders/${orderId}/build`);
  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/");
}

export async function uploadInvoice(
  customerId: string,
  orderId: string,
  formData: FormData
) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: existing } = await supabase
    .from("orders")
    .select("invoice_storage_path")
    .eq("id", orderId)
    .single();

  if (existing?.invoice_storage_path) {
    await supabase.storage
      .from("invoices")
      .remove([existing.invoice_storage_path]);
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${user.id}/${orderId}/${Date.now()}-${safeName}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from("invoices")
    .upload(storagePath, buffer, {
      contentType: file.type || "application/octet-stream",
    });
  if (uploadError) return;

  await supabase
    .from("orders")
    .update({ invoice_storage_path: storagePath })
    .eq("id", orderId);

  revalidatePath(`/customers/${customerId}/orders/${orderId}`);
}

export async function deleteInvoice(customerId: string, orderId: string) {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("orders")
    .select("invoice_storage_path")
    .eq("id", orderId)
    .single();

  if (existing?.invoice_storage_path) {
    await supabase.storage
      .from("invoices")
      .remove([existing.invoice_storage_path]);
  }

  await supabase
    .from("orders")
    .update({ invoice_storage_path: null })
    .eq("id", orderId);

  revalidatePath(`/customers/${customerId}/orders/${orderId}`);
}

export async function markOrderSent(
  customerId: string,
  orderId: string,
  summaryText: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.from("order_summaries").insert({
    owner_id: user.id,
    order_id: orderId,
    status: "sent",
    summary_text: summaryText,
    sent_at: new Date().toISOString(),
  });

  revalidatePath(`/customers/${customerId}/orders/${orderId}/build`);
  revalidatePath(`/customers/${customerId}/orders/${orderId}`);
}

// ---- Teams -------------------------------------------------------------

export async function addTeam(
  customerId: string,
  orderId: string,
  formData: FormData
) {
  const team_name = String(formData.get("team_name") ?? "").trim();
  if (!team_name) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase
    .from("teams")
    .insert({ owner_id: user.id, order_id: orderId, team_name });

  revalidatePath(`/customers/${customerId}/orders/${orderId}`);
}

export async function deleteTeam(
  customerId: string,
  orderId: string,
  teamId: string
) {
  const supabase = await createClient();
  await supabase.from("teams").delete().eq("id", teamId);
  revalidatePath(`/customers/${customerId}/orders/${orderId}`);
}

// ---- Players -------------------------------------------------------------

const PLAYER_COLUMN_HEADERS: Record<string, string> = {
  "jersey no.": "jersey_number",
  "jersey no": "jersey_number",
  "jersey number": "jersey_number",
  "jersey #": "jersey_number",
  "player name": "player_name",
  "name on back": "name_on_back",
  size: "jersey_size",
  "shorts size": "shorts_size",
  "notes / special request": "notes",
  "notes/special request": "notes",
  notes: "notes",
};

function revalidateTeamPaths(
  customerId: string,
  orderId: string,
  teamId: string
) {
  revalidatePath(`/customers/${customerId}/orders/${orderId}/teams/${teamId}`);
  revalidatePath(`/customers/${customerId}/orders/${orderId}/build`);
  revalidatePath(`/customers/${customerId}/orders/${orderId}`);
}

export async function importPlayers(
  customerId: string,
  orderId: string,
  teamId: string,
  formData: FormData
) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return;

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = new ExcelJS.Workbook();
  // exceljs's bundled types predate Node's generic Buffer<T>; the value is a real Buffer at runtime.
  await workbook.xlsx.load(buffer as never);
  const sheet = workbook.worksheets[0];
  if (!sheet) return;

  const colMap: Record<string, number> = {};
  let headerRowNumber = -1;

  sheet.eachRow((row, rowNumber) => {
    if (headerRowNumber !== -1) return;
    const values = row.values as (string | number | undefined)[];
    const normalized = values.map((v) =>
      typeof v === "string" ? v.trim().toLowerCase() : ""
    );
    const foundIndex = normalized.findIndex((v) => v === "player name");
    if (foundIndex !== -1) {
      headerRowNumber = rowNumber;
      normalized.forEach((v, idx) => {
        const field = PLAYER_COLUMN_HEADERS[v];
        if (field) colMap[field] = idx;
      });
    }
  });

  if (headerRowNumber === -1 || !colMap.player_name) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Stop at the first row with no player name — the form's data rows are
  // contiguous, so this avoids sweeping up footer/instruction text below the table.
  const rowsToInsert: Record<string, string | null>[] = [];
  for (
    let rowNumber = headerRowNumber + 1;
    rowNumber <= sheet.rowCount;
    rowNumber++
  ) {
    const row = sheet.getRow(rowNumber);
    const values = row.values as (string | number | undefined)[];
    const cell = (field: string) => {
      const idx = colMap[field];
      if (!idx) return null;
      return String(values[idx] ?? "").trim() || null;
    };
    const player_name = cell("player_name");
    if (!player_name) break;
    rowsToInsert.push({
      owner_id: user.id,
      team_id: teamId,
      player_name,
      name_on_back: cell("name_on_back"),
      jersey_size: cell("jersey_size"),
      shorts_size: cell("shorts_size"),
      jersey_number: cell("jersey_number"),
      notes: cell("notes"),
    });
  }

  if (rowsToInsert.length > 0) {
    await supabase.from("players").insert(rowsToInsert);
  }

  revalidateTeamPaths(customerId, orderId, teamId);
}

export async function importPlayersFromText(
  customerId: string,
  orderId: string,
  teamId: string,
  formData: FormData
) {
  const text = String(formData.get("text") ?? "");
  const parsed = parseSupplierText(text);
  if (parsed.length === 0) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const rowsToInsert = parsed.map((p) => ({
    owner_id: user.id,
    team_id: teamId,
    player_name: p.player_name,
    name_on_back: p.name_on_back,
    jersey_size: p.jersey_size,
    jersey_number: p.jersey_number,
  }));

  await supabase.from("players").insert(rowsToInsert);

  revalidateTeamPaths(customerId, orderId, teamId);
}

export async function addPlayer(
  customerId: string,
  orderId: string,
  teamId: string,
  formData: FormData
) {
  const player_name = String(formData.get("player_name") ?? "").trim();
  if (!player_name) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.from("players").insert({
    owner_id: user.id,
    team_id: teamId,
    player_name,
    name_on_back: String(formData.get("name_on_back") ?? "").trim() || null,
    jersey_size: String(formData.get("jersey_size") ?? "").trim() || null,
    shorts_size: String(formData.get("shorts_size") ?? "").trim() || null,
    jersey_number: String(formData.get("jersey_number") ?? "").trim() || null,
  });

  revalidateTeamPaths(customerId, orderId, teamId);
}

export async function updatePlayer(
  customerId: string,
  orderId: string,
  teamId: string,
  playerId: string,
  formData: FormData
) {
  const player_name = String(formData.get("player_name") ?? "").trim();
  if (!player_name) return;

  const supabase = await createClient();
  await supabase
    .from("players")
    .update({
      player_name,
      name_on_back: String(formData.get("name_on_back") ?? "").trim() || null,
      jersey_size: String(formData.get("jersey_size") ?? "").trim() || null,
      shorts_size: String(formData.get("shorts_size") ?? "").trim() || null,
      jersey_number: String(formData.get("jersey_number") ?? "").trim() || null,
      notes: String(formData.get("notes") ?? "").trim() || null,
    })
    .eq("id", playerId);

  revalidateTeamPaths(customerId, orderId, teamId);
}

export async function deletePlayer(
  customerId: string,
  orderId: string,
  teamId: string,
  playerId: string
) {
  const supabase = await createClient();
  await supabase.from("players").delete().eq("id", playerId);
  revalidateTeamPaths(customerId, orderId, teamId);
}

// ---- Dispatch parcels ------------------------------------------------

export async function addParcel(formData: FormData) {
  const customer_id = String(formData.get("customer_id") ?? "");
  const contents = String(formData.get("contents") ?? "").trim();
  if (!customer_id || !contents) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.from("parcels").insert({
    owner_id: user.id,
    customer_id,
    contents,
  });

  revalidatePath("/dispatch");
}

export async function markParcelsDispatched() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase
    .from("parcels")
    .update({ dispatched_at: new Date().toISOString() })
    .eq("owner_id", user.id)
    .is("dispatched_at", null);

  revalidatePath("/dispatch");
}

export async function deleteParcel(parcelId: string) {
  const supabase = await createClient();
  await supabase.from("parcels").delete().eq("id", parcelId);
  revalidatePath("/dispatch");
}

// ---- Designs -----------------------------------------------------------

export async function uploadDesign(
  customerId: string,
  orderId: string,
  teamId: string,
  formData: FormData
) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return;

  const stage = String(formData.get("stage") ?? "") as DesignStage;
  if (stage !== "ai_concept" && stage !== "machine_ready") return;

  const label = String(formData.get("label") ?? "").trim() || null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${user.id}/${teamId}/${stage}/${Date.now()}-${safeName}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from("designs")
    .upload(storagePath, buffer, {
      contentType: file.type || "application/octet-stream",
    });
  if (uploadError) return;

  await supabase.from("designs").insert({
    owner_id: user.id,
    team_id: teamId,
    stage,
    storage_path: storagePath,
    label,
  });

  revalidateTeamPaths(customerId, orderId, teamId);
}

export async function updateDesignStatus(
  customerId: string,
  orderId: string,
  teamId: string,
  designId: string,
  formData: FormData
) {
  const status = String(formData.get("status") ?? "pending") as DesignStatus;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const supabase = await createClient();
  await supabase
    .from("designs")
    .update({ status, notes })
    .eq("id", designId);

  revalidateTeamPaths(customerId, orderId, teamId);
}

export async function deleteDesign(
  customerId: string,
  orderId: string,
  teamId: string,
  designId: string
) {
  const supabase = await createClient();
  const { data: design } = await supabase
    .from("designs")
    .select("storage_path")
    .eq("id", designId)
    .single();

  if (design) {
    await supabase.storage.from("designs").remove([design.storage_path]);
  }
  await supabase.from("designs").delete().eq("id", designId);

  revalidateTeamPaths(customerId, orderId, teamId);
}
