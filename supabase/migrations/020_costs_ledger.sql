-- Costs ledger: every bill / charge is entered once as an "expense", then
-- (for supplier bills and shipping invoices) assigned to the order(s) it covers.
--
--   expenses            one row per bill or charge (supplier bill, shipping
--                       invoice, Facebook ad charge, other business expense)
--   expense_allocations how much of a supplier/shipping expense belongs to each
--                       order. One supplier bill can cover several orders; the
--                       allocations for an expense can add up to LESS than the
--                       bill (the rest is "not assigned to an order yet").
--
-- Ads and other overheads have no allocations -- they're business-level costs,
-- not per-order costs. All amounts are AUD.
--
-- Run this once. It also carries over any existing per-order supplier/freight
-- costs (orders.supplier_cost / freight_cost) into the new ledger as
-- already-paid entries; those old columns are left in place but no longer used.

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('supplier', 'shipping', 'ads', 'other')),
  expense_date date not null default current_date,
  amount numeric(10,2) not null check (amount >= 0),
  payee text,            -- supplier / carrier name, or "Facebook ads"
  reference text,        -- the bill's own invoice number
  notes text,
  paid_date date,        -- null = bill received but not paid yet
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists expenses_owner_date_idx on expenses(owner_id, expense_date desc);

create table if not exists expense_allocations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  expense_id uuid not null references expenses(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  amount numeric(10,2) not null check (amount >= 0),
  unique (expense_id, order_id)
);

create index if not exists expense_allocations_order_idx on expense_allocations(order_id);

alter table expenses enable row level security;
alter table expense_allocations enable row level security;

drop policy if exists "owner_all expenses" on expenses;
create policy "owner_all expenses" on expenses
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "owner_all expense_allocations" on expense_allocations;
create policy "owner_all expense_allocations" on expense_allocations
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- One-time carry-over of the old per-order cost boxes. Guarded so running this
-- file a second time can't duplicate them.
do $$
begin
  if not exists (select 1 from expenses) then
    alter table expenses add column carried_from_order uuid;

    insert into expenses (owner_id, kind, expense_date, amount, payee, notes, paid_date, carried_from_order)
    select owner_id, 'supplier', order_date, supplier_cost, 'Supplier (earlier entry)',
           'Carried over from this order''s old supplier cost box', order_date, id
    from orders
    where supplier_cost is not null and supplier_cost > 0;

    insert into expenses (owner_id, kind, expense_date, amount, payee, notes, paid_date, carried_from_order)
    select owner_id, 'shipping', order_date, freight_cost, 'Freight (earlier entry)',
           'Carried over from this order''s old freight cost box', order_date, id
    from orders
    where freight_cost is not null and freight_cost > 0;

    insert into expense_allocations (owner_id, expense_id, order_id, amount)
    select owner_id, id, carried_from_order, amount
    from expenses
    where carried_from_order is not null;

    alter table expenses drop column carried_from_order;
  end if;
end $$;
