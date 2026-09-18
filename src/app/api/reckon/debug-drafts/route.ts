import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

// TEMPORARY -- read-only listing of pending ai_drafts for review. Delete once done.

const OWNER_ID = process.env.META_OWNER_USER_ID!;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("ai_drafts")
    .select("id, raw_prompt, payload, created_at")
    .eq("status", "pending")
    .eq("owner_id", OWNER_ID)
    .order("created_at", { ascending: false });

  return NextResponse.json({ count: data?.length ?? 0, drafts: data ?? [] });
}
