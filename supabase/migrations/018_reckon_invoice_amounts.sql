-- Amounts from the linked Reckon invoice, refreshed on every Reckon sync, so the
-- Orders page and dashboard can show total / paid / unpaid per order.
--   reckon_total   = invoice grand total (GST-inclusive)
--   reckon_balance = amount still owing on the invoice (0 when fully paid)
-- Paid is derived as total - balance. sale_amount is left alone: it's the
-- owner-editable figure used for profit/margin, and may differ from the invoice.

alter table orders add column if not exists reckon_total numeric(10,2);
alter table orders add column if not exists reckon_balance numeric(10,2);
