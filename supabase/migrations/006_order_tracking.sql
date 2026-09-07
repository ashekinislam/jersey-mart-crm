-- Run this in Supabase SQL Editor.
-- Adds order/payment/shipping tracking fields to customers, plus a private
-- storage bucket for uploaded invoices.

alter table customers add column if not exists deadline date;
alter table customers add column if not exists order_status text not null default 'quote_sent'
  check (order_status in ('quote_sent','deposit_paid','mockup_sent','approved','in_production','shipped','delivered','cancelled'));
alter table customers add column if not exists payment_status text not null default 'unpaid'
  check (payment_status in ('unpaid','invoice_sent','paid'));
alter table customers add column if not exists payment_due_date date;
alter table customers add column if not exists shipping_status text not null default 'not_shipped'
  check (shipping_status in ('not_shipped','at_factory','with_carrier','in_transit_overseas','in_transit_australia','out_for_delivery','delivered','ready_for_pickup','picked_up'));
alter table customers add column if not exists tracking_url text;
alter table customers add column if not exists tracking_number text;
alter table customers add column if not exists invoice_storage_path text;

insert into storage.buckets (id, name, public)
values ('invoices', 'invoices', false)
on conflict (id) do nothing;

create policy "owner_select invoices bucket" on storage.objects
  for select using (
    bucket_id = 'invoices'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "owner_insert invoices bucket" on storage.objects
  for insert with check (
    bucket_id = 'invoices'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "owner_delete invoices bucket" on storage.objects
  for delete using (
    bucket_id = 'invoices'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
