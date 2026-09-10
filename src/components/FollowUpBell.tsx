import { createClient } from "@/lib/supabase/server";
import type { Customer, FollowUp } from "@/lib/types";
import { FollowUpBellClient, type PendingFollowUp } from "./FollowUpBellClient";

export async function FollowUpBell() {
  const supabase = await createClient();
  const { data: followUps } = await supabase
    .from("follow_ups")
    .select("*")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  const list = (followUps ?? []) as FollowUp[];
  const latestActionableByCustomer = new Map<string, FollowUp>();
  for (const f of list) {
    if (f.status !== "other" && !latestActionableByCustomer.has(f.customer_id)) {
      latestActionableByCustomer.set(f.customer_id, f);
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const pending: { customerId: string; status: "scheduled_call" | "scheduled_email"; dueDate: string }[] = [];
  for (const [customerId, f] of latestActionableByCustomer) {
    if (
      (f.status === "scheduled_call" || f.status === "scheduled_email") &&
      f.due_date &&
      f.due_date <= today
    ) {
      pending.push({ customerId, status: f.status, dueDate: f.due_date });
    }
  }

  if (pending.length === 0) return null;

  const { data: customers } = await supabase
    .from("customers")
    .select("id, name")
    .in(
      "id",
      pending.map((p) => p.customerId)
    );
  const nameById = new Map(
    ((customers ?? []) as Pick<Customer, "id" | "name">[]).map((c) => [
      c.id,
      c.name,
    ])
  );

  const items: PendingFollowUp[] = pending
    .map((p) => ({
      ...p,
      customerName: nameById.get(p.customerId) ?? "Unknown customer",
    }))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  return <FollowUpBellClient items={items} />;
}
