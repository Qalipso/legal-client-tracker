-- v0.6: task.overdue scheduler — pg_cron calls the notify-telegram edge
-- function once a day for every overdue task/deadline.
--
-- Auth problem: notify-telegram normally resolves auth.uid() from a USER's
-- JWT (see docs/notifications.md). A cron job has no user session — it must
-- notify ALL users' overdue items in one run. Rather than requiring a
-- Supabase CLI secret (not settable from this migration tooling), the
-- shared secret lives in a DB table both sides can reach: the cron
-- function reads it via plain SQL, the edge function reads it via its
-- existing service-role REST calls. Never embedded in committed source.

create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists internal_secrets (
  key text primary key,
  value text not null
);
alter table internal_secrets enable row level security;
-- no policies at all: only service_role (which bypasses RLS) can read this,
-- PostgREST/anon/authenticated get nothing.

insert into internal_secrets (key, value)
values ('cron_shared_secret', encode(gen_random_bytes(24), 'hex'))
on conflict (key) do nothing;

-- one attempt per calendar day per overdue task/deadline: track what we've
-- already notified today via a dedicated table (simpler and more explicit
-- than parsing notification_events.payload for a dedup key).
create table if not exists overdue_notifications_sent (
  entity_type text not null check (entity_type in ('task', 'deadline')),
  entity_id uuid not null,
  sent_on date not null default current_date,
  primary key (entity_type, entity_id, sent_on)
);
alter table overdue_notifications_sent enable row level security;
-- service_role only, same reasoning as internal_secrets.

create or replace function public.notify_overdue_items()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  secret text;
  -- project URL is public (already shipped in the frontend bundle as
  -- VITE_SUPABASE_URL) — not a secret, safe to hardcode here
  fn_url text := 'https://tyyxaxhbkitrgegcltkl.supabase.co/functions/v1/notify-telegram';
begin
  select value into secret from internal_secrets where key = 'cron_shared_secret';

  -- overdue tasks not already notified today
  for rec in
    select t.id, t.user_id, t.title, t.due_date, c.name as client_name
    from tasks t
    join clients c on c.id = t.client_id
    where t.completed = false
      and t.due_date < current_date
      and not exists (
        select 1 from overdue_notifications_sent o
        where o.entity_type = 'task' and o.entity_id = t.id and o.sent_on = current_date
      )
  loop
    perform net.http_post(
      url := fn_url,
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object(
        'internal_secret', secret,
        'user_id', rec.user_id,
        'event_type', 'task.overdue',
        'payload', jsonb_build_object(
          'title', rec.title, 'name', rec.client_name, 'dueDate', rec.due_date
        )
      )
    );
    insert into overdue_notifications_sent (entity_type, entity_id) values ('task', rec.id);
  end loop;

  -- overdue matter deadlines not already notified today
  for rec in
    select d.id, d.user_id, d.title, d.due_date, c.name as client_name
    from matter_deadlines d
    join clients c on c.id = d.client_id
    where d.completed = false
      and d.due_date < current_date
      and not exists (
        select 1 from overdue_notifications_sent o
        where o.entity_type = 'deadline' and o.entity_id = d.id and o.sent_on = current_date
      )
  loop
    perform net.http_post(
      url := fn_url,
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object(
        'internal_secret', secret,
        'user_id', rec.user_id,
        'event_type', 'task.overdue',
        'payload', jsonb_build_object(
          'title', rec.title, 'name', rec.client_name, 'dueDate', rec.due_date
        )
      )
    );
    insert into overdue_notifications_sent (entity_type, entity_id) values ('deadline', rec.id);
  end loop;
end;
$$;

select cron.schedule(
  'notify-overdue-items-daily',
  '0 8 * * *',  -- 08:00 UTC daily
  $$select public.notify_overdue_items();$$
);
