import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Design, Player, Team } from "@/lib/types";
import { addTeam, deleteTeam } from "@/app/(app)/actions";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { TeamRoster } from "@/components/TeamRoster";
import { DesignsSection } from "@/components/DesignsSection";

/**
 * Shows an order's teams. If there's exactly one team, its roster and
 * designs are inlined directly (no extra click) — most orders only have
 * one. With zero or multiple teams, a list/create form is shown instead.
 */
export async function OrderTeamsSection({
  customerId,
  orderId,
}: {
  customerId: string;
  orderId: string;
}) {
  const supabase = await createClient();
  const { data: teams } = await supabase
    .from("teams")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  const teamList = (teams ?? []) as Team[];
  const addTeamWithIds = addTeam.bind(null, customerId, orderId);

  if (teamList.length === 1) {
    const team = teamList[0];
    const [{ data: players }, { data: designs }] = await Promise.all([
      supabase
        .from("players")
        .select("*")
        .eq("team_id", team.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("designs")
        .select("*")
        .eq("team_id", team.id)
        .order("created_at", { ascending: false }),
    ]);

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

    const deleteTeamWithIds = deleteTeam.bind(null, customerId, orderId, team.id);

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">
            Team: {team.team_name}
          </h2>
          <form action={deleteTeamWithIds}>
            <ConfirmSubmitButton
              confirmMessage={`Delete ${team.team_name}? This removes its roster and designs too.`}
              className="text-xs text-slate-400 hover:text-red-600"
            >
              Delete team
            </ConfirmSubmitButton>
          </form>
        </div>
        <TeamRoster
          customerId={customerId}
          orderId={orderId}
          teamId={team.id}
          players={playerList}
        />
        <DesignsSection
          customerId={customerId}
          orderId={orderId}
          teamId={team.id}
          designs={designList}
          urls={designUrls}
        />
      </div>
    );
  }

  const teamIds = teamList.map((t) => t.id);
  const playerCounts: Record<string, number> = {};
  const designSummaries: Record<string, { approved: number; total: number }> = {};

  if (teamIds.length > 0) {
    const [{ data: players }, { data: designs }] = await Promise.all([
      supabase.from("players").select("id, team_id").in("team_id", teamIds),
      supabase
        .from("designs")
        .select("id, team_id, status")
        .in("team_id", teamIds),
    ]);
    for (const p of (players ?? []) as Pick<Player, "id" | "team_id">[]) {
      playerCounts[p.team_id] = (playerCounts[p.team_id] ?? 0) + 1;
    }
    for (const d of (designs ?? []) as Pick<
      Design,
      "id" | "team_id" | "status"
    >[]) {
      const entry = designSummaries[d.team_id] ?? { approved: 0, total: 0 };
      entry.total += 1;
      if (d.status === "approved") entry.approved += 1;
      designSummaries[d.team_id] = entry;
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">Teams</h2>
      <p className="mt-1 text-xs text-slate-500">
        Up to 9-10 teams can go in one order — each gets its own roster and
        design approval tracking.
      </p>

      <form action={addTeamWithIds} className="mt-3 flex flex-wrap items-end gap-2">
        <div className="min-w-[10rem] flex-1">
          <label className="block text-xs font-medium text-slate-600">
            Team name
          </label>
          <input
            name="team_name"
            required
            placeholder="e.g. U12 Green"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          + Add team
        </button>
      </form>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {teamList.length === 0 && (
          <p className="text-sm text-slate-500 sm:col-span-2 lg:col-span-3">
            No teams yet.
          </p>
        )}
        {teamList.map((team) => {
          const designSummary = designSummaries[team.id];
          return (
            <Link
              key={team.id}
              href={`/customers/${customerId}/orders/${orderId}/teams/${team.id}`}
              className="rounded-md border border-slate-100 bg-slate-50 p-3 hover:bg-slate-100"
            >
              <p className="font-medium text-slate-900">{team.team_name}</p>
              <p className="mt-1 text-xs text-slate-500">
                {playerCounts[team.id] ?? 0} player
                {(playerCounts[team.id] ?? 0) === 1 ? "" : "s"}
                {designSummary
                  ? ` · designs: ${designSummary.approved}/${designSummary.total} approved`
                  : " · no designs yet"}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
