export type ContactChannel =
  | "facebook"
  | "instagram"
  | "email"
  | "phone"
  | "other";
export type CustomerStatus =
  | "lead"
  | "potential"
  | "active"
  | "repeat"
  | "inactive";
export type NoteSource =
  | "facebook"
  | "instagram"
  | "email"
  | "call"
  | "other";
export type OrderSummaryStatus = "draft" | "sent" | "fulfilled";

export type OrderTrackingStatus =
  | "quote_sent"
  | "deposit_paid"
  | "mockup_sent"
  | "approved"
  | "in_production"
  | "shipped"
  | "delivered"
  | "cancelled";

export type PaymentStatus = "unpaid" | "invoice_sent" | "paid";

export type ShippingStatus =
  | "not_shipped"
  | "at_factory"
  | "with_carrier"
  | "in_transit_overseas"
  | "in_transit_australia"
  | "out_for_delivery"
  | "delivered"
  | "ready_for_pickup"
  | "picked_up";

export interface Customer {
  id: string;
  owner_id: string;
  name: string;
  contact_channel: ContactChannel;
  contact_handle: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  state: string | null;
  fabric_preference: string | null;
  status: CustomerStatus;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  owner_id: string;
  customer_id: string;
  label: string | null;
  order_date: string;
  deadline: string | null;
  order_status: OrderTrackingStatus;
  payment_status: PaymentStatus;
  payment_due_date: string | null;
  shipping_status: ShippingStatus;
  tracking_url: string | null;
  tracking_number: string | null;
  invoice_storage_path: string | null;
  sale_amount: number | null;
  supplier_cost: number | null;
  freight_cost: number | null;
  created_at: string;
  updated_at: string;
}

export interface Team {
  id: string;
  owner_id: string;
  order_id: string;
  team_name: string;
  created_at: string;
}

export const ORDER_TRACKING_STATUSES: OrderTrackingStatus[] = [
  "quote_sent",
  "deposit_paid",
  "mockup_sent",
  "approved",
  "in_production",
  "shipped",
  "delivered",
  "cancelled",
];

export const ORDER_TRACKING_LABELS: Record<OrderTrackingStatus, string> = {
  quote_sent: "Quote sent",
  deposit_paid: "Deposit paid",
  mockup_sent: "Mockup sent",
  approved: "Approved",
  in_production: "In production",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const ORDER_TRACKING_COLORS: Record<OrderTrackingStatus, string> = {
  quote_sent: "bg-slate-100 text-slate-700",
  deposit_paid: "bg-sky-100 text-sky-800",
  mockup_sent: "bg-indigo-100 text-indigo-800",
  approved: "bg-teal-100 text-teal-800",
  in_production: "bg-amber-100 text-amber-800",
  shipped: "bg-violet-100 text-violet-800",
  delivered: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-red-100 text-red-700",
};

export const PAYMENT_STATUSES: PaymentStatus[] = [
  "unpaid",
  "invoice_sent",
  "paid",
];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: "Unpaid",
  invoice_sent: "Invoice sent",
  paid: "Paid",
};

export const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  unpaid: "bg-red-100 text-red-700",
  invoice_sent: "bg-amber-100 text-amber-800",
  paid: "bg-emerald-100 text-emerald-800",
};

export const SHIPPING_STATUSES: ShippingStatus[] = [
  "not_shipped",
  "at_factory",
  "with_carrier",
  "in_transit_overseas",
  "in_transit_australia",
  "out_for_delivery",
  "delivered",
  "ready_for_pickup",
  "picked_up",
];

export const SHIPPING_STATUS_LABELS: Record<ShippingStatus, string> = {
  not_shipped: "Not shipped yet",
  at_factory: "At factory (Bangladesh)",
  with_carrier: "With carrier (BDEX etc.)",
  in_transit_overseas: "In transit — overseas",
  in_transit_australia: "In transit — Australia",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  ready_for_pickup: "Ready for pickup",
  picked_up: "Picked up",
};

export const SHIPPING_STATUS_COLORS: Record<ShippingStatus, string> = {
  not_shipped: "bg-slate-100 text-slate-700",
  at_factory: "bg-amber-100 text-amber-800",
  with_carrier: "bg-sky-100 text-sky-800",
  in_transit_overseas: "bg-sky-100 text-sky-800",
  in_transit_australia: "bg-indigo-100 text-indigo-800",
  out_for_delivery: "bg-violet-100 text-violet-800",
  delivered: "bg-emerald-100 text-emerald-800",
  ready_for_pickup: "bg-amber-100 text-amber-800",
  picked_up: "bg-emerald-100 text-emerald-800",
};

export const PICKUP_ADDRESS = "49/14 Fleet Street, Browns Plains, QLD 4118";

export interface Note {
  id: string;
  owner_id: string;
  customer_id: string;
  order_id: string | null;
  body: string;
  source: NoteSource;
  created_at: string;
}

export type FollowUpStatus =
  | "scheduled_call"
  | "scheduled_email"
  | "no_answer"
  | "spoke"
  | "emailed"
  | "other";

export const FOLLOW_UP_STATUSES: FollowUpStatus[] = [
  "scheduled_call",
  "scheduled_email",
  "no_answer",
  "spoke",
  "emailed",
  "other",
];

export const FOLLOW_UP_STATUS_LABELS: Record<FollowUpStatus, string> = {
  scheduled_call: "Call scheduled",
  scheduled_email: "Email scheduled",
  no_answer: "Called - no answer",
  spoke: "Called - spoke to them",
  emailed: "Emailed",
  other: "Other",
};

export const FOLLOW_UP_STATUS_COLORS: Record<FollowUpStatus, string> = {
  scheduled_call: "bg-sky-100 text-sky-800",
  scheduled_email: "bg-sky-100 text-sky-800",
  no_answer: "bg-amber-100 text-amber-800",
  spoke: "bg-emerald-100 text-emerald-800",
  emailed: "bg-emerald-100 text-emerald-800",
  other: "bg-slate-100 text-slate-700",
};

export interface FollowUp {
  id: string;
  owner_id: string;
  customer_id: string;
  status: FollowUpStatus;
  due_date: string | null;
  note: string | null;
  created_at: string;
}

export interface PricingEntry {
  id: string;
  owner_id: string;
  customer_id: string;
  product_name: string;
  price: number;
  currency: string;
  note: string | null;
  created_at: string;
}

export interface Player {
  id: string;
  owner_id: string;
  team_id: string;
  player_name: string;
  name_on_back: string | null;
  jersey_size: string | null;
  shorts_size: string | null;
  jersey_number: string | null;
  notes: string | null;
  created_at: string;
}

export interface Parcel {
  id: string;
  owner_id: string;
  customer_id: string;
  contents: string;
  dispatched_at: string | null;
  created_at: string;
}

export type DesignStage = "ai_concept" | "machine_ready";
export type DesignStatus = "pending" | "approved" | "changes_requested";

export interface Design {
  id: string;
  owner_id: string;
  team_id: string;
  stage: DesignStage;
  storage_path: string;
  label: string | null;
  status: DesignStatus;
  notes: string | null;
  created_at: string;
}

export const DESIGN_STATUS_LABELS: Record<DesignStatus, string> = {
  pending: "Pending review",
  approved: "Approved",
  changes_requested: "Changes requested",
};

export const DESIGN_STATUS_COLORS: Record<DesignStatus, string> = {
  pending: "bg-slate-100 text-slate-700",
  approved: "bg-emerald-100 text-emerald-800",
  changes_requested: "bg-amber-100 text-amber-800",
};

export interface OrderSummary {
  id: string;
  owner_id: string;
  order_id: string;
  status: OrderSummaryStatus;
  summary_text: string;
  created_at: string;
  sent_at: string | null;
}

export const CUSTOMER_STATUSES: CustomerStatus[] = [
  "lead",
  "potential",
  "active",
  "repeat",
  "inactive",
];

export const STATUS_LABELS: Record<CustomerStatus, string> = {
  lead: "Lead",
  potential: "Potential",
  active: "Active",
  repeat: "Repeat",
  inactive: "Inactive",
};

export const STATUS_COLORS: Record<CustomerStatus, string> = {
  lead: "bg-slate-100 text-slate-700",
  potential: "bg-amber-100 text-amber-800",
  active: "bg-emerald-100 text-emerald-800",
  repeat: "bg-indigo-100 text-indigo-800",
  inactive: "bg-red-100 text-red-700",
};

export type MetaPlatform = "facebook" | "instagram";
export type MessageDirection = "inbound" | "outbound";

export const META_PLATFORMS: MetaPlatform[] = ["facebook", "instagram"];

export const META_PLATFORM_LABELS: Record<MetaPlatform, string> = {
  facebook: "Facebook Messenger",
  instagram: "Instagram DM",
};

export const META_PLATFORM_COLORS: Record<MetaPlatform, string> = {
  facebook: "bg-sky-100 text-sky-800",
  instagram: "bg-fuchsia-100 text-fuchsia-800",
};

export interface MetaConversation {
  id: string;
  owner_id: string;
  platform: MetaPlatform;
  external_user_id: string;
  external_user_name: string | null;
  customer_id: string | null;
  last_message_at: string | null;
  created_at: string;
}

export interface MetaMessage {
  id: string;
  owner_id: string;
  conversation_id: string;
  meta_message_id: string;
  direction: MessageDirection;
  body: string | null;
  attachment_type: "image" | "other" | null;
  attachment_storage_path: string | null;
  sent_at: string;
  created_at: string;
}

// ---- AI intake drafts (ChatGPT Action integration) ------------------------

export type AiDraftStatus = "pending" | "approved" | "rejected";

export interface AiDraftPlayer {
  player_name: string;
  name_on_back?: string | null;
  jersey_size?: string | null;
  shorts_size?: string | null;
  jersey_number?: string | null;
  notes?: string | null;
}

export interface AiDraftDesignRequest {
  stage: DesignStage;
  image_url?: string | null;
  caption?: string | null;
}

export interface AiDraftPayload {
  /** Defaults to "new_customer" when absent (older drafts predate this field). */
  kind?: "new_customer" | "update_existing";

  // kind: "new_customer" (or absent)
  customer?: {
    name: string;
    contact_channel?: ContactChannel;
    contact_handle?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    state?: string | null;
    fabric_preference?: string | null;
    status?: CustomerStatus;
    tags?: string[];
  };
  order?: {
    label?: string | null;
    deadline?: string | null;
  } | null;
  team?: {
    team_name: string;
    players: AiDraftPlayer[];
  } | null;

  // kind: "update_existing"
  customer_name_hint?: string;
  /** Resolved server-side at intake time via a name search; null if zero or multiple matches. */
  matched_customer_id?: string | null;
  note?: string | null;
  add_players?: AiDraftPlayer[];
  design?: AiDraftDesignRequest | null;
}

export interface AiDraft {
  id: string;
  owner_id: string;
  raw_prompt: string;
  payload: AiDraftPayload;
  status: AiDraftStatus;
  created_customer_id: string | null;
  created_at: string;
  reviewed_at: string | null;
}
