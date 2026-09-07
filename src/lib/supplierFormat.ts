import type { Player } from "./types";

export function isKidsSize(size: string | null | undefined): boolean {
  const s = (size ?? "").trim();
  return /kids?\s*\d+/i.test(s) || /^\d+\/\d+$/.test(s);
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

export interface ParsedSupplierLine {
  player_name: string;
  name_on_back: string;
  jersey_size: string;
  jersey_number: string | null;
}

/**
 * Inverse of buildSupplierText: reads lines like "1. WELSH-TOETU-11/12 বছর
 * বয়স-7" or "2. NAME-2XL-77" back into player fields. Splits from the right
 * (number, then size) so hyphenated names (e.g. "WELSH-TOETU") stay intact.
 */
export function parseSupplierText(text: string): ParsedSupplierLine[] {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const results: ParsedSupplierLine[] = [];
  for (const rawLine of lines) {
    const line = rawLine.replace(/^\s*\d+\.\s*/, "").trim();
    const lastDash = line.lastIndexOf("-");
    if (lastDash === -1) continue;

    const number = line.slice(lastDash + 1).trim();
    let rest = line.slice(0, lastDash).trim();
    rest = rest.replace(/\s*বছর\s*বয়স\s*$/u, "").trim();

    const secondDash = rest.lastIndexOf("-");
    if (secondDash === -1) continue;

    const size = rest.slice(secondDash + 1).trim();
    const name = rest.slice(0, secondDash).trim();
    if (!name || !size) continue;

    results.push({
      player_name: name,
      name_on_back: name,
      jersey_size: size,
      jersey_number: number && number !== "?" ? number : null,
    });
  }
  return results;
}
