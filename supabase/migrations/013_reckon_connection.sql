create table if not exists reckon_connections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade unique,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  book_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table reckon_connections enable row level security;

create policy "owner_all reckon_connections" on reckon_connections
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
