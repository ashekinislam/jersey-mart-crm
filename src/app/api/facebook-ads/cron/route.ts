import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { runFacebookAdsSync } from "@/lib/facebookAdsSync";
import { addDays, brisbaneToday } from "@/lib/costs";

const OWNER_ID = process.env.META_OWNER_USER_ID!;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const today = brisbaneToday();
  const summary = await runFacebookAdsSync(supabase, OWNER_ID, {
    since: addDays(today, -13),
    until: today,
  });

  return NextResponse.json(summary, { status: summary.ok ? 200 : 500 });
}
