-- Editable order date (separate from created_at, which stays a true
-- row-insertion timestamp) plus cost tracking mirroring the Excel ledger's
-- Supplier Cost / Int'l Freight columns, so profit/margin can be derived.

alter table orders add column if not exists order_date date;
update orders set order_date = created_at::date where order_date is null;
alter table orders alter column order_date set not null;
alter table orders alter column order_date set default current_date;

alter table orders add column if not exists sale_amount numeric(10,2);
alter table orders add column if not exists supplier_cost numeric(10,2);
alter table orders add column if not exists freight_cost numeric(10,2);
