import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Customer, Design, Order, Player, Team } from "@/lib/types";
import { deleteTeam } from "../../../../../../actions";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { DesignsSection } from "@/components/DesignsSection";
import { TeamRoster } from "@/components/TeamRoster";

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

      <TeamRoster
        customerId={id}
        orderId={orderId}
        teamId={teamId}
        players={playerList}
      />

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
