import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Customer, Design, Order, Player, Team } from "@/lib/types";
import {
  addPlayer,
  deletePlayer,
  deleteTeam,
  importPlayers,
  importPlayersFromText,
  updatePlayer,
} from "../../../../../../actions";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { DesignsSection } from "@/components/DesignsSection";
import { FILE_INPUT_CLASS } from "@/lib/ui";

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ id: string; orderId: string; teamId: string }>;
}) {
  const { id, orderId, teamId } = await params;
  const supabase = await createClient();

  const [{ data: customer }, { data: order }, { data: team }, { data: players }, { data: designs }] =
    await Promise.all([
      supabase.from("customers").select("*").eq("id", id).single(),
      supabase.from("orders").select("*").eq("id", orderId).single(),
      supabase.from("teams").select("*").eq("id", teamId).single(),
      supabase
        .from("players")
        .select("*")
        .eq("team_id", teamId)
        .order("created_at", { ascending: true }),
      supabase
        .from("designs")
        .select("*")
        .eq("team_id", teamId)
        .order("created_at", { ascending: false }),
    ]);

  if (!customer || !order || !team) notFound();

  const c = customer as Customer;
  const o = order as Order;
  const t = team as Team;
  const playerList = (players ?? []) as Player[];
  const designList = (designs ?? []) as Design[];

  const designUrls: Record<string, string> = {};
  if (designList.length > 0) {
    const { data: signedUrls } = await supabase.storage
      .from("designs")
      .createSignedUrls(
        designList.map((d) => d.storage_path),
        3600
      );
    for (const s of signedUrls ?? []) {
      if (s.signedUrl && s.path) designUrls[s.path] = s.signedUrl;
    }
  }

  const importPlayersWithIds = importPlayers.bind(null, id, orderId, teamId);
  const importPlayersFromTextWithIds = importPlayersFromText.bind(
    null,
    id,
    orderId,
    teamId
  );
  const addPlayerWithIds = addPlayer.bind(null, id, orderId, teamId);
  const deleteTeamWithIds = deleteTeam.bind(null, id, orderId, teamId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`/customers/${id}/orders/${orderId}`}
            className="text-xs text-slate-500 hover:underline"
          >
            ← {c.name} · {o.label || "order"}
          </Link>
          <h1 className="text-lg font-semibold text-slate-900">
            {t.team_name}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/customers/${id}/orders/${orderId}/build`}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Build supplier order
          </Link>
          <form action={deleteTeamWithIds}>
            <ConfirmSubmitButton
              confirmMessage={`Delete ${t.team_name}? This removes its roster and designs too. This can't be undone.`}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-500 hover:border-red-300 hover:text-red-600"
            >
              Delete team
            </ConfirmSubmitButton>
          </form>
        </div>
      </div>

      {/* Roster */}
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Roster</h2>
        <p className="mt-1 text-xs text-slate-500">
          Import the filled-in Player Order Form (Excel), paste an
          already-converted supplier-format list, or add players manually.
        </p>

        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <form action={importPlayersWithIds} className="space-y-2">
            <label className="block text-xs font-medium text-slate-600">
              Import from Excel
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="file"
                name="file"
                accept=".xlsx,.xls"
                required
                className={FILE_INPUT_CLASS}
              />
              <button
                type="submit"
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Import
              </button>
            </div>
          </form>

          <form action={importPlayersFromTextWithIds} className="space-y-2">
            <label className="block text-xs font-medium text-slate-600">
              Paste supplier-format text (e.g. from ChatGPT)
            </label>
            <textarea
              name="text"
              rows={3}
              placeholder={"1. ALEX-11/12 বছর বয়স-10\n2. OLLIE-11/12 বছর বয়স-9"}
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
            <button
              type="submit"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Import
            </button>
          </form>
        </div>

        {playerList.length > 0 && (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {playerList.map((player) => {
              const updatePlayerWithIds = updatePlayer.bind(
                null,
                id,
                orderId,
                teamId,
                player.id
              );
              const deletePlayerWithIds = deletePlayer.bind(
                null,
                id,
                orderId,
                teamId,
                player.id
              );
              return (
                <form
                  key={player.id}
                  action={updatePlayerWithIds}
                  className="rounded-md border border-slate-100 bg-slate-50 p-3 space-y-1.5"
                >
                  <input
                    name="player_name"
                    defaultValue={player.player_name}
                    placeholder="Player name"
                    required
                    className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm font-medium"
                  />
                  <div className="grid grid-cols-2 gap-1.5">
                    <input
                      name="name_on_back"
                      defaultValue={player.name_on_back ?? ""}
                      placeholder="Name on back"
                      className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                    />
                    <input
                      name="jersey_number"
                      defaultValue={player.jersey_number ?? ""}
                      placeholder="Jersey #"
                      className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                    />
                    <input
                      name="jersey_size"
                      defaultValue={player.jersey_size ?? ""}
                      placeholder="Jersey size"
                      className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                    />
                    <input
                      name="shorts_size"
                      defaultValue={player.shorts_size ?? ""}
                      placeholder="Shorts size"
                      className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                    />
                  </div>
                  <input
                    name="notes"
                    defaultValue={player.notes ?? ""}
                    placeholder="Notes"
                    className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                  />
                  <div className="flex items-center justify-between pt-0.5">
                    <button
                      type="submit"
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-white"
                    >
                      Save
                    </button>
                    <button
                      type="submit"
                      formAction={deletePlayerWithIds}
                      className="text-xs text-slate-400 hover:text-red-600"
                    >
                      Delete
                    </button>
                  </div>
                </form>
              );
            })}
          </div>
        )}

        <details className="mt-4">
          <summary className="cursor-pointer text-xs font-medium text-slate-600">
            Add a player manually
          </summary>
          <form
            action={addPlayerWithIds}
            className="mt-2 flex flex-wrap items-end gap-2"
          >
            <div>
              <label className="block text-xs font-medium text-slate-600">
                Player name
              </label>
              <input
                name="player_name"
                required
                className="mt-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600">
                Name on back
              </label>
              <input
                name="name_on_back"
                className="mt-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600">
                Jersey size
              </label>
              <input
                name="jersey_size"
                placeholder="e.g. Kids 12 or L"
                className="mt-1 w-28 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600">
                Shorts size
              </label>
              <input
                name="shorts_size"
                className="mt-1 w-28 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600">
                Jersey #
              </label>
              <input
                name="jersey_number"
                className="mt-1 w-16 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              />
            </div>
            <button
              type="submit"
              className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              Add player
            </button>
          </form>
        </details>
      </section>

      <DesignsSection
        customerId={id}
        orderId={orderId}
        teamId={teamId}
        designs={designList}
        urls={designUrls}
      />
    </div>
  );
}
