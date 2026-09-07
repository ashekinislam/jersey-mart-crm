import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type {
  Customer,
  Design,
  DesignStage,
  Note,
  Player,
  PricingEntry,
  SupplierOrder,
} from "@/lib/types";
import { markOrderSent } from "../../../actions";
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
  notes: Note[],
  pricing: PricingEntry[],
  designs: Design[]
) {
  const lines: string[] = [];
  lines.push(`Supplier order — ${customer.name}`);
  lines.push(
    `Contact: ${customer.contact_channel}${
      customer.contact_handle ? ` (${customer.contact_handle})` : ""
    }`
  );
  if (customer.phone) lines.push(`Phone: ${customer.phone}`);
  if (customer.email) lines.push(`Email: ${customer.email}`);
  if (customer.address) lines.push(`Address: ${customer.address}`);
  lines.push(`Generated: ${new Date().toLocaleString()}`);
  lines.push("");

  if (customer.fabric_preference) {
    lines.push(`Fabric preference: ${customer.fabric_preference}`);
  }
  lines.push(designStatusLine(designs, "ai_concept", "AI concept"));
  lines.push(designStatusLine(designs, "machine_ready", "Machine-ready mockup"));
  lines.push("");

  lines.push("Order details:");
  if (notes.length === 0) {
    lines.push("- (no notes marked as order-relevant yet)");
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
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: customer },
    { data: notes },
    { data: pricing },
    { data: pastOrders },
    { data: players },
    { data: designs },
  ] = await Promise.all([
    supabase.from("customers").select("*").eq("id", id).single(),
    supabase
      .from("notes")
      .select("*")
      .eq("customer_id", id)
      .eq("is_order_relevant", true)
      .order("created_at", { ascending: true }),
    supabase
      .from("pricing")
      .select("*")
      .eq("customer_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("orders")
      .select("*")
      .eq("customer_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("players")
      .select("*")
      .eq("customer_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("designs")
      .select("*")
      .eq("customer_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (!customer) notFound();

  const c = customer as Customer;
  const noteList = (notes ?? []) as Note[];
  const pricingList = (pricing ?? []) as PricingEntry[];
  const orderList = (pastOrders ?? []) as SupplierOrder[];
  const playerList = (players ?? []) as Player[];
  const designList = (designs ?? []) as Design[];

  const summary = buildSummary(c, noteList, pricingList, designList);
  const markSent = markOrderSent.bind(null, id, summary);

  const teamText = buildSupplierText(playerList);

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">
        Supplier order — {c.name}
      </h1>

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

      {playerList.length > 0 && (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              Team order (supplier format)
            </h2>
            <CopyButton text={teamText} />
          </div>
          <pre className="mt-3 whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm text-slate-800">
            {teamText}
          </pre>
        </section>
      )}

      {orderList.length > 0 && (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">
            Order history
          </h2>
          <div className="mt-3 space-y-3">
            {orderList.map((o) => (
              <details key={o.id} className="rounded-md border border-slate-100 bg-slate-50 p-3">
                <summary className="cursor-pointer text-sm font-medium text-slate-800">
                  {o.status === "sent" ? "Sent" : o.status} ·{" "}
                  {new Date(o.sent_at ?? o.created_at).toLocaleString()}
                </summary>
                <pre className="mt-2 whitespace-pre-wrap text-xs text-slate-600">
                  {o.summary_text}
                </pre>
              </details>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
