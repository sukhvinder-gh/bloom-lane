-- Migration 030: Fix handle_new_user() — migration 029 broke new signups
--
-- 029 speculatively added business_name/phone/abn to the trigger's INSERT,
-- assuming they explained why real profiles have those fields populated in
-- production. That assumption was wrong somewhere (exact mechanism unclear)
-- and the redefined trigger broke auth.users insert entirely — "Database
-- error creating new user" on every signup. Reverting to the original
-- minimal shape from migration 004, plus only the one new field this
-- project actually needs (flower_related_business). Do not reintroduce
-- business_name/phone/abn here without first confirming in a non-prod
-- environment.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, flower_related_business)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(
      (NEW.raw_user_meta_data->>'role')::user_role,
      'buyer_b2c'::user_role
    ),
    (NEW.raw_user_meta_data->>'flower_related_business')::boolean
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
