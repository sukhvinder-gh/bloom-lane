-- Captures ABN (grower registrations) and the state/postcode an ABR lookup
-- returns for it, so admin's Approve flow can pre-fill those fields instead
-- of asking for them from scratch every time.
alter table interest_registrations
  add column if not exists abn text,
  add column if not exists state text,
  add column if not exists postcode text;
