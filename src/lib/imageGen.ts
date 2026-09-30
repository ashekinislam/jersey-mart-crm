/** Precision-editing model -- better than the "fast" variant at keeping a
 * reference photo's actual product (jersey design, logo, colours) accurate
 * rather than just "inspired by" it. */
const MODEL = "gpt-image-2.5-sunburst";

/** Forces one clean, photorealistic single-jersey product render regardless of what
 * the rest of the prompt asks for -- shared by every image-generation path here. */
const PRODUCT_RENDER_BRIEF =
  "Create exactly one premium custom football jersey as a photorealistic ecommerce product render. " +
  "Show one front-facing jersey only, centered, with the entire garment inside the frame. No people, " +
  "no head, no mannequin, no shorts, no second garment, no alternatives, no collage, no triptych, no " +
  "catalogue, no writing outside the jersey's own design, and no invented real-world team or league " +
  "branding. Use realistic technical fabric, stitching, seams, and studio lighting on a dark, neutral, " +
  "uncluttered background.";

interface ReferenceImage {
  bytes: Buffer;
  contentType: string;
}

function extractImageBytes(json: unknown): Buffer {
  const data = (json as { data?: { b64_json?: string }[] } | null)?.data;
  const b64 = data?.[0]?.b64_json;
  if (!b64) throw new Error("bad_response: no image returned");
  return Buffer.from(b64, "base64");
}

function errorMessageFrom(json: unknown, status: number): string {
  const message = (json as { error?: { message?: string } } | null)?.error?.message;
  return message ?? `HTTP ${status}`;
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

  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`fetch_failed: ${errorMessageFrom(json, res.status)}`);
  return extractImageBytes(json);
}

/** Invents one brand-new jersey concept from scratch -- no reference photo -- via
 * OpenAI's text-to-image endpoint. Used only when there's no real, approved customer
 * design to work from yet, so the daily pipeline always has something fresh to post
 * instead of simply doing nothing. `theme` describes the specific design to invent
 * (colours, sport, pattern); the product-render rules above are applied on top of it. */
export async function generateConceptJersey(theme: string): Promise<Buffer> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("not_configured: OPENAI_API_KEY missing");

  const prompt = `${PRODUCT_RENDER_BRIEF} ${theme.trim()}`;

  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, prompt, size: "1024x1536", quality: "high", n: 1 }),
    });
  } catch {
    throw new Error("fetch_failed: network error reaching api.openai.com");
  }

  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`fetch_failed: ${errorMessageFrom(json, res.status)}`);
  return extractImageBytes(json);
}
