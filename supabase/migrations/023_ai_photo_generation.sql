-- Tracks the prompt used for AI-generated brand photos (null = a real
-- uploaded photo, not AI-generated).
alter table video_brand_assets add column if not exists generation_prompt text;
