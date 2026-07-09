-- v0.5: user roles (admin/lawyer/assistant) with real enforcement,
-- profile avatars via Supabase Storage.

-- ── profile: role + avatar ────────────────────────────────────────────────
alter table profiles add column if not exists avatar_url text;
alter table profiles add column if not exists role text not null default 'lawyer'
  check (role in ('admin', 'lawyer', 'assistant'));

-- role is intentionally NOT self-editable from the app (see docs/architecture.md):
-- assigning it here would let a user grant themselves admin. Until a team/
-- workspace model exists, role changes are a direct-DB operation:
--   update profiles set role = 'assistant' where id = '<user_id>';

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid();
$$;

-- ── enforcement: assistant cannot delete clients (soft delete) ─────────────
create or replace function public.forbid_assistant_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() = 'assistant'
     and old.deleted_at is null and new.deleted_at is not null then
    raise exception 'insufficient_privilege: assistants cannot delete clients';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_forbid_assistant_delete on clients;
create trigger trg_forbid_assistant_delete
  before update on clients
  for each row execute function public.forbid_assistant_delete();

-- ── enforcement: assistant cannot change notification config ──────────────
drop policy if exists "own settings" on account_settings;
create policy "own settings" on account_settings for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.current_user_role() <> 'assistant');

drop policy if exists "own recipients" on notification_recipients;
create policy "own recipients read" on notification_recipients for select
  using (user_id = auth.uid());
create policy "own recipients write" on notification_recipients for insert
  with check (user_id = auth.uid() and public.current_user_role() <> 'assistant');
create policy "own recipients update" on notification_recipients for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.current_user_role() <> 'assistant');
create policy "own recipients delete" on notification_recipients for delete
  using (user_id = auth.uid() and public.current_user_role() <> 'assistant');

-- ── avatars storage bucket ─────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatar own folder write" on storage.objects;
create policy "avatar own folder write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatar own folder update" on storage.objects;
create policy "avatar own folder update" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatar public read" on storage.objects;
create policy "avatar public read" on storage.objects
  for select using (bucket_id = 'avatars');
