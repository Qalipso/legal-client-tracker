-- Notification settings: single-row table, recipient configured from the UI

create table if not exists settings (
  id int primary key default 1 check (id = 1),
  telegram_chat_id text,
  notify_on_new_client boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into settings (id) values (1) on conflict do nothing;

alter table settings enable row level security;
create policy "mvp anon access" on settings for all using (true) with check (true);
