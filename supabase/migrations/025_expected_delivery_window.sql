-- A customer-facing estimated delivery window, shown on the public /track/[token] page.
-- Separate from `deadline`, which is the owner's internal "needed by" date and is never shown.
alter table orders add column if not exists expected_delivery_from date;
alter table orders add column if not exists expected_delivery_to date;
