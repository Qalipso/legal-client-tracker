-- v0.6: real file upload for case documents.
-- Unlike avatars (public bucket), case documents are sensitive data
-- (docs/security.md §2) — bucket is private; access only via owner RLS.

insert into storage.buckets (id, name, public)
values ('case-documents', 'case-documents', false)
on conflict (id) do nothing;

-- path convention: {user_id}/{client_id}/{attachment_id}-{filename}
drop policy if exists "case docs own folder all" on storage.objects;
create policy "case docs own folder all" on storage.objects
  for all to authenticated
  using (bucket_id = 'case-documents' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'case-documents' and (storage.foldername(name))[1] = auth.uid()::text);
