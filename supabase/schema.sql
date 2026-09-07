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

alter table customers enable row level security;
alter table notes enable row level security;
alter table pricing enable row level security;
alter table orders enable row level security;

create policy "owner_all customers" on customers
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner_all notes" on notes
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner_all pricing" on pricing
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner_all orders" on orders
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
