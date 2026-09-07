import type { Player } from "./types";

const ADULT_SIZE_ORDER = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"];

export type SizeClass = "kids" | "adult" | "unknown";

export function classifySize(size: string | null | undefined): SizeClass {
  const s = (size ?? "").trim();
  if (!s) return "unknown";
  if (/kids?\s*\d+/i.test(s)) return "kids";
  const normalized = s.toUpperCase().replace(/\s+/g, "");
  if (ADULT_SIZE_ORDER.includes(normalized)) return "adult";
  return "unknown";
}

/** Standard 2-year youth sizing bands: Kids 12 -> "11/12", Kids 9 or 10 -> "9/10". */
export function kidsAgeBand(size: string | null | undefined): string {
  const match = (size ?? "").match(/(\d+)/);
  if (!match) return (size ?? "").trim();
  const n = Number(match[1]);
  return n % 2 === 0 ? `${n - 1}/${n}` : `${n}/${n + 1}`;
}

function normalizedAdultSize(size: string | null | undefined): string {
  return (size ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

export function buildKidsSupplierText(players: Player[]): string {
  const kids = players.filter((p) => classifySize(p.jersey_size) === "kids");
  if (kids.length === 0) return "";
  return kids
    .map(
      (p, i) =>
        `${i + 1}. ${p.name_on_back || p.player_name}-${kidsAgeBand(
          p.jersey_size
        )} বছর বয়স-${p.jersey_number || "?"}`
    )
    .join("\n");
}

export function buildAdultsSupplierText(players: Player[]): string {
  const adults = players.filter((p) => classifySize(p.jersey_size) === "adult");
  if (adults.length === 0) return "";
  const counts = new Map<string, number>();
  for (const p of adults) {
    const key = normalizedAdultSize(p.jersey_size);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const sizes = [...counts.keys()].sort((a, b) => {
    const ai = ADULT_SIZE_ORDER.indexOf(a);
    const bi = ADULT_SIZE_ORDER.indexOf(b);
    return ai - bi;
  });
  return sizes.map((size, i) => `${i + 1}. ${size}-${counts.get(size)}`).join("\n");
}

export function buildShortsTally(players: Player[]): string {
  const withShorts = players.filter((p) => (p.shorts_size ?? "").trim());
  if (withShorts.length === 0) return "";
  const counts = new Map<string, number>();
  for (const p of withShorts) {
    const key = (p.shorts_size ?? "").trim().replace(/\s+/g, " ").toUpperCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([size, count]) => `${size} x${count}`)
    .join(", ");
}

export function unknownSizePlayers(players: Player[]): Player[] {
  return players.filter((p) => classifySize(p.jersey_size) === "unknown");
}
