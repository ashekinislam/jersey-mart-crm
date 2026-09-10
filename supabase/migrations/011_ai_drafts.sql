create table if not exists ai_drafts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  raw_prompt text not null,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_customer_id uuid references customers(id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists ai_drafts_owner_id_idx on ai_drafts(owner_id);
create index if not exists ai_drafts_status_idx on ai_drafts(status);

alter table ai_drafts enable row level security;

create policy "owner_all ai_drafts" on ai_drafts
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
