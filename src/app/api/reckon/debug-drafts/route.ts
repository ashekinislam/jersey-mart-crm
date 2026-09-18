import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

// TEMPORARY -- read-only listing of pending ai_drafts for review, plus a
// reject-by-id action to unblock testing without the browser's confirm()
// dialog. Delete once done.

const OWNER_ID = process.env.META_OWNER_USER_ID!;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  const { searchParams } = new URL(request.url);
  const rejectId = searchParams.get("reject");
  if (rejectId) {
    await supabase
      .from("ai_drafts")
      .update({ status: "rejected", reviewed_at: new Date().toISOString() })
      .eq("id", rejectId)
      .eq("owner_id", OWNER_ID);
    return NextResponse.json({ rejected: rejectId });
  }

  const { data } = await supabase
    .from("ai_drafts")
    .select("id, raw_prompt, payload, created_at")
    .eq("status", "pending")
    .eq("owner_id", OWNER_ID)
    .order("created_at", { ascending: false });

  return NextResponse.json({ count: data?.length ?? 0, drafts: data ?? [] });
}
