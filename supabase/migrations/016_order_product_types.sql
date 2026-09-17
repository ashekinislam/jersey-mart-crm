alter table orders add column if not exists product_types text[] not null default '{}';
