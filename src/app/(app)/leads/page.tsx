import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  META_PLATFORM_COLORS,
  META_PLATFORM_LABELS,
  type MetaConversation,
} from "@/lib/types";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter = "unconverted" } = await searchParams;

  const supabase = await createClient();
  let query = supabase
    .from("meta_conversations")
    .select("*")
    .order("last_message_at", { ascending: false });

  if (filter === "unconverted") query = query.is("customer_id", null);

  const { data: conversations } = await query;
  const list = (conversations ?? []) as MetaConversation[];

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Leads inbox</h1>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Facebook and Instagram conversations flow in here automatically.
        Click one to see the chat and convert it into a customer.
      </p>

      <form className="mt-4 flex flex-wrap gap-2" method="get">
        <select
          name="filter"
          defaultValue={filter}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        >
          <option value="unconverted">New (not yet converted)</option>
          <option value="all">All conversations</option>
        </select>
        <button
          type="submit"
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-white"
        >
          Filter
        </button>
      </form>

      <div className="mt-6 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {list.length === 0 && (
          <p className="p-6 text-center text-sm text-slate-500">
            No conversations yet. Once your Facebook Page or Instagram
            account is connected, new messages will show up here.
          </p>
        )}
        {list.map((conversation) => (
          <Link
            key={conversation.id}
            href={
              conversation.customer_id
                ? `/customers/${conversation.customer_id}`
                : `/leads/${conversation.id}`
            }
            className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50"
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-900">
                {conversation.external_user_name || conversation.external_user_id}
              </p>
              <p className="truncate text-sm text-slate-500">
                {conversation.last_message_at
                  ? new Date(conversation.last_message_at).toLocaleString()
                  : "No messages yet"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {conversation.customer_id && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                  Converted
                </span>
              )}
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${META_PLATFORM_COLORS[conversation.platform]}`}
              >
                {META_PLATFORM_LABELS[conversation.platform]}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
