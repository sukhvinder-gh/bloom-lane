-- Migration 029: Flower-business self-declaration for B2B buyer eligibility
--
-- Lightweight default for "flower business + ABN -> may qualify wholesale,
-- otherwise retail" and the general legitimacy-verification ask: a
-- self-declaration checkbox at registration, surfaced to admin alongside
-- the existing ABN verify/revoke actions on the buyer review screen. Real
-- gating remains the existing admin-driven abn_verified flow — this just
-- gives the admin a signal to review, rather than building new automated
-- verification.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS flower_related_business BOOLEAN;

-- NOTE: the migrations on file only ever had handle_new_user() write
-- id/email/full_name/role — business_name/abn/phone were clearly being
-- captured somewhere in production (real buyer profiles have them
-- populated) that isn't reflected in any committed migration, likely a
-- direct edit made in the Supabase SQL editor. Re-declaring the fuller
-- version here (CREATE OR REPLACE is idempotent/safe either way) closes
-- that drift and adds the new field alongside it.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, business_name, phone, abn, flower_related_business)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(
      (NEW.raw_user_meta_data->>'role')::user_role,
      'buyer_b2c'::user_role
    ),
    NULLIF(NEW.raw_user_meta_data->>'business_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    NULLIF(NEW.raw_user_meta_data->>'abn', ''),
    (NEW.raw_user_meta_data->>'flower_related_business')::boolean
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
