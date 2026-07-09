-- Legal Client Tracker v0.2 — initial schema
-- clients / case_history / tasks / attachments per spec

create extension if not exists "pgcrypto";

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  telegram text,
  status text not null default 'new'
    check (status in ('new', 'in_progress', 'waiting_client', 'closed')),
  comment text,
  case_type text,
  responsible_lawyer text,
  priority text check (priority in ('low', 'medium', 'high')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists case_history (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  type text not null
    check (type in ('client_created', 'client_updated', 'note_added',
                    'status_changed', 'task_created', 'task_completed',
                    'attachment_added')),
  title text,
  text text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  title text not null,
  due_date date,
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists attachments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  file_name text not null,
  file_url text,
  storage_path text,
  file_size integer,
  mime_type text,
  created_at timestamptz not null default now()
);

create index if not exists idx_case_history_client on case_history(client_id, created_at desc);
create index if not exists idx_tasks_client on tasks(client_id);
create index if not exists idx_attachments_client on attachments(client_id);
create index if not exists idx_clients_status on clients(status) where deleted_at is null;

-- MVP: no auth yet — anon key gets full access via permissive RLS policies.
-- When auth lands, replace these with per-user policies.
alter table clients enable row level security;
alter table case_history enable row level security;
alter table tasks enable row level security;
alter table attachments enable row level security;

create policy "mvp anon access" on clients for all using (true) with check (true);
create policy "mvp anon access" on case_history for all using (true) with check (true);
create policy "mvp anon access" on tasks for all using (true) with check (true);
create policy "mvp anon access" on attachments for all using (true) with check (true);
