"use server";

import ExcelJS from "exceljs";
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
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const address = String(formData.get("address") ?? "").trim() || null;
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
      fabric_preference,
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
    currency: "AUD",
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

const PLAYER_COLUMN_HEADERS: Record<string, string> = {
  "no.": "jersey_number",
  "player name": "player_name",
  "name on back": "name_on_back",
  size: "jersey_size",
  "shorts size": "shorts_size",
};

export async function importPlayers(customerId: string, formData: FormData) {
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
      customer_id: customerId,
      player_name,
      name_on_back: cell("name_on_back"),
      jersey_size: cell("jersey_size"),
      shorts_size: cell("shorts_size"),
      jersey_number: cell("jersey_number"),
    });
  }

  if (rowsToInsert.length > 0) {
    await supabase.from("players").insert(rowsToInsert);
  }

  revalidatePath(`/customers/${customerId}`);
}

export async function addPlayer(customerId: string, formData: FormData) {
  const player_name = String(formData.get("player_name") ?? "").trim();
  if (!player_name) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.from("players").insert({
    owner_id: user.id,
    customer_id: customerId,
    player_name,
    name_on_back: String(formData.get("name_on_back") ?? "").trim() || null,
    jersey_size: String(formData.get("jersey_size") ?? "").trim() || null,
    shorts_size: String(formData.get("shorts_size") ?? "").trim() || null,
    jersey_number: String(formData.get("jersey_number") ?? "").trim() || null,
  });

  revalidatePath(`/customers/${customerId}`);
}

export async function updatePlayerJerseyNumber(
  customerId: string,
  playerId: string,
  formData: FormData
) {
  const jersey_number =
    String(formData.get("jersey_number") ?? "").trim() || null;

  const supabase = await createClient();
  await supabase
    .from("players")
    .update({ jersey_number })
    .eq("id", playerId);

  revalidatePath(`/customers/${customerId}`);
}

export async function deletePlayer(customerId: string, playerId: string) {
  const supabase = await createClient();
  await supabase.from("players").delete().eq("id", playerId);
  revalidatePath(`/customers/${customerId}`);
}

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
