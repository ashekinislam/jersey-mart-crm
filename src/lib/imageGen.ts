/** Precision-editing model -- better than the "fast" variant at keeping a
 * reference photo's actual product (jersey design, logo, colours) accurate
 * rather than just "inspired by" it. */
const MODEL = "gpt-image-2.5-sunburst";

interface ReferenceImage {
  bytes: Buffer;
  contentType: string;
}

/** Generates one new photo guided by the given reference photos and prompt,
 * via OpenAI's image edit endpoint (multi-image reference input). */
export async function generateProductPhoto(referenceImages: ReferenceImage[], prompt: string): Promise<Buffer> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("not_configured: OPENAI_API_KEY missing");

  const form = new FormData();
  form.append("model", MODEL);
  form.append("prompt", prompt);
  form.append("size", "1024x1536");
  form.append("quality", "high");
  referenceImages.forEach((ref, i) => {
    form.append("image[]", new Blob([new Uint8Array(ref.bytes)], { type: ref.contentType }), `reference-${i}.png`);
  });

  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
  } catch {
    throw new Error("fetch_failed: network error reaching api.openai.com");
  }

  const json = (await res.json().catch(() => null)) as
    | { data?: { b64_json?: string }[]; error?: { message?: string } }
    | null;

  if (!res.ok) {
    throw new Error(`fetch_failed: ${json?.error?.message ?? `HTTP ${res.status}`}`);
  }

  const b64 = json?.data?.[0]?.b64_json;
  if (!b64) throw new Error("bad_response: no image returned");
  return Buffer.from(b64, "base64");
}
