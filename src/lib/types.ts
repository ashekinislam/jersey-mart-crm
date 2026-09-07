export type ContactChannel = "facebook" | "email" | "phone" | "other";
export type CustomerStatus =
  | "lead"
  | "potential"
  | "active"
  | "repeat"
  | "inactive";
export type NoteSource = "facebook" | "email" | "call" | "other";
export type OrderStatus = "draft" | "sent" | "fulfilled";

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
  fabric_preference: string | null;
  status: CustomerStatus;
  tags: string[];
  deadline: string | null;
  order_status: OrderTrackingStatus;
  payment_status: PaymentStatus;
  payment_due_date: string | null;
  shipping_status: ShippingStatus;
  tracking_url: string | null;
  tracking_number: string | null;
  invoice_storage_path: string | null;
  created_at: string;
  updated_at: string;
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

export const PICKUP_ADDRESS = "49/14 Fleet Street, Browns Plains, QLD 4118";

export interface Note {
  id: string;
  owner_id: string;
  customer_id: string;
  body: string;
  source: NoteSource;
  is_order_relevant: boolean;
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
  customer_id: string;
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
  customer_id: string;
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

export interface SupplierOrder {
  id: string;
  owner_id: string;
  customer_id: string;
  status: OrderStatus;
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
