-- Create public storage bucket for product images
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,  -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- Allow authenticated users (growers + admins) to upload
create policy "Authenticated users can upload product images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-images');

-- Allow public read access
create policy "Product images are publicly readable"
  on storage.objects for select
  to public
  using (bucket_id = 'product-images');

-- Allow owners and admins to delete
create policy "Owners can delete their product images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-images' and auth.uid()::text = (storage.foldername(name))[1]);
