import { createClient } from "@/lib/supabase/server";
import {
  CUSTOMER_STATUSES,
  STATUS_LABELS,
  type AiDraft,
  type AiDraftPlayer,
  type Player,
} from "@/lib/types";
import { approveAiDraft, rejectAiDraft } from "./actions";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { buildSupplierText } from "@/lib/supplierFormat";

const CONTACT_CHANNEL_OPTIONS = [
  "facebook",
  "instagram",
  "email",
  "phone",
  "other",
] as const;

function playersToText(players: AiDraftPlayer[]): string {
  const asPlayers = players.map((p) => ({
    id: "",
    owner_id: "",
    team_id: "",
    player_name: p.player_name,
    name_on_back: p.name_on_back ?? null,
    jersey_size: p.jersey_size ?? null,
    shorts_size: p.shorts_size ?? null,
    jersey_number: p.jersey_number ?? null,
    notes: p.notes ?? null,
    created_at: "",
  })) as Player[];
  return buildSupplierText(asPlayers);
}

export default async function AiDraftsPage() {
  const supabase = await createClient();

  const { data: pending } = await supabase
    .from("ai_drafts")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  const { data: reviewed } = await supabase
    .from("ai_drafts")
    .select("*")
    .in("status", ["approved", "rejected"])
    .order("reviewed_at", { ascending: false })
    .limit(10);

  const pendingList = (pending ?? []) as AiDraft[];
  const reviewedList = (reviewed ?? []) as AiDraft[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">AI drafts</h1>
        <p className="mt-1 text-sm text-slate-500">
          Customers and orders submitted by ChatGPT land here first. Review
          and edit the details below, then approve to create the real
          records — nothing is saved to the CRM until you do.
        </p>
      </div>

      {pendingList.length === 0 && (
        <p className="rounded-lg border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
          No drafts waiting for review.
        </p>
      )}

      {pendingList.map((draft) => {
        const approveWithId = approveAiDraft.bind(null, draft.id);
        const rejectWithId = rejectAiDraft.bind(null, draft.id);
        const c = draft.payload.customer;
        const order = draft.payload.order;
        const team = draft.payload.team;

        return (
          <section
            key={draft.id}
            className="rounded-lg border border-slate-200 bg-white p-4"
          >
            <p className="rounded-md bg-slate-50 p-3 text-xs italic text-slate-500">
              &ldquo;{draft.raw_prompt}&rdquo;
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Submitted {new Date(draft.created_at).toLocaleString()}
            </p>

            <form action={approveWithId} className="mt-4 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Customer
                </h3>
                <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-600">
                      Name
                    </label>
                    <input
                      name="name"
                      required
                      defaultValue={c.name}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600">
                      Status
                    </label>
                    <select
                      name="status"
                      defaultValue={c.status ?? "lead"}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                    >
                      {CUSTOMER_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600">
                      Channel
                    </label>
                    <select
                      name="contact_channel"
                      defaultValue={c.contact_channel ?? "phone"}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                    >
                      {CONTACT_CHANNEL_OPTIONS.map((ch) => (
                        <option key={ch} value={ch}>
                          {ch}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600">
                      Handle / contact
                    </label>
                    <input
                      name="contact_handle"
                      defaultValue={c.contact_handle ?? ""}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600">
                      Phone
                    </label>
                    <input
                      name="phone"
                      defaultValue={c.phone ?? ""}
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
                      defaultValue={c.email ?? ""}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600">
                      Address
                    </label>
                    <input
                      name="address"
                      defaultValue={c.address ?? ""}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600">
                      State
                    </label>
                    <input
                      name="state"
                      defaultValue={c.state ?? ""}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-600">
                      Fabric preference
                    </label>
                    <input
                      name="fabric_preference"
                      defaultValue={c.fabric_preference ?? ""}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                    />
                  </div>
                </div>
              </div>

              {(order || team) && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Order
                  </h3>
                  <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-600">
                        Label (optional)
                      </label>
                      <input
                        name="order_label"
                        defaultValue={order?.label ?? ""}
                        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600">
                        Deadline
                      </label>
                      <input
                        name="deadline"
                        type="date"
                        defaultValue={order?.deadline ?? ""}
                        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}

              {team && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Team & players
                  </h3>
                  <div className="mt-2">
                    <label className="block text-xs font-medium text-slate-600">
                      Team name
                    </label>
                    <input
                      name="team_name"
                      defaultValue={team.team_name}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                    />
                  </div>
                  <div className="mt-2">
                    <label className="block text-xs font-medium text-slate-600">
                      Players (one per line — edit freely before approving)
                    </label>
                    <textarea
                      name="players_text"
                      rows={Math.max(4, team.players.length + 1)}
                      defaultValue={playersToText(team.players)}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 font-mono text-xs"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
                <button
                  type="submit"
                  className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
                >
                  Approve & create
                </button>
              </div>
            </form>

            <form action={rejectWithId} className="mt-2">
              <ConfirmSubmitButton
                confirmMessage="Reject this draft? It won't create anything in the CRM."
                className="text-xs text-slate-400 hover:text-red-600"
              >
                Reject draft
              </ConfirmSubmitButton>
            </form>
          </section>
        );
      })}

      {reviewedList.length > 0 && (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">
            Recently reviewed
          </h2>
          <div className="mt-3 space-y-2">
            {reviewedList.map((draft) => (
              <div
                key={draft.id}
                className="flex items-center justify-between rounded-md border border-slate-100 bg-slate-50 p-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate text-slate-700">
                    {draft.payload.customer.name}
                  </p>
                  <p className="truncate text-xs text-slate-400">
                    &ldquo;{draft.raw_prompt}&rdquo;
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    draft.status === "approved"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {draft.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
