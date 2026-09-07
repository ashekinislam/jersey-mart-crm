-- Jersey Mart CRM schema
-- Run this once in your Supabase project's SQL editor (Project > SQL Editor > New query).

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  contact_channel text not null default 'facebook'
    check (contact_channel in ('facebook','email','phone','other')),
  contact_handle text,
  phone text,
  email text,
  address text,
  fabric_preference text,
  status text not null default 'lead'
    check (status in ('lead','potential','active','repeat','inactive')),
  tags text[] not null default '{}',
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

create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  body text not null,
  source text not null default 'facebook'
    check (source in ('facebook','email','call','other')),
  is_order_relevant boolean not null default false,
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

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  status text not null default 'draft'
    check (status in ('draft','sent','fulfilled')),
  summary_text text not null,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists notes_customer_id_idx on notes(customer_id);
create index if not exists pricing_customer_id_idx on pricing(customer_id);
create index if not exists orders_customer_id_idx on orders(customer_id);

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
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
  customer_id uuid not null references customers(id) on delete cascade,
  stage text not null check (stage in ('ai_concept', 'machine_ready')),
  storage_path text not null,
  label text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'changes_requested')),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists players_customer_id_idx on players(customer_id);
create index if not exists parcels_customer_id_idx on parcels(customer_id);
create index if not exists parcels_dispatched_at_idx on parcels(dispatched_at);
create index if not exists designs_customer_id_idx on designs(customer_id);

alter table customers enable row level security;
alter table notes enable row level security;
alter table pricing enable row level security;
alter table orders enable row level security;
alter table players enable row level security;
alter table parcels enable row level security;
alter table designs enable row level security;

create policy "owner_all customers" on customers
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner_all notes" on notes
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner_all pricing" on pricing
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner_all orders" on orders
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner_all players" on players
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner_all parcels" on parcels
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner_all designs" on designs
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
