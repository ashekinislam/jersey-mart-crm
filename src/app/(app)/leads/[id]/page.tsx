import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  META_PLATFORM_COLORS,
  META_PLATFORM_LABELS,
  type MetaConversation,
  type MetaMessage,
} from "@/lib/types";
import { convertLead } from "../actions";
import { ConversationThread } from "@/components/ConversationThread";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: conversation } = await supabase
    .from("meta_conversations")
    .select("*")
    .eq("id", id)
    .single();
  if (!conversation) notFound();

  const c = conversation as MetaConversation;
  if (c.customer_id) redirect(`/customers/${c.customer_id}`);

  const { data: messages } = await supabase
    .from("meta_messages")
    .select("*")
    .eq("conversation_id", id)
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

  const convertLeadWithId = convertLead.bind(null, id);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/leads" className="text-xs text-slate-500 hover:underline">
          ← Leads inbox
        </Link>
        <div className="mt-1 flex items-center gap-2">
          <h1 className="text-lg font-semibold text-slate-900">
            {c.external_user_name || c.external_user_id}
          </h1>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${META_PLATFORM_COLORS[c.platform]}`}
          >
            {META_PLATFORM_LABELS[c.platform]}
          </span>
        </div>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Chat history</h2>
        <div className="mt-3 max-h-96 overflow-y-auto rounded-md border border-slate-100 bg-slate-50/50 p-3">
          <ConversationThread messages={messageList} imageUrls={imageUrls} />
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">
          Convert to customer
        </h2>
        <form
          action={convertLeadWithId}
          className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          <div>
            <label className="block text-xs font-medium text-slate-600">
              Name
            </label>
            <input
              name="name"
              required
              defaultValue={c.external_user_name ?? ""}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">
              Handle / contact
            </label>
            <input
              name="contact_handle"
              defaultValue={c.external_user_name ?? c.external_user_id}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">
              Phone
            </label>
            <input
              name="phone"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600">
              Email
            </label>
            <input
              name="email"
              type="email"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              Convert to customer
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
