import type { ReactNode } from "react";
import type { MetaMessage } from "@/lib/types";

export function ConversationThread({
  messages,
  imageUrls,
  renderBelowImage,
}: {
  messages: MetaMessage[];
  imageUrls: Record<string, string>;
  renderBelowImage?: (message: MetaMessage) => ReactNode;
}) {
  if (messages.length === 0) {
    return <p className="text-sm text-slate-500">No messages yet.</p>;
  }

  return (
    <div className="space-y-3">
      {messages.map((message) => {
        const isOutbound = message.direction === "outbound";
        const imageUrl = message.attachment_storage_path
          ? imageUrls[message.attachment_storage_path]
          : null;

        return (
          <div
            key={message.id}
            className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                isOutbound
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 bg-slate-50 text-slate-800"
              }`}
            >
              {imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt="Attachment"
                  className="mb-1.5 max-w-full rounded-md border border-slate-200"
                />
              )}
              {message.body && (
                <p className="whitespace-pre-wrap">{message.body}</p>
              )}
              <p
                className={`mt-1 text-[10px] ${
                  isOutbound ? "text-slate-300" : "text-slate-400"
                }`}
              >
                {new Date(message.sent_at).toLocaleString()}
              </p>
              {imageUrl && renderBelowImage?.(message)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
