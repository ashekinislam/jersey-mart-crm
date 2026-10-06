"use client";

import { useState } from "react";
import { CopyButton } from "@/components/CopyButton";

/** A ready-to-send message for the customer, with their tracking link already in it.
 * Editable before copying, since a customer name isn't always a person's first name
 * (e.g. a club or company). */
export function TrackingMessage({
  customerName,
  orderLabel,
  shareUrl,
}: {
  customerName: string;
  orderLabel: string | null;
  shareUrl: string;
}) {
  const firstName = customerName.trim().split(/\s+/)[0] || "there";
  const orderRef = orderLabel ? ` (${orderLabel})` : "";
  const [text, setText] = useState(
    `Hi ${firstName}, here's the link to track your Jersey Mart order${orderRef}:\n\n${shareUrl}\n\n` +
      `It shows the latest status of your order and updates whenever we make a change, so you can check back any time.\n\n` +
      `Thanks for choosing Jersey Mart!`
  );

  return (
    <div className="mt-3">
      <label className="block text-xs font-medium text-slate-600">Message to send</label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={7}
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700"
      />
      <div className="mt-2">
        <CopyButton text={text} label="Copy message" />
      </div>
    </div>
  );
}
