-- v0.3: auth, user-owned data, account settings, notification routing

-- profiles: 1:1 with auth.users
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  company_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists account_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  telegram_enabled boolean not null default true,
  notify_on_client_created boolean not null default true,
  notify_on_task_overdue boolean not null default true,
  notify_on_status_changed boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists notification_recipients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  channel text not null default 'telegram' check (channel in ('telegram')),
  destination text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- delivery attempt log (written by the edge function via service role)
create table if not exists notification_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  event_type text not null,
  recipient_id uuid references notification_recipients(id) on delete set null,
  channel text,
  status text not null check (status in ('sent', 'error', 'skipped')),
  error text,
  payload jsonb,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists idx_notification_events_user
  on notification_events(user_id, created_at desc);

-- ownership on core tables; default auth.uid() so authed inserts need no code change
alter table clients add column if not exists user_id uuid default auth.uid() references auth.users(id);
alter table case_history add column if not exists user_id uuid default auth.uid() references auth.users(id);
alter table tasks add column if not exists user_id uuid default auth.uid() references auth.users(id);
alter table attachments add column if not exists user_id uuid default auth.uid() references auth.users(id);
create index if not exists idx_clients_user on clients(user_id);
create index if not exists idx_tasks_user on tasks(user_id);
create index if not exists idx_case_history_user on case_history(user_id);
create index if not exists idx_attachments_user on attachments(user_id);

-- per-user RLS replaces the MVP permissive policies
drop policy if exists "mvp anon access" on clients;
drop policy if exists "mvp anon access" on case_history;
drop policy if exists "mvp anon access" on tasks;
drop policy if exists "mvp anon access" on attachments;

create policy "own rows" on clients for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on case_history for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on tasks for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on attachments for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table profiles enable row level security;
create policy "own profile" on profiles for all
  using (id = auth.uid()) with check (id = auth.uid());

alter table account_settings enable row level security;
create policy "own settings" on account_settings for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table notification_recipients enable row level security;
create policy "own recipients" on notification_recipients for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table notification_events enable row level security;
create policy "own events read" on notification_events for select
  using (user_id = auth.uid());

-- auto-provision profile + default settings on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
    on conflict (id) do nothing;
  insert into public.account_settings (user_id) values (new.id)
    on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- single-tenant settings table is superseded by account_settings
drop table if exists settings;
