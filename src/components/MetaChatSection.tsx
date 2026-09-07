import { createClient } from "@/lib/supabase/server";
import {
  META_PLATFORM_COLORS,
  META_PLATFORM_LABELS,
  type MetaConversation,
  type MetaMessage,
  type Order,
  type Team,
} from "@/lib/types";
import { saveMessageAsDesign } from "@/app/(app)/leads/actions";
import { ConversationThread } from "@/components/ConversationThread";

export async function MetaChatSection({ customerId }: { customerId: string }) {
  const supabase = await createClient();

  const { data: conversations } = await supabase
    .from("meta_conversations")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: true });

  const conversationList = (conversations ?? []) as MetaConversation[];
  if (conversationList.length === 0) return null;

  const conversationIds = conversationList.map((c) => c.id);
  const { data: messages } = await supabase
    .from("meta_messages")
    .select("*")
    .in("conversation_id", conversationIds)
    .order("sent_at", { ascending: true });

  const messageList = (messages ?? []) as MetaMessage[];

  const imageUrls: Record<string, string> = {};
  const attachmentPaths = messageList
    .map((m) => m.attachment_storage_path)
    .filter((p): p is string => !!p);
  if (attachmentPaths.length > 0) {
    const { data: signedUrls } = await supabase.storage
      .from("meta-attachments")
      .createSignedUrls(attachmentPaths, 3600);
    for (const s of signedUrls ?? []) {
      if (s.signedUrl && s.path) imageUrls[s.path] = s.signedUrl;
    }
  }

  const { data: orders } = await supabase
    .from("orders")
    .select("id, label, created_at")
    .eq("customer_id", customerId);
  const orderList = (orders ?? []) as Pick<Order, "id" | "label" | "created_at">[];

  let teamOptions: { id: string; teamName: string; orderId: string }[] = [];
  if (orderList.length > 0) {
    const { data: teams } = await supabase
      .from("teams")
      .select("*")
      .in(
        "order_id",
        orderList.map((o) => o.id)
      );
    teamOptions = ((teams ?? []) as Team[]).map((t) => {
      const order = orderList.find((o) => o.id === t.order_id);
      const orderLabel =
        order?.label || new Date(order?.created_at ?? t.created_at).toLocaleDateString();
      return { id: t.id, orderId: t.order_id, teamName: `${orderLabel} — ${t.team_name}` };
    });
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-slate-900">
          Imported chat history
        </h2>
        {conversationList.map((c) => (
          <span
            key={c.id}
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${META_PLATFORM_COLORS[c.platform]}`}
          >
            {META_PLATFORM_LABELS[c.platform]}
          </span>
        ))}
      </div>

      <div className="mt-3 max-h-96 overflow-y-auto rounded-md border border-slate-100 bg-slate-50/50 p-3">
        <ConversationThread
          messages={messageList}
          imageUrls={imageUrls}
          renderBelowImage={(message) =>
            teamOptions.length > 0 ? (
              <form
                action={saveMessageAsDesign.bind(null, customerId, message.id)}
                className="mt-2 space-y-1 border-t border-white/20 pt-2"
              >
                <select
                  name="team_id"
                  className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-900"
                  defaultValue={teamOptions[0].id}
                >
                  {teamOptions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.teamName}
                    </option>
                  ))}
                </select>
                <select
                  name="stage"
                  defaultValue="ai_concept"
                  className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-900"
                >
                  <option value="ai_concept">AI concept</option>
                  <option value="machine_ready">Machine-ready mockup</option>
                </select>
                <button
                  type="submit"
                  className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Save as design
                </button>
              </form>
            ) : (
              <p className="mt-2 border-t border-white/20 pt-2 text-[10px] italic opacity-75">
                Create an order + team first to save this as a design.
              </p>
            )
          }
        />
      </div>
    </section>
  );
}
