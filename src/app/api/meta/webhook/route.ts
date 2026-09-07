import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { createServiceClient } from "@/lib/supabase/service";
import type { MetaPlatform } from "@/lib/types";

const OWNER_ID = process.env.META_OWNER_USER_ID!;
const GRAPH_API_VERSION = "v21.0";

interface MetaAttachment {
  type: string;
  payload?: { url?: string };
}

interface MetaMessagingEvent {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: {
    mid?: string;
    text?: string;
    is_echo?: boolean;
    attachments?: MetaAttachment[];
  };
}

interface MetaWebhookBody {
  object?: string;
  entry?: { messaging?: MetaMessagingEvent[] }[];
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.META_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

function verifySignature(rawBody: string, signatureHeader: string | null) {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const expected = crypto
    .createHmac("sha256", process.env.META_APP_SECRET!)
    .update(rawBody, "utf8")
    .digest("hex");
  const given = signatureHeader.slice("sha256=".length);
  const expectedBuf = Buffer.from(expected, "hex");
  const givenBuf = Buffer.from(given, "hex");
  return (
    expectedBuf.length === givenBuf.length &&
    crypto.timingSafeEqual(expectedBuf, givenBuf)
  );
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  if (!verifySignature(rawBody, request.headers.get("x-hub-signature-256"))) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  const body = JSON.parse(rawBody) as MetaWebhookBody;
  const platform: MetaPlatform = body.object === "instagram" ? "instagram" : "facebook";
  const supabase = createServiceClient();

  for (const entry of body.entry ?? []) {
    for (const event of entry.messaging ?? []) {
      try {
        await handleMessagingEvent(supabase, platform, event);
      } catch (err) {
        console.error("[meta webhook] failed to process event", err);
      }
    }
  }

  return NextResponse.json({ status: "EVENT_RECEIVED" });
}

async function fetchDisplayName(externalUserId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${externalUserId}?fields=name&access_token=${process.env.META_PAGE_ACCESS_TOKEN}`
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { name?: string };
    return data.name?.trim() || null;
  } catch {
    return null;
  }
}

async function findOrCreateConversation(
  supabase: ReturnType<typeof createServiceClient>,
  platform: MetaPlatform,
  externalUserId: string
) {
  const { data: existing } = await supabase
    .from("meta_conversations")
    .select("*")
    .eq("owner_id", OWNER_ID)
    .eq("platform", platform)
    .eq("external_user_id", externalUserId)
    .maybeSingle();
  if (existing) return existing;

  const externalUserName = await fetchDisplayName(externalUserId);
  const { data: created, error } = await supabase
    .from("meta_conversations")
    .insert({
      owner_id: OWNER_ID,
      platform,
      external_user_id: externalUserId,
      external_user_name: externalUserName,
    })
    .select("*")
    .single();
  if (error || !created) throw error ?? new Error("failed to create conversation");
  return created;
}

async function saveAttachment(
  supabase: ReturnType<typeof createServiceClient>,
  conversationId: string,
  mid: string,
  index: number,
  url: string
): Promise<string | null> {
  const res = await fetch(url);
  if (!res.ok) return null;
  const contentType = res.headers.get("content-type") || "image/jpeg";
  const extension = contentType.split("/")[1]?.split(";")[0] || "jpg";
  const buffer = Buffer.from(await res.arrayBuffer());
  const storagePath = `${OWNER_ID}/${conversationId}/${mid}-${index}.${extension}`;

  const { error } = await supabase.storage
    .from("meta-attachments")
    .upload(storagePath, buffer, { contentType });
  if (error) return null;
  return storagePath;
}

async function handleMessagingEvent(
  supabase: ReturnType<typeof createServiceClient>,
  platform: MetaPlatform,
  event: MetaMessagingEvent
) {
  const message = event.message;
  if (!message?.mid) return; // not a message event (delivery/read/postback) — out of scope for v1

  const isOutbound = !!message.is_echo;
  const externalUserId = isOutbound ? event.recipient?.id : event.sender?.id;
  if (!externalUserId) return;

  const conversation = await findOrCreateConversation(supabase, platform, externalUserId);

  let attachmentType: "image" | "other" | null = null;
  let attachmentStoragePath: string | null = null;
  const imageAttachment = message.attachments?.find((a) => a.type === "image");
  if (imageAttachment?.payload?.url) {
    attachmentStoragePath = await saveAttachment(
      supabase,
      conversation.id,
      message.mid,
      0,
      imageAttachment.payload.url
    );
    attachmentType = attachmentStoragePath ? "image" : null;
  }

  const sentAt = new Date(event.timestamp ?? Date.now()).toISOString();

  await supabase.from("meta_messages").upsert(
    {
      owner_id: OWNER_ID,
      conversation_id: conversation.id,
      meta_message_id: message.mid,
      direction: isOutbound ? "outbound" : "inbound",
      body: message.text ?? null,
      attachment_type: attachmentType,
      attachment_storage_path: attachmentStoragePath,
      sent_at: sentAt,
    },
    { onConflict: "owner_id,meta_message_id", ignoreDuplicates: true }
  );

  await supabase
    .from("meta_conversations")
    .update({ last_message_at: sentAt })
    .eq("id", conversation.id);
}
