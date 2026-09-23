-- Some customers trade under a different name in Reckon than how they're
-- known in the CRM (e.g. a personal name here, a company name on the
-- invoice). Without this, every sync either can't match them at all
-- (creating a fresh duplicate customer each time) or matches nothing and
-- keeps re-drafting forever. This lets the owner record the Reckon-side
-- name once so matching succeeds from then on.
alter table customers add column if not exists reckon_alias text;
