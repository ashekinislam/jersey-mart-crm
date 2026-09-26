-- Brand assets: general photos/logos (not tied to a specific order) that the
-- video pipeline can draw on alongside a customer's own Design photos.
create table if not exists video_brand_assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('photo', 'logo')),
  storage_path text not null,
  caption text,
  created_at timestamptz not null default now()
);

-- One row per auto-generated social video, tracking it from script through
-- to the rendered file (and later, posting).
create table if not exists generated_videos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  video_type text not null check (video_type in ('product_showcase', 'educational', 'service_promo')),
  status text not null default 'draft'
    check (status in ('draft', 'scripting', 'voicing', 'rendering', 'ready', 'failed', 'posted')),
  script text,
  source_design_ids uuid[] not null default '{}',
  source_brand_asset_ids uuid[] not null default '{}',
  voiceover_storage_path text,
  render_id text,
  render_bucket_name text,
  output_url text,
  error_message text,
  posted_at timestamptz,
  created_at timestamptz not null default now()
);

alter table video_brand_assets enable row level security;
alter table generated_videos enable row level security;

create policy "owner_all video_brand_assets" on video_brand_assets
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner_all generated_videos" on generated_videos
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Storage bucket for brand-asset photos/logos (private — not publicly readable)
insert into storage.buckets (id, name, public)
values ('brand-assets', 'brand-assets', false)
on conflict (id) do nothing;

create policy "owner_select brand_assets bucket" on storage.objects
  for select using (
    bucket_id = 'brand-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "owner_insert brand_assets bucket" on storage.objects
  for insert with check (
    bucket_id = 'brand-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "owner_delete brand_assets bucket" on storage.objects
  for delete using (
    bucket_id = 'brand-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage bucket for generated voiceover audio (private — not publicly readable)
insert into storage.buckets (id, name, public)
values ('voiceovers', 'voiceovers', false)
on conflict (id) do nothing;

create policy "owner_select voiceovers bucket" on storage.objects
  for select using (
    bucket_id = 'voiceovers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "owner_insert voiceovers bucket" on storage.objects
  for insert with check (
    bucket_id = 'voiceovers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "owner_delete voiceovers bucket" on storage.objects
  for delete using (
    bucket_id = 'voiceovers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
