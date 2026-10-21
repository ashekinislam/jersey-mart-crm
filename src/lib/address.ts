const STATE_ABBREVIATIONS: Record<string, string> = {
  queensland: "QLD",
  "new south wales": "NSW",
  victoria: "VIC",
  "south australia": "SA",
  "western australia": "WA",
  tasmania: "TAS",
  "northern territory": "NT",
  "australian capital territory": "ACT",
};

/** "Queensland" / "qld" / "QLD" -> "QLD". Anything unrecognised is returned trimmed, as given. */
export function normaliseState(state: string | null | undefined): string | null {
  const trimmed = (state ?? "").trim();
  if (!trimmed) return null;
  return STATE_ABBREVIATIONS[trimmed.toLowerCase()] ?? (trimmed.length <= 3 ? trimmed.toUpperCase() : trimmed);
}

export interface AddressParts {
  line1?: string | null;
  line2?: string | null;
  line3?: string | null;
  suburb?: string | null;
  state?: string | null;
  postcode?: string | null;
}

const clean = (s: string | null | undefined) => (s ?? "").trim();

/** "17 Kensington Drive, Minyama, QLD 4575" -- street lines and suburb comma-separated,
 * then state and postcode together. Missing pieces are simply left out. */
export function formatAuAddress(parts: AddressParts): string | null {
  const locality = [clean(parts.line1), clean(parts.line2), clean(parts.line3), clean(parts.suburb)].filter(Boolean);
  const region = [normaliseState(parts.state), clean(parts.postcode)].filter(Boolean).join(" ");
  const all = region ? [...locality, region] : locality;
  return all.length > 0 ? all.join(", ") : null;
}

/** The address without state/postcode, exactly as the original Reckon import wrote it --
 * used to tell an untouched old import apart from an address someone edited by hand. */
export function legacyAddress(parts: AddressParts): string | null {
  const locality = [clean(parts.line1), clean(parts.line2), clean(parts.line3), clean(parts.suburb)].filter(Boolean);
  return locality.length > 0 ? locality.join(", ") : null;
}
