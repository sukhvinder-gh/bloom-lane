-- Migration 043: create the delivery-photos storage bucket.
--
-- It was referenced by code (proof-of-pickup/delivery photo uploads,
-- delivery QR codes) since early in the project but never actually created —
-- every upload to it silently failed with "Bucket not found", which the
-- farmer Orders page had no error handling for, so growers just saw the
-- Upload button hang on "Uploading…" forever with no explanation.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'delivery-photos',
  'delivery-photos',
  true,
  10485760,  -- 10 MB, matches the ppod route's own size check
  array['image/jpeg', 'image/png']
)
on conflict (id) do nothing;

-- Uploads go through the service-role admin client (bypasses RLS), but this
-- policy is added for consistency with the product-images bucket and in case
-- anything ever uploads via a user-scoped client instead.
create policy "Authenticated users can upload delivery photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'delivery-photos');

create policy "Delivery photos are publicly readable"
  on storage.objects for select
  to public
  using (bucket_id = 'delivery-photos');
