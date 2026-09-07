-- Run this in Supabase SQL Editor.
--
-- Restructures the app around: customer -> orders -> teams -> players/designs.
-- Safely carries forward any tracking fields, players, designs, and sent-order
-- history you've already entered on customers into the new structure.
-- Nothing you've entered so far is deleted.

-- 1. Customers gain a state field (for the dashboard "customers by state" chart).
alter table customers add column if not exists state text;

-- 2. Move the existing sent-summary "orders" table out of the way so the name
--    "orders" is free for the new live-order entity.
alter table orders rename to order_summaries;
alter table order_summaries rename column customer_id to old_customer_id;

-- 3. The new "orders" table: one row per real order, carrying the tracking
--    fields that used to live directly on customers.
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

alter table order_summaries add column if not exists order_id uuid references orders(id) on delete cascade;

-- 4. Teams: one order can have many teams.
create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  team_name text not null,
  created_at timestamptz not null default now()
);

-- 5. Players and designs now belong to a team, not directly to a customer.
alter table players add column if not exists team_id uuid references teams(id) on delete cascade;
alter table designs add column if not exists team_id uuid references teams(id) on delete cascade;

-- 6. Notes can optionally be tagged to a specific order.
alter table notes add column if not exists order_id uuid references orders(id) on delete set null;

-- 7. Backfill: for every customer with existing tracking data, players,
--    designs, or sent-order history, create one order + one team to hold it,
--    and re-point the existing rows at the new ids.
do $$
declare
  cust record;
  new_order_id uuid;
  new_team_id uuid;
begin
  for cust in select * from customers loop
    if cust.deadline is not null
       or cust.order_status is distinct from 'quote_sent'
       or cust.payment_status is distinct from 'unpaid'
       or cust.payment_due_date is not null
       or cust.shipping_status is distinct from 'not_shipped'
       or cust.tracking_url is not null
       or cust.tracking_number is not null
       or cust.invoice_storage_path is not null
       or exists (select 1 from players p where p.customer_id = cust.id)
       or exists (select 1 from designs d where d.customer_id = cust.id)
       or exists (select 1 from order_summaries os where os.old_customer_id = cust.id)
    then
      insert into orders (
        owner_id, customer_id, deadline, order_status, payment_status,
        payment_due_date, shipping_status, tracking_url, tracking_number,
        invoice_storage_path
      )
      values (
        cust.owner_id, cust.id, cust.deadline, cust.order_status, cust.payment_status,
        cust.payment_due_date, cust.shipping_status, cust.tracking_url, cust.tracking_number,
        cust.invoice_storage_path
      )
      returning id into new_order_id;

      insert into teams (owner_id, order_id, team_name)
      values (cust.owner_id, new_order_id, cust.name)
      returning id into new_team_id;

      update players set team_id = new_team_id where customer_id = cust.id;
      update designs set team_id = new_team_id where customer_id = cust.id;
      update order_summaries set order_id = new_order_id where old_customer_id = cust.id;
      update notes set order_id = new_order_id where customer_id = cust.id and is_order_relevant = true;
    end if;
  end loop;
end $$;

-- 8. Now that every row has been repointed, enforce the new required
--    relationships and drop the old columns.
alter table players alter column team_id set not null;
alter table players drop column customer_id;

alter table designs alter column team_id set not null;
alter table designs drop column customer_id;

alter table order_summaries alter column order_id set not null;
alter table order_summaries drop column old_customer_id;

alter table notes drop column is_order_relevant;

alter table customers drop column deadline;
alter table customers drop column order_status;
alter table customers drop column payment_status;
alter table customers drop column payment_due_date;
alter table customers drop column shipping_status;
alter table customers drop column tracking_url;
alter table customers drop column tracking_number;
alter table customers drop column invoice_storage_path;

-- 9. Indexes + RLS for the new tables (same owner-scoped pattern as everything else).
create index if not exists orders_customer_id_idx on orders(customer_id);
create index if not exists teams_order_id_idx on teams(order_id);
create index if not exists players_team_id_idx on players(team_id);
create index if not exists designs_team_id_idx on designs(team_id);
create index if not exists order_summaries_order_id_idx on order_summaries(order_id);
create index if not exists notes_order_id_idx on notes(order_id);

alter table orders enable row level security;
alter table teams enable row level security;

create policy "owner_all orders" on orders
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner_all teams" on teams
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
