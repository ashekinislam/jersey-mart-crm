-- Run this in Supabase SQL Editor.
-- Creates the designs table (AI concepts + machine-ready mockups per customer)
-- and a private storage bucket for the images.

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

create index if not exists designs_customer_id_idx on designs(customer_id);

alter table designs enable row level security;

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
