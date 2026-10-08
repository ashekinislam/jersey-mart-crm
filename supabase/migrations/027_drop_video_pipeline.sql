-- Removes the video pipeline's tables (migrations 022-024). IRREVERSIBLE: every
-- generated video record and brand-asset record is deleted.
--
-- The two Storage buckets ('brand-assets' and 'voiceovers') are NOT touched
-- here -- deleting storage files with SQL leaves them orphaned. Delete the
-- buckets in the Supabase dashboard under Storage instead.

drop policy if exists "owner_select brand_assets bucket" on storage.objects;
drop policy if exists "owner_insert brand_assets bucket" on storage.objects;
drop policy if exists "owner_delete brand_assets bucket" on storage.objects;
drop policy if exists "owner_select voiceovers bucket" on storage.objects;
drop policy if exists "owner_insert voiceovers bucket" on storage.objects;
drop policy if exists "owner_delete voiceovers bucket" on storage.objects;

drop table if exists generated_videos;
drop table if exists video_brand_assets;
