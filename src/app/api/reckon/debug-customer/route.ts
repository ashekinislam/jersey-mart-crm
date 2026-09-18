import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  getReckonConnection,
  getValidAccessToken,
  reckonApiGet,
} from "@/lib/reckon";

// TEMPORARY -- diagnosing what fields Reckon's customer/contact records
// expose, to prefill new-customer drafts. Delete this route once done.

const OWNER_ID = process.env.META_OWNER_USER_ID!;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const connection = await getReckonConnection(supabase, OWNER_ID);
  if (!connection?.book_id) {
    return NextResponse.json({ error: "not_ready" }, { status: 400 });
  }

  const accessToken = await getValidAccessToken(supabase, connection);
  if (!accessToken) {
    return NextResponse.json({ error: "token_failed" }, { status: 400 });
  }

  const invoicesResult = await reckonApiGet(
    accessToken,
    connection.book_id,
    "/invoices?page=1&perpage=100"
  );
  const invoices =
    ((invoicesResult.body as { list?: { id: string; invoiceNumber: string; customer: { id: string; name: string } }[] })
      ?.list ?? []);

  const byCustomerId = new Map<string, { id: string; name: string }>();
  for (const inv of invoices) {
    if (inv.customer?.id) byCustomerId.set(inv.customer.id, inv.customer);
  }

  const details: Record<string, unknown> = {};
  for (const [customerId, customer] of byCustomerId) {
    const customersResult = await reckonApiGet(
      accessToken,
      connection.book_id,
      `/customers/${customerId}`
    );
    const contactsResult = await reckonApiGet(
      accessToken,
      connection.book_id,
      `/contacts/${customerId}`
    );
    details[customerId] = {
      name: customer.name,
      customersEndpoint: { status: customersResult.status, body: customersResult.body },
      contactsEndpoint: { status: contactsResult.status, body: contactsResult.body },
    };
  }

  return NextResponse.json({ invoiceCount: invoices.length, details });
}
