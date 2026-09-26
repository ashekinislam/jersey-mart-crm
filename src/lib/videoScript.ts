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

You'll be given a video type and a list of photo captions, in order. Each photo already exists — never invent details that contradict its caption. Write exactly one short narration line per photo (under 18 words, natural spoken tone, no hashtags, no emojis, no quotation marks), in the same order, plus a punchy on-screen headline (under 8 words) for the video's opening title card.

Respond with ONLY minified JSON, no other text: {"headline":"...","lines":["...","..."]}`;

/** Calls the Anthropic API to write a narration script matched 1:1 to the
 * given photo captions (one line per photo), plus a short intro headline. */
export async function generateVideoScript(videoType: VideoType, photoCaptions: string[]): Promise<VideoScript> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("not_configured: ANTHROPIC_API_KEY missing");

  const userMessage = [
    `Video type: ${videoType} — ${VIDEO_TYPE_BRIEF[videoType]}`,
    "",
    "Photo captions, in order:",
    ...photoCaptions.map((c, i) => `${i + 1}. ${c.trim() || "(no caption provided)"}`),
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
    | { content?: { text?: string }[]; error?: { message?: string } }
    | null;

  if (!res.ok) {
    throw new Error(`fetch_failed: ${json?.error?.message ?? `HTTP ${res.status}`}`);
  }

  const text = json?.content?.[0]?.text;
  if (typeof text !== "string") throw new Error("bad_response: no text in Claude response");

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
