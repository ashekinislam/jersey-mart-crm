import type { VideoType } from "./types";

export interface VideoScript {
  headline: string;
  lines: string[];
}

const VIDEO_TYPE_BRIEF: Record<VideoType, string> = {
  product_showcase:
    "Showing off real custom jerseys/kits Jersey Mart has produced for actual teams and clubs.",
  educational:
    "Teaching viewers something interesting about custom jersey/kit production — fabric, sublimation printing, sizing, the design process, turnaround times.",
  service_promo:
    "Promoting what Jersey Mart offers as a service — custom design, bulk team orders, fast turnaround, quality.",
};

const SYSTEM_PROMPT = `You write short voiceover scripts for vertical social media videos (TikTok / Instagram Reels / YouTube Shorts) for Jersey Mart, an Australian business that designs and produces custom sports jerseys, uniforms and kits for teams and clubs.

Write like a hype sports-brand ad, not a product description. Match-day energy, team pride, confidence — short punchy sentences, active verbs, it's fine to speak straight to the viewer ("your club", "your team", "you"). This is NOT a corporate voiceover.

Vary your wording and structure every single time. You will be shown scripts you've written before for this same brand — do not reuse their headline, their opening line, or their overall shape. If a phrase feels like something you'd default to out of habit ("real kits, real teams", "custom jerseys built for teams", anything with that same rhythm), that is exactly the phrase to avoid — write something else instead.

You'll be given a video type and a list of photo captions, in order — these describe what's actually on screen (colours, pattern, sport, detail); lean on the specifics they give you rather than staying generic, and never contradict them. If a caption is just "Jersey Mart" with nothing else to go on, don't force detail that isn't there — stay energetic and general rather than inventing fake specifics.

Write exactly one narration line per photo (under 16 words, natural spoken tone, no hashtags, no emojis, no quotation marks), in the same order, plus a punchy on-screen headline (under 6 words, no full stop) for the opening title card.

Respond with ONLY minified JSON, no other text: {"headline":"...","lines":["...","..."]}`;

/** Calls the Anthropic API to write a narration script matched 1:1 to the given photo
 * captions (one line per photo), plus a short intro headline. `recentScripts` -- your
 * last few headlines/openers -- is shown back so the model can actively avoid repeating
 * itself instead of drifting toward the same stock phrasing every time. */
export async function generateVideoScript(
  videoType: VideoType,
  photoCaptions: string[],
  recentScripts: VideoScript[] = []
): Promise<VideoScript> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("not_configured: ANTHROPIC_API_KEY missing");

  const userMessage = [
    `Video type: ${videoType} — ${VIDEO_TYPE_BRIEF[videoType]}`,
    "",
    "Photo captions, in order:",
    ...photoCaptions.map((c, i) => `${i + 1}. ${c.trim() || "(no caption provided)"}`),
    ...(recentScripts.length
      ? [
          "",
          "Scripts you've already written recently -- do not reuse their headline, opening line, or overall shape:",
          ...recentScripts.map((s, i) => `${i + 1}. Headline: "${s.headline}" / Opens with: "${s.lines[0] ?? ""}"`),
        ]
      : []),
  ].join("\n");

  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
    });
  } catch {
    throw new Error("fetch_failed: network error reaching api.anthropic.com");
  }

  const json = (await res.json().catch(() => null)) as
    | { content?: { type?: string; text?: string }[]; stop_reason?: string; error?: { message?: string } }
    | null;

  if (!res.ok) {
    throw new Error(`fetch_failed: ${json?.error?.message ?? `HTTP ${res.status}`}`);
  }

  // Don't assume the first content block is text -- a 200 response can still come back
  // without one (e.g. content filtered, or truncated before any text was written), and
  // when it does, this now says why instead of just "no text".
  const text = json?.content?.find((block) => block?.type === "text")?.text;
  if (typeof text !== "string") {
    const blockTypes = (json?.content ?? []).map((b) => b?.type ?? "?").join(",") || "none";
    throw new Error(`bad_response: no text in Claude response (stop_reason=${json?.stop_reason ?? "?"}, blocks=${blockTypes})`);
  }

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("bad_response: could not find JSON in Claude response");

  let parsed: { headline?: unknown; lines?: unknown };
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    throw new Error("bad_response: Claude response was not valid JSON");
  }

  if (
    typeof parsed.headline !== "string" ||
    !Array.isArray(parsed.lines) ||
    parsed.lines.length !== photoCaptions.length ||
    !parsed.lines.every((l) => typeof l === "string")
  ) {
    throw new Error("bad_response: script shape didn't match the photo count");
  }

  return { headline: parsed.headline, lines: parsed.lines as string[] };
}
