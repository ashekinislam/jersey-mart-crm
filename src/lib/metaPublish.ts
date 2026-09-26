const GRAPH_API_VERSION = "v21.0";

function config() {
  const pageId = process.env.META_CONTENT_PAGE_ID;
  const igAccountId = process.env.META_CONTENT_IG_ACCOUNT_ID;
  const accessToken = process.env.META_CONTENT_ACCESS_TOKEN;
  if (!pageId || !igAccountId || !accessToken) {
    throw new Error("not_configured: Meta content-posting env vars missing");
  }
  return { pageId, igAccountId, accessToken };
}

interface GraphResponse {
  id?: string;
  status_code?: string;
  error?: { message?: string };
}

async function graphPost(path: string, params: Record<string, string>): Promise<GraphResponse> {
  const { accessToken } = config();
  let res: Response;
  try {
    res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${path}`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ ...params, access_token: accessToken }),
    });
  } catch {
    throw new Error("fetch_failed: network error reaching graph.facebook.com");
  }
  const json = (await res.json().catch(() => null)) as GraphResponse | null;
  if (!res.ok) throw new Error(`fetch_failed: ${json?.error?.message ?? `HTTP ${res.status}`}`);
  return json ?? {};
}

async function graphGet(path: string, params: Record<string, string>): Promise<GraphResponse> {
  const { accessToken } = config();
  const query = new URLSearchParams({ ...params, access_token: accessToken });
  let res: Response;
  try {
    res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${path}?${query}`);
  } catch {
    throw new Error("fetch_failed: network error reaching graph.facebook.com");
  }
  const json = (await res.json().catch(() => null)) as GraphResponse | null;
  if (!res.ok) throw new Error(`fetch_failed: ${json?.error?.message ?? `HTTP ${res.status}`}`);
  return json ?? {};
}

export async function postVideoToFacebookPage(videoUrl: string, caption: string): Promise<string> {
  const { pageId } = config();
  const json = await graphPost(`${pageId}/videos`, { file_url: videoUrl, description: caption });
  if (!json.id) throw new Error("bad_response: Facebook didn't return a post id");
  return json.id;
}

export async function startInstagramReel(videoUrl: string, caption: string): Promise<string> {
  const { igAccountId } = config();
  const json = await graphPost(`${igAccountId}/media`, { video_url: videoUrl, caption, media_type: "REELS" });
  if (!json.id) throw new Error("bad_response: Instagram didn't return a creation id");
  return json.id;
}

async function publishInstagramReel(creationId: string): Promise<string> {
  const { igAccountId } = config();
  const json = await graphPost(`${igAccountId}/media_publish`, { creation_id: creationId });
  if (!json.id) throw new Error("bad_response: Instagram didn't return a media id");
  return json.id;
}

/** Instagram processes the uploaded video asynchronously before it can be
 * published. Polls briefly and publishes once ready; returns null (not an
 * error) if it's still processing after `maxAttempts` -- the caller can
 * retry with the same creation id a little later. */
export async function waitAndPublishInstagram(creationId: string, maxAttempts = 10): Promise<string | null> {
  for (let i = 0; i < maxAttempts; i++) {
    const status = await graphGet(creationId, { fields: "status_code" });
    if (status.status_code === "ERROR") throw new Error("bad_response: Instagram failed to process the video");
    if (status.status_code === "FINISHED") return publishInstagramReel(creationId);
    await new Promise((r) => setTimeout(r, 3000));
  }
  return null;
}
