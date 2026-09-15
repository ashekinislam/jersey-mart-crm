alter table orders drop constraint if exists orders_payment_status_check;

alter table orders add constraint orders_payment_status_check
  check (payment_status in ('unpaid', 'partially_paid', 'invoice_sent', 'paid'));
