export type ContactChannel = "facebook" | "email" | "phone" | "other";
export type CustomerStatus =
  | "lead"
  | "potential"
  | "active"
  | "repeat"
  | "inactive";
export type NoteSource = "facebook" | "email" | "call" | "other";
export type OrderStatus = "draft" | "sent" | "fulfilled";

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
  created_at: string;
  updated_at: string;
}

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
