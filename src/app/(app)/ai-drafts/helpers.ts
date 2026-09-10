import { buildSupplierText } from "@/lib/supplierFormat";
import type { AiDraft, AiDraftPlayer, Player } from "@/lib/types";

export function playersToText(players: AiDraftPlayer[]): string {
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

export function draftDisplayName(draft: AiDraft): string {
  return draft.payload.kind === "update_existing"
    ? (draft.payload.customer_name_hint ?? "(unnamed)")
    : (draft.payload.customer?.name ?? "(unnamed)");
}
