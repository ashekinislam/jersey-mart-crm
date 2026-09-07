-- Run this in Supabase SQL Editor to add the new customer fields
-- (phone, email, address, fabric preference) to an existing database.

alter table customers add column if not exists phone text;
alter table customers add column if not exists email text;
alter table customers add column if not exists address text;
alter table customers add column if not exists fabric_preference text;
