import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * READ-ONLY sales feed for the Jersey Mart marketing agent (runs on the owner's PC).
 *
 * The agent matches these orders to the enquiries it captured from ads, so it can see
 * which ads led to PAID orders (and at what margin). It never writes anything here:
 * this route only SELECTs, with an explicit, narrow column list (no RLS with the
 * service-role client, see src/lib/supabase/service.ts).
 *
 * Auth: Authorization: Bearer <AGENT_API_KEY>  (env var, set in Vercel).
 * Query: ?days=120  (orders dated within the last N days, max 400)
 */
const OWNER_ID = process.env.META_OWNER_USER_ID!;

function authorized(request: NextRequest): boolean {
  const expected = process.env.AGENT_API_KEY;
  const header = request.headers.get("authorization") ?? "";
  if (!expected || !header.startsWith("Bearer ")) return false;
  const given = Buffer.from(header.slice("Bearer ".length));
  const want = Buffer.from(expected);
  return given.length === want.length && crypto.timingSafeEqual(given, want);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const days = Math.min(Math.max(Number(request.nextUrl.searchParams.get("days")) || 120, 1), 400);
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const supabase = createServiceClient();

  const { data: orders, error } = await supabase
    .from("orders")
    .select(
      "id, customer_id, order_date, created_at, updated_at, order_status, payment_status, sale_amount, reckon_total, reckon_balance, manual_total, manual_paid, supplier_cost, freight_cost, product_types"
    )
    .eq("owner_id", OWNER_ID)
    .gte("order_date", since)
    .order("order_date", { ascending: false })
    .limit(1000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const orderIds = (orders ?? []).map((o) => o.id);
  const customerIds = [...new Set((orders ?? []).map((o) => o.customer_id))];

  const [customersRes, teamsRes, convRes] = await Promise.all([
    customerIds.length
      ? supabase
          .from("customers")
          .select("id, name, email, phone, contact_channel, contact_handle, reckon_alias, created_at")
          .eq("owner_id", OWNER_ID)
          .in("id", customerIds)
      : Promise.resolve({ data: [], error: null }),
    orderIds.length
      ? supabase.from("teams").select("id, order_id, team_name").eq("owner_id", OWNER_ID).in("order_id", orderIds)
      : Promise.resolve({ data: [], error: null }),
    customerIds.length
      ? supabase
          .from("meta_conversations")
          .select("customer_id, platform, external_user_id")
          .eq("owner_id", OWNER_ID)
          .in("customer_id", customerIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const firstError = customersRes.error || teamsRes.error || convRes.error;
  if (firstError) return NextResponse.json({ error: firstError.message }, { status: 500 });

  const teams = teamsRes.data ?? [];
  const teamIds = teams.map((t) => t.id);
  const playerCounts = new Map<string, number>();
  if (teamIds.length) {
    const { data: players, error: pErr } = await supabase
      .from("players")
      .select("team_id")
      .eq("owner_id", OWNER_ID)
      .in("team_id", teamIds);
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
    for (const p of players ?? []) playerCounts.set(p.team_id, (playerCounts.get(p.team_id) ?? 0) + 1);
  }

  const customers = new Map((customersRes.data ?? []).map((c) => [c.id, { ...c, meta_ids: [] as { platform: string; id: string }[] }]));
  for (const conv of convRes.data ?? []) {
    customers.get(conv.customer_id)?.meta_ids.push({ platform: conv.platform, id: conv.external_user_id });
  }

  const result = (orders ?? []).map((o) => {
    const orderTeams = teams.filter((t) => t.order_id === o.id);
    const units = orderTeams.reduce((sum, t) => sum + (playerCounts.get(t.id) ?? 0), 0);
    return {
      ...o,
      total: o.reckon_total ?? o.manual_total ?? o.sale_amount ?? null,
      units: units || null,
      team_names: orderTeams.map((t) => t.team_name),
      customer: customers.get(o.customer_id) ?? null,
    };
  });

  return NextResponse.json({ since, orders: result });
}
