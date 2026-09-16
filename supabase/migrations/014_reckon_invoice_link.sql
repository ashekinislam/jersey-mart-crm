alter table orders add column if not exists reckon_invoice_id text;

create unique index if not exists orders_reckon_invoice_id_idx
  on orders(reckon_invoice_id)
  where reckon_invoice_id is not null;
