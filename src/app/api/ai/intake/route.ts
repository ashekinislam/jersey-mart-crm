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
  const kind = payload?.kind ?? "new_customer";

  if (!rawPrompt) {
    return NextResponse.json(
      { error: "raw_prompt is required — pass the user's original message." },
      { status: 400 }
    );
  }

  const playerLists =
    kind === "update_existing"
      ? [payload?.add_players, payload?.new_order?.team?.players]
      : [payload?.team?.players];
  for (const players of playerLists) {
    if (!players) continue;
    for (const p of players) {
      if (!p.player_name?.trim()) {
        return NextResponse.json(
          { error: "Every player needs a player_name" },
          { status: 400 }
        );
      }
    }
  }

  const supabase = createServiceClient();

  if (kind === "update_existing") {
    const hint = payload?.customer_name_hint?.trim();
    if (!hint) {
      return NextResponse.json(
        { error: "payload.customer_name_hint is required for kind=update_existing" },
        { status: 400 }
      );
    }

    const { data: matches } = await supabase
      .from("customers")
      .select("id")
      .eq("owner_id", OWNER_ID)
      .ilike("name", `%${hint}%`);

    payload!.matched_customer_id =
      matches && matches.length === 1 ? matches[0].id : null;
  } else if (!payload?.customer?.name?.trim()) {
    return NextResponse.json(
      { error: "payload.customer.name is required" },
      { status: 400 }
    );
  }

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

  const matchNote =
    kind === "update_existing" && payload!.matched_customer_id === null
      ? " Couldn't confidently match the customer by name — the owner will need to pick the right one manually on the review screen."
      : "";

  return NextResponse.json({
    draft_id: data.id,
    status: "pending_review",
    review_url: `${APP_URL}/ai-drafts`,
    message:
      "Draft saved. Nothing has been created or changed in the CRM yet — the owner must review and approve it at the review URL first." +
      matchNote,
  });
}
