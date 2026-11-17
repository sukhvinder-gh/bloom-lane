-- Register-interest only collected a loose "region" string, so admin's
-- Approve dialog always needed a street address typed in from scratch.
-- Capturing it upfront (same address/suburb/state/postcode shape as that
-- dialog) lets the dialog pre-fill it like it already does for suburb/state/postcode.
alter table interest_registrations
  add column if not exists address text;
