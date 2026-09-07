-- Meta (Facebook Messenger + Instagram DM) integration.
-- Adds a leads inbox fed by a webhook, and a permanent raw chat log per
-- conversation that gets linked to a customer once converted.

alter table customers drop constraint if exists customers_contact_channel_check;
alter table customers add constraint customers_contact_channel_check
  check (contact_channel in ('facebook','instagram','email','phone','other'));

alter table notes drop constraint if exists notes_source_check;
alter table notes add constraint notes_source_check
  check (source in ('facebook','instagram','email','call','other'));

create table if not exists meta_conversations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  platform text not null check (platform in ('facebook','instagram')),
  external_user_id text not null,
  external_user_name text,
  customer_id uuid references customers(id) on delete set null,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  unique (owner_id, platform, external_user_id)
);

create table if not exists meta_messages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  conversation_id uuid not null references meta_conversations(id) on delete cascade,
  meta_message_id text not null,
  direction text not null check (direction in ('inbound','outbound')),
  body text,
  attachment_type text check (attachment_type in ('image','other')),
  attachment_storage_path text,
  sent_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (owner_id, meta_message_id)
);

create index if not exists meta_conversations_customer_id_idx on meta_conversations(customer_id);
create index if not exists meta_conversations_owner_id_idx on meta_conversations(owner_id);
create index if not exists meta_messages_conversation_id_idx on meta_messages(conversation_id);

alter table meta_conversations enable row level security;
alter table meta_messages enable row level security;

create policy "owner_all meta_conversations" on meta_conversations
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner_all meta_messages" on meta_messages
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Storage bucket for chat-image attachments (private — not publicly readable)
insert into storage.buckets (id, name, public)
values ('meta-attachments', 'meta-attachments', false)
on conflict (id) do nothing;

create policy "owner_select meta_attachments bucket" on storage.objects
  for select using (
    bucket_id = 'meta-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "owner_insert meta_attachments bucket" on storage.objects
  for insert with check (
    bucket_id = 'meta-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "owner_delete meta_attachments bucket" on storage.objects
  for delete using (
    bucket_id = 'meta-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
