-- Loan ledger: money lent to / paid on behalf by someone (e.g. a family member
-- who covers supplier bills against a loan from the business).
--
-- One row per movement. Each row has separate AUD and BDT amounts (either can
-- be blank, at least one is required) so the supplier's BDT bill and its AUD
-- equivalent can both be recorded. The kind decides the direction:
--   lent          +  they owe the business more
--   supplier_bill -  they paid a supplier bill for the business
--   shipping      -  they paid a shipping cost for the business
--   repayment     -  they paid the business back directly
-- Balances (per person, per currency) are computed from these rows.

create table if not exists loan_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  person text not null,
  kind text not null check (kind in ('lent', 'supplier_bill', 'shipping', 'repayment')),
  entry_date date not null default current_date,
  aud_amount numeric(12,2) check (aud_amount >= 0),
  bdt_amount numeric(14,2) check (bdt_amount >= 0),
  description text,
  order_id uuid references orders(id) on delete set null,
  created_at timestamptz not null default now(),
  check (aud_amount is not null or bdt_amount is not null)
);

create index if not exists loan_entries_owner_date_idx
  on loan_entries(owner_id, entry_date desc);

alter table loan_entries enable row level security;

drop policy if exists "owner_all loan_entries" on loan_entries;
create policy "owner_all loan_entries" on loan_entries
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
