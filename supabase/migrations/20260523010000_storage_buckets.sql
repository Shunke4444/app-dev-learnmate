-- Two private buckets. Path convention: <user_uuid>/<filename>.
-- 25MB per file. Owner-only RLS on storage.objects.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'note-audio',
    'note-audio',
    false,
    26214400,  -- 25 MiB
    array['audio/webm','audio/ogg','audio/mpeg','audio/mp4','audio/wav','audio/x-wav','audio/x-m4a']
  ),
  (
    'research-uploads',
    'research-uploads',
    false,
    26214400,
    array['application/pdf','image/png','image/jpeg','image/webp','text/plain','text/markdown']
  )
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Owner-only policies. Path's first folder must equal auth.uid().
do $$
declare
  b text;
begin
  foreach b in array array['note-audio','research-uploads'] loop
    execute format(
      'drop policy if exists "%1$s owner select" on storage.objects;
       create policy "%1$s owner select" on storage.objects for select to authenticated
         using (bucket_id = %1$L and (storage.foldername(name))[1] = auth.uid()::text);',
      b);
    execute format(
      'drop policy if exists "%1$s owner insert" on storage.objects;
       create policy "%1$s owner insert" on storage.objects for insert to authenticated
         with check (bucket_id = %1$L and (storage.foldername(name))[1] = auth.uid()::text);',
      b);
    execute format(
      'drop policy if exists "%1$s owner update" on storage.objects;
       create policy "%1$s owner update" on storage.objects for update to authenticated
         using (bucket_id = %1$L and (storage.foldername(name))[1] = auth.uid()::text)
         with check (bucket_id = %1$L and (storage.foldername(name))[1] = auth.uid()::text);',
      b);
    execute format(
      'drop policy if exists "%1$s owner delete" on storage.objects;
       create policy "%1$s owner delete" on storage.objects for delete to authenticated
         using (bucket_id = %1$L and (storage.foldername(name))[1] = auth.uid()::text);',
      b);
  end loop;
end $$;
