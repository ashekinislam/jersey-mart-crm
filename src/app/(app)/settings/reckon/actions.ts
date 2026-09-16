"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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

export async function disconnectReckon() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("reckon_connections").delete().eq("owner_id", user.id);

  revalidatePath("/settings/reckon");
}
