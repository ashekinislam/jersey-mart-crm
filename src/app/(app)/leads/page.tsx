import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  META_PLATFORM_COLORS,
  META_PLATFORM_LABELS,
  type MetaConversation,
} from "@/lib/types";
import { deleteLead } from "./actions";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";

const SORT_OPTIONS = [
  { value: "newest_lead", label: "Newest lead first" },
  { value: "oldest_lead", label: "Oldest lead first" },
  { value: "recent_activity", label: "Most recent activity" },
];

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; sort?: string }>;
}) {
  const { filter = "unconverted", sort = "newest_lead" } = await searchParams;

  const supabase = await createClient();
  let query = supabase.from("meta_conversations").select("*");

  if (sort === "oldest_lead") {
    query = query.order("created_at", { ascending: true });
  } else if (sort === "recent_activity") {
    query = query.order("last_message_at", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }

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
        <select
          name="sort"
          defaultValue={sort}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        >
          {SORT_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
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
        {list.map((conversation) => {
          const deleteLeadWithId = deleteLead.bind(null, conversation.id);
          return (
            <div
              key={conversation.id}
              className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50"
            >
              <Link
                href={
                  conversation.customer_id
                    ? `/customers/${conversation.customer_id}`
                    : `/leads/${conversation.id}`
                }
                className="min-w-0 flex-1"
              >
                <p className="truncate font-medium text-slate-900">
                  {conversation.external_user_name || conversation.external_user_id}
                </p>
                <p className="truncate text-sm text-slate-500">
                  Lead generated {new Date(conversation.created_at).toLocaleDateString()}
                  {conversation.last_message_at &&
                    ` · Last activity ${new Date(conversation.last_message_at).toLocaleString()}`}
                </p>
              </Link>
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
                {!conversation.customer_id && (
                  <form action={deleteLeadWithId}>
                    <ConfirmSubmitButton
                      confirmMessage="Delete this lead? Its chat history will be gone for good."
                      className="text-xs text-slate-400 hover:text-red-600"
                    >
                      Delete
                    </ConfirmSubmitButton>
                  </form>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
