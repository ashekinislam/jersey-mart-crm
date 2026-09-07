-- Run this in Supabase SQL Editor to add team/player orders and dispatch parcels.

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  player_name text not null,
  name_on_back text,
  jersey_size text,
  shorts_size text,
  jersey_number text,
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

create index if not exists players_customer_id_idx on players(customer_id);
create index if not exists parcels_customer_id_idx on parcels(customer_id);
create index if not exists parcels_dispatched_at_idx on parcels(dispatched_at);

alter table players enable row level security;
alter table parcels enable row level security;

create policy "owner_all players" on players
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner_all parcels" on parcels
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
