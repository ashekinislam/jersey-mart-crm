-- Run this in Supabase SQL Editor: the player order form now has a
-- "Notes / Special Request" column instead of shorts size for some teams.
alter table players add column if not exists notes text;
