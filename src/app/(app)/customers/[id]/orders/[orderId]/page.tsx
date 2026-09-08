import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Customer, Order } from "@/lib/types";
import { deleteOrder } from "../../../../actions";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { OrderTrackingCard } from "@/components/OrderTrackingCard";
import { OrderCostsCard } from "@/components/OrderCostsCard";
import { OrderTeamsSection } from "@/components/OrderTeamsSection";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string; orderId: string }>;
}) {
  const { id, orderId } = await params;
  const supabase = await createClient();

  const [{ data: customer }, { data: order }] = await Promise.all([
    supabase.from("customers").select("*").eq("id", id).single(),
    supabase.from("orders").select("*").eq("id", orderId).single(),
  ]);

  if (!customer || !order) notFound();

  const c = customer as Customer;
  const o = order as Order;

  let invoiceUrl: string | null = null;
  if (o.invoice_storage_path) {
    const { data: signed } = await supabase.storage
      .from("invoices")
      .createSignedUrl(o.invoice_storage_path, 3600);
    invoiceUrl = signed?.signedUrl ?? null;
  }

  const deleteOrderWithIds = deleteOrder.bind(null, id, orderId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`/customers/${id}`}
            className="text-xs text-slate-500 hover:underline"
          >
            ← {c.name}
          </Link>
          <h1 className="text-lg font-semibold text-slate-900">
            {o.label || `Order — ${new Date(o.order_date).toLocaleDateString()}`}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/customers/${id}/orders/${orderId}/build`}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Build supplier order
          </Link>
          <form action={deleteOrderWithIds}>
            <ConfirmSubmitButton
              confirmMessage="Delete this order? This removes all its teams, players, designs, and history. This can't be undone."
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-500 hover:border-red-300 hover:text-red-600"
            >
              Delete order
            </ConfirmSubmitButton>
          </form>
        </div>
      </div>

      <OrderTrackingCard
        customerId={id}
        orderId={orderId}
        order={o}
        invoiceUrl={invoiceUrl}
      />
      <OrderCostsCard customerId={id} orderId={orderId} order={o} />
      <OrderTeamsSection customerId={id} orderId={orderId} />
    </div>
  );
}
