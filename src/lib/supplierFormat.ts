import type { Player } from "./types";

export function isKidsSize(size: string | null | undefined): boolean {
  return /kids?\s*\d+/i.test((size ?? "").trim());
}

/** Standard 2-year youth sizing bands: Kids 12 -> "11/12", Kids 9 or 10 -> "9/10". */
export function kidsAgeBand(size: string | null | undefined): string {
  const match = (size ?? "").match(/(\d+)/);
  if (!match) return (size ?? "").trim();
  const n = Number(match[1]);
  return n % 2 === 0 ? `${n - 1}/${n}` : `${n}/${n + 1}`;
}

function formattedSize(size: string | null | undefined): string {
  return isKidsSize(size) ? kidsAgeBand(size) : (size ?? "").trim();
}

/** One line per player: "1. NAME-SIZE বছর বয়স-JERSEY#" for kids, "1. NAME-SIZE-JERSEY#" for adults. */
export function buildSupplierText(players: Player[]): string {
  if (players.length === 0) return "";
  return players
    .map((p, i) => {
      const name = p.name_on_back || p.player_name;
      const size = formattedSize(p.jersey_size) || "(no size)";
      const number = p.jersey_number || "?";
      const ageLabel = isKidsSize(p.jersey_size) ? " বছর বয়স" : "";
      return `${i + 1}. ${name}-${size}${ageLabel}-${number}`;
    })
    .join("\n");
}
