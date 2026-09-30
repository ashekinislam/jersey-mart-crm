-- A private, unguessable link per order so the owner can share live tracking with a
-- customer without giving them a CRM login. No extension required (avoids depending on
-- pgcrypto being enabled) -- built from Postgres's own random()/clock_timestamp().
--
-- The token itself carries no meaning; /track/[token] looks it up with the service-role
-- key (bypassing RLS, since the visitor has no Supabase session) and returns only a
-- small, customer-safe set of fields -- never pricing, costs, or other orders.

alter table orders add column if not exists tracking_share_token text;

update orders
set tracking_share_token = md5(random()::text || clock_timestamp()::text || id::text)
where tracking_share_token is null;

alter table orders
  alter column tracking_share_token
  set default md5(random()::text || clock_timestamp()::text || gen_random_uuid()::text);

alter table orders alter column tracking_share_token set not null;

create unique index if not exists orders_tracking_share_token_idx
  on orders(tracking_share_token);
