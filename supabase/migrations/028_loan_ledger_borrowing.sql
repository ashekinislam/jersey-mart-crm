-- Borrowing: money someone lends TO the business, and the business paying it back.
--   borrowed       -  the business owes them more (balance moves toward "you owe them")
--   repaid_by_you  +  the business paid them back (balance moves back toward settled)
-- Balances still net off per person, so lending and borrowing with the same person
-- cancel correctly.

alter table loan_entries drop constraint if exists loan_entries_kind_check;
alter table loan_entries
  add constraint loan_entries_kind_check
  check (kind in ('lent', 'supplier_bill', 'shipping', 'repayment', 'borrowed', 'repaid_by_you'));
