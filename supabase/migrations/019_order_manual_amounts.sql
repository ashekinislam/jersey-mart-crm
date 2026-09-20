-- Owner-edited amounts shown on the Orders page and dashboard. When set, they
-- take priority over the Reckon invoice figures (which the sync rewrites each
-- time), so an edit isn't undone by the next sync. Clearing them (null) goes
-- back to the Reckon / CRM figures.
--   manual_total = order total the owner has entered
--   manual_paid  = amount paid the owner has entered (unpaid = total - paid)
-- sale_amount is untouched: it still drives profit/margin on the Costs card.

alter table orders add column if not exists manual_total numeric(10,2);
alter table orders add column if not exists manual_paid numeric(10,2);
