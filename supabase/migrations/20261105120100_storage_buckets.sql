-- Recipe Swap: storage buckets and object policies.
-- Path convention: <user_id>/<...>, e.g. <user_id>/<recipe_id>/<uuid>.jpg or <user_id>/avatar.png

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('recipe-photos', 'recipe-photos', true, 5242880,
   array['image/jpeg', 'image/png', 'image/webp']),
  ('avatars', 'avatars', true, 2097152,
   array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "Public read for recipe photos and avatars" on storage.objects
  for select to anon, authenticated
  using (bucket_id in ('recipe-photos', 'avatars'));

create policy "Users upload into own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('recipe-photos', 'avatars')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users update files in own folder" on storage.objects
  for update to authenticated
  using (
    bucket_id in ('recipe-photos', 'avatars')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id in ('recipe-photos', 'avatars')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users or admins delete files" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('recipe-photos', 'avatars')
    and ((storage.foldername(name))[1] = (select auth.uid())::text
         or (select public.is_admin()))
  );
