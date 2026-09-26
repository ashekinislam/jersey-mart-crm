/** ElevenLabs premade voice "Rachel" — a neutral, friendly narration voice.
 * Override via ELEVENLABS_VOICE_ID if a different voice is preferred later. */
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

/** Synthesizes narration audio for the given script text via ElevenLabs,
 * returning the raw MP3 bytes to be uploaded to storage. */
export async function synthesizeVoiceover(text: string): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("not_configured: ELEVENLABS_API_KEY missing");
  const voiceId = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;

  let res: Response;
  try {
    res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "content-type": "application/json",
        accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_turbo_v2_5",
        voice_settings: { stability: 0.45, similarity_boost: 0.75, speed: 0.88 },
      }),
    });
  } catch {
    throw new Error("fetch_failed: network error reaching api.elevenlabs.io");
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`fetch_failed: HTTP ${res.status} ${errText.slice(0, 200)}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
