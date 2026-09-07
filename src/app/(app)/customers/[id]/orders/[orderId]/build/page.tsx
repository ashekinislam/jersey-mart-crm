import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type {
  Customer,
  Design,
  DesignStage,
  Note,
  Order,
  OrderSummary,
  Player,
  PricingEntry,
  Team,
} from "@/lib/types";
import { markOrderSent } from "../../../../../actions";
import { CopyButton } from "@/components/CopyButton";
import { buildSupplierText } from "@/lib/supplierFormat";

function designStatusLine(designs: Design[], stage: DesignStage, label: string) {
  const forStage = designs.filter((d) => d.stage === stage);
  if (forStage.length === 0) return `${label}: not started`;

  const approved = forStage.find((d) => d.status === "approved");
  if (approved) {
    return `${label}: approved (${new Date(approved.created_at).toLocaleDateString()})`;
  }
  const latest = forStage[0];
  return latest.status === "changes_requested"
    ? `${label}: changes requested`
    : `${label}: pending review`;
}

function buildSummary(
  customer: Customer,
  order: Order,
  notes: Note[],
  pricing: PricingEntry[]
) {
  const lines: string[] = [];
  lines.push(
    `Supplier order — ${customer.name}${order.label ? ` (${order.label})` : ""}`
  );
  lines.push(
    `Contact: ${customer.contact_channel}${
      customer.contact_handle ? ` (${customer.contact_handle})` : ""
    }`
  );
  if (customer.phone) lines.push(`Phone: ${customer.phone}`);
  if (customer.email) lines.push(`Email: ${customer.email}`);
  if (customer.address) lines.push(`Address: ${customer.address}`);
  if (order.deadline)
    lines.push(`Deadline: ${new Date(order.deadline).toLocaleDateString()}`);
  lines.push(`Generated: ${new Date().toLocaleString()}`);
  lines.push("");

  if (customer.fabric_preference) {
    lines.push(`Fabric preference: ${customer.fabric_preference}`);
    lines.push("");
  }

  lines.push("Order details:");
  if (notes.length === 0) {
    lines.push("- (no notes tagged to this order yet)");
  } else {
    for (const note of notes) {
      lines.push(
        `- [${new Date(note.created_at).toLocaleDateString()}] ${note.body}`
      );
    }
  }
  lines.push("");

  lines.push("Pricing agreed with this customer:");
  const latestByProduct = new Map<string, PricingEntry>();
  for (const p of pricing) {
    if (!latestByProduct.has(p.product_name)) latestByProduct.set(p.product_name, p);
  }
  if (latestByProduct.size === 0) {
    lines.push("- (no pricing recorded yet)");
  } else {
    for (const p of latestByProduct.values()) {
      lines.push(`- ${p.product_name}: ${p.currency} ${p.price.toFixed(2)}`);
    }
  }

  return lines.join("\n");
}

export default async function BuildOrderPage({
  params,
}: {
  params: Promise<{ id: string; orderId: string }>;
}) {
  const { id, orderId } = await params;
  const supabase = await createClient();

  const [
    { data: customer },
    { data: order },
    { data: notes },
    { data: pricing },
    { data: summaries },
    { data: teams },
  ] = await Promise.all([
    supabase.from("customers").select("*").eq("id", id).single(),
    supabase.from("orders").select("*").eq("id", orderId).single(),
    supabase
      .from("notes")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true }),
    supabase
      .from("pricing")
      .select("*")
      .eq("customer_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("order_summaries")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false }),
    supabase
      .from("teams")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true }),
  ]);

  if (!customer || !order) notFound();

  const c = customer as Customer;
  const o = order as Order;
  const noteList = (notes ?? []) as Note[];
  const pricingList = (pricing ?? []) as PricingEntry[];
  const summaryList = (summaries ?? []) as OrderSummary[];
  const teamList = (teams ?? []) as Team[];

  const teamIds = teamList.map((t) => t.id);
  const playersByTeam: Record<string, Player[]> = {};
  const designsByTeam: Record<string, Design[]> = {};

  if (teamIds.length > 0) {
    const [{ data: players }, { data: designs }] = await Promise.all([
      supabase
        .from("players")
        .select("*")
        .in("team_id", teamIds)
        .order("created_at", { ascending: true }),
      supabase
        .from("designs")
        .select("*")
        .in("team_id", teamIds)
        .order("created_at", { ascending: false }),
    ]);

    for (const p of (players ?? []) as Player[]) {
      (playersByTeam[p.team_id] ??= []).push(p);
    }
    for (const d of (designs ?? []) as Design[]) {
      (designsByTeam[d.team_id] ??= []).push(d);
    }
  }

  const summary = buildSummary(c, o, noteList, pricingList);
  const markSent = markOrderSent.bind(null, id, orderId, summary);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/customers/${id}/orders/${orderId}`}
          className="text-xs text-slate-500 hover:underline"
        >
          ← {o.label || "order"}
        </Link>
        <h1 className="text-lg font-semibold text-slate-900">
          Supplier order — {c.name}
        </h1>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">
            Compiled summary
          </h2>
          <div className="flex gap-2">
            <CopyButton text={summary} />
            <form action={markSent}>
              <button
                type="submit"
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Mark as sent
              </button>
            </form>
          </div>
        </div>
        <pre className="mt-3 whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm text-slate-800">
          {summary}
        </pre>
      </section>

      {teamList.map((team) => {
        const teamPlayers = playersByTeam[team.id] ?? [];
        const teamDesigns = designsByTeam[team.id] ?? [];
        const teamText = buildSupplierText(teamPlayers);
        if (teamPlayers.length === 0 && teamDesigns.length === 0) return null;

        return (
          <section
            key={team.id}
            className="rounded-lg border border-slate-200 bg-white p-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">
                {team.team_name}
              </h2>
              {teamText && <CopyButton text={teamText} />}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {designStatusLine(teamDesigns, "ai_concept", "AI concept")} ·{" "}
              {designStatusLine(teamDesigns, "machine_ready", "Machine-ready mockup")}
            </p>
            {teamText ? (
              <pre className="mt-3 whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm text-slate-800">
                {teamText}
              </pre>
            ) : (
              <p className="mt-3 text-sm text-slate-500">No players yet.</p>
            )}
          </section>
        );
      })}

      {summaryList.length > 0 && (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">
            Order history
          </h2>
          <div className="mt-3 space-y-3">
            {summaryList.map((s) => (
              <details key={s.id} className="rounded-md border border-slate-100 bg-slate-50 p-3">
                <summary className="cursor-pointer text-sm font-medium text-slate-800">
                  {s.status === "sent" ? "Sent" : s.status} ·{" "}
                  {new Date(s.sent_at ?? s.created_at).toLocaleString()}
                </summary>
                <pre className="mt-2 whitespace-pre-wrap text-xs text-slate-600">
                  {s.summary_text}
                </pre>
              </details>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
