"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { runReckonSync } from "@/lib/reckon";

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

  const summary = await runReckonSync(supabase, user.id);

  revalidatePath("/orders");
  revalidatePath("/ai-drafts");
  revalidatePath("/");

  if (!summary.ok) {
    redirect(`/settings/reckon?syncError=${summary.error}`);
  }
  redirect(
    `/settings/reckon?synced=1&updated=${summary.updated}&linked=${summary.linked}&drafted=${summary.drafted}`
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
