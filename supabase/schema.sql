-- Jersey Mart CRM schema
-- Run this once in your Supabase project's SQL editor (Project > SQL Editor > New query).
-- Structure: customer -> orders -> teams -> players / designs.

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  contact_channel text not null default 'facebook'
    check (contact_channel in ('facebook','instagram','email','phone','other')),
  contact_handle text,
  phone text,
  email text,
  address text,
  state text,
  fabric_preference text,
  status text not null default 'lead'
    check (status in ('lead','potential','active','repeat','inactive')),
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  label text,
  deadline date,
  order_status text not null default 'quote_sent'
    check (order_status in ('quote_sent','deposit_paid','mockup_sent','approved','in_production','shipped','delivered','cancelled')),
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid','invoice_sent','paid')),
  payment_due_date date,
  shipping_status text not null default 'not_shipped'
    check (shipping_status in ('not_shipped','at_factory','with_carrier','in_transit_overseas','in_transit_australia','out_for_delivery','delivered','ready_for_pickup','picked_up')),
  tracking_url text,
  tracking_number text,
  invoice_storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  team_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  order_id uuid references orders(id) on delete set null,
  body text not null,
  source text not null default 'facebook'
    check (source in ('facebook','instagram','email','call','other')),
  created_at timestamptz not null default now()
);

create table if not exists follow_ups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  status text not null check (status in ('scheduled_call','scheduled_email','no_answer','spoke','emailed','other')),
  due_date date,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists pricing (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  product_name text not null,
  price numeric(10,2) not null,
  currency text not null default 'AUD',
  note text,
  created_at timestamptz not null default now()
);

create table if not exists order_summaries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  status text not null default 'draft'
    check (status in ('draft','sent','fulfilled')),
  summary_text text not null,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  player_name text not null,
  name_on_back text,
  jersey_size text,
  shorts_size text,
  jersey_number text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists parcels (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  contents text not null,
  dispatched_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists designs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  stage text not null check (stage in ('ai_concept', 'machine_ready')),
  storage_path text not null,
  label text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'changes_requested')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists meta_conversations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  platform text not null check (platform in ('facebook','instagram')),
  external_user_id text not null,
  external_user_name text,
  customer_id uuid references customers(id) on delete set null,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  unique (owner_id, platform, external_user_id)
);

create table if not exists meta_messages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  conversation_id uuid not null references meta_conversations(id) on delete cascade,
  meta_message_id text not null,
  direction text not null check (direction in ('inbound','outbound')),
  body text,
  attachment_type text check (attachment_type in ('image','other')),
  attachment_storage_path text,
  sent_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (owner_id, meta_message_id)
);

create index if not exists orders_customer_id_idx on orders(customer_id);
create index if not exists teams_order_id_idx on teams(order_id);
create index if not exists notes_customer_id_idx on notes(customer_id);
create index if not exists notes_order_id_idx on notes(order_id);
create index if not exists pricing_customer_id_idx on pricing(customer_id);
create index if not exists order_summaries_order_id_idx on order_summaries(order_id);
create index if not exists players_team_id_idx on players(team_id);
create index if not exists parcels_customer_id_idx on parcels(customer_id);
create index if not exists parcels_dispatched_at_idx on parcels(dispatched_at);
create index if not exists designs_team_id_idx on designs(team_id);
create index if not exists meta_conversations_customer_id_idx on meta_conversations(customer_id);
create index if not exists meta_conversations_owner_id_idx on meta_conversations(owner_id);
create index if not exists meta_messages_conversation_id_idx on meta_messages(conversation_id);
create index if not exists follow_ups_customer_id_idx on follow_ups(customer_id);

alter table customers enable row level security;
alter table orders enable row level security;
alter table teams enable row level security;
alter table notes enable row level security;
alter table pricing enable row level security;
alter table order_summaries enable row level security;
alter table players enable row level security;
alter table parcels enable row level security;
alter table designs enable row level security;
alter table meta_conversations enable row level security;
alter table meta_messages enable row level security;
alter table follow_ups enable row level security;

create policy "owner_all customers" on customers
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner_all orders" on orders
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner_all teams" on teams
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner_all notes" on notes
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner_all pricing" on pricing
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner_all order_summaries" on order_summaries
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner_all players" on players
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner_all parcels" on parcels
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner_all designs" on designs
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner_all meta_conversations" on meta_conversations
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner_all meta_messages" on meta_messages
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner_all follow_ups" on follow_ups
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Storage bucket for design images (private — not publicly readable)
insert into storage.buckets (id, name, public)
values ('designs', 'designs', false)
on conflict (id) do nothing;

create policy "owner_select designs bucket" on storage.objects
  for select using (
    bucket_id = 'designs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "owner_insert designs bucket" on storage.objects
  for insert with check (
    bucket_id = 'designs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "owner_delete designs bucket" on storage.objects
  for delete using (
    bucket_id = 'designs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage bucket for uploaded invoices (private — not publicly readable)
insert into storage.buckets (id, name, public)
values ('invoices', 'invoices', false)
on conflict (id) do nothing;

create policy "owner_select invoices bucket" on storage.objects
  for select using (
    bucket_id = 'invoices'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "owner_insert invoices bucket" on storage.objects
  for insert with check (
    bucket_id = 'invoices'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "owner_delete invoices bucket" on storage.objects
  for delete using (
    bucket_id = 'invoices'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage bucket for chat-image attachments (private — not publicly readable)
insert into storage.buckets (id, name, public)
values ('meta-attachments', 'meta-attachments', false)
on conflict (id) do nothing;

create policy "owner_select meta_attachments bucket" on storage.objects
  for select using (
    bucket_id = 'meta-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "owner_insert meta_attachments bucket" on storage.objects
  for insert with check (
    bucket_id = 'meta-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "owner_delete meta_attachments bucket" on storage.objects
  for delete using (
    bucket_id = 'meta-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
