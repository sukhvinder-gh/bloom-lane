-- Migration 031: Fix "type user_role does not exist" in handle_new_user()
--
-- Every signup was failing with Postgres error 42704 ("type user_role does
-- not exist") the instant the trigger tried `(...)::user_role`. The
-- function is SECURITY DEFINER without a pinned search_path, so at
-- execution time (fired by the auth.users insert, not the SQL editor
-- session that created it) Postgres wasn't resolving the unqualified enum
-- name. Schema-qualifying the cast and explicitly pinning search_path is
-- the standard fix — and good practice for any SECURITY DEFINER function
-- regardless, since an unpinned search_path is also a privilege-escalation
-- risk if a malicious "public" object could ever shadow it.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, flower_related_business)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(
      (NEW.raw_user_meta_data->>'role')::public.user_role,
      'buyer_b2c'::public.user_role
    ),
    (NEW.raw_user_meta_data->>'flower_related_business')::boolean
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
