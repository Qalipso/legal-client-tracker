-- Minimal server-side analytics: activation/retention as read-only views over
-- existing tables (profiles, clients, case_history) — no new event table, no
-- client-side tracking. case_history already logs every meaningful user
-- action (client_created, status_changed, task_created, ...) with user_id
-- and created_at, which is exactly what activation/retention need.
--
-- Not exposed to the app UI: owner-only, queried via the Supabase SQL editor
-- (service role), so no RLS policy is added — the views are simply not
-- granted to `authenticated`/`anon`.

-- Activation: first case_history event after signup, and whether the user
-- created a client (the product's core "aha moment" — an empty tracker is
-- not a used tracker) within their first 3 days.
create or replace view user_activation
  with (security_invoker = true) as
select
  p.id as user_id,
  p.email,
  p.created_at as signed_up_at,
  min(c.created_at) as first_client_created_at,
  min(c.created_at) is not null
    and min(c.created_at) <= p.created_at + interval '3 days' as activated_within_3d,
  count(distinct c.id) as clients_created
from profiles p
left join clients c on c.user_id = p.id
group by p.id, p.email, p.created_at;

-- Weekly activity: distinct days with at least one case_history event per
-- ISO week, per user — the input to a retention curve.
create or replace view user_weekly_activity
  with (security_invoker = true) as
select
  ch.user_id,
  date_trunc('week', ch.created_at) as week_start,
  count(distinct ch.created_at::date) as active_days,
  count(*) as events
from case_history ch
where ch.user_id is not null
group by ch.user_id, date_trunc('week', ch.created_at);

-- Retention summary: of the weeks since signup, how many had any activity.
create or replace view user_retention_summary
  with (security_invoker = true) as
select
  p.id as user_id,
  p.email,
  p.created_at as signed_up_at,
  greatest(1, ceil(extract(epoch from (now() - p.created_at)) / 604800)::int) as weeks_since_signup,
  count(distinct wa.week_start) as weeks_active,
  round(
    count(distinct wa.week_start)::numeric
      / greatest(1, ceil(extract(epoch from (now() - p.created_at)) / 604800)::int),
    2
  ) as retention_ratio
from profiles p
left join user_weekly_activity wa on wa.user_id = p.id
group by p.id, p.email, p.created_at;

revoke all on user_activation, user_weekly_activity, user_retention_summary
  from public, anon, authenticated;
