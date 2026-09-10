import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { AiDraftPayload } from "@/lib/types";

const OWNER_ID = process.env.META_OWNER_USER_ID!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://jersey-mart-crm.vercel.app";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function checkAuth(request: NextRequest): boolean {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return false;
  const token = header.slice("Bearer ".length);
  return token === process.env.AI_INTAKE_API_KEY;
}

export async function POST(request: NextRequest) {
  if (!checkAuth(request)) return unauthorized();

  let body: { raw_prompt?: string; payload?: AiDraftPayload };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rawPrompt = String(body.raw_prompt ?? "").trim();
  const payload = body.payload;

  if (!rawPrompt) {
    return NextResponse.json(
      { error: "raw_prompt is required — pass the user's original message." },
      { status: 400 }
    );
  }
  if (!payload?.customer?.name?.trim()) {
    return NextResponse.json(
      { error: "payload.customer.name is required" },
      { status: 400 }
    );
  }
  if (payload.team && payload.team.players.length > 0) {
    for (const p of payload.team.players) {
      if (!p.player_name?.trim()) {
        return NextResponse.json(
          { error: "Every player in payload.team.players needs a player_name" },
          { status: 400 }
        );
      }
    }
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("ai_drafts")
    .insert({
      owner_id: OWNER_ID,
      raw_prompt: rawPrompt,
      payload,
      status: "pending",
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "Failed to save draft", details: error?.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    draft_id: data.id,
    status: "pending_review",
    review_url: `${APP_URL}/ai-drafts`,
    message:
      "Draft saved. Nothing has been created in the CRM yet — the owner must review and approve it at the review URL before it becomes a real customer/order.",
  });
}
