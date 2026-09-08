-- Customer follow-up log: scheduled call/email reminders plus outcome
-- history (no answer, spoke, emailed, other). The most recent non-'other'
-- row per customer drives the "needs follow-up" badge on the customer list.

create table if not exists follow_ups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  status text not null check (status in ('scheduled_call','scheduled_email','no_answer','spoke','emailed','other')),
  due_date date,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists follow_ups_customer_id_idx on follow_ups(customer_id);

alter table follow_ups enable row level security;

create policy "owner_all follow_ups" on follow_ups
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
