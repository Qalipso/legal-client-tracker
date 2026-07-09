-- v0.8.1: hash Telegram connect tokens at rest instead of storing plaintext.
-- Raised by user-shared feedback: if telegram_connect_tokens rows ever leak
-- (bad backup, misconfigured access, compromised service-role key), a
-- plaintext token is immediately usable during its 10-minute window to
-- hijack a notification channel; a hash is not (same reasoning as never
-- storing passwords in plaintext) — worth fixing even though the existing
-- single-use + TTL + RLS protections already made this a narrow window.
--
-- The plaintext token still exists, but only transiently: inside
-- create_telegram_connect_token()'s local variable and its one RETURNING
-- value. It is never written to a persisted column.
--
-- Table is dropped and recreated rather than migrated in place — it holds
-- only ephemeral, single-use, 10-minute-TTL rows; nothing of value survives
-- a drop (confirmed: no pending real connect flow in progress at time of
-- writing, feature shipped minutes earlier in this same session).

drop table if exists telegram_connect_tokens;

create table telegram_connect_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  used_at timestamptz
);

alter table telegram_connect_tokens enable row level security;

create policy "own tokens select" on telegram_connect_tokens
  for select using (user_id = auth.uid());

-- required so create_telegram_connect_token()'s internal insert (which
-- runs as the calling user under security invoker) passes RLS
create policy "own tokens insert" on telegram_connect_tokens
  for insert with check (user_id = auth.uid());

create or replace function public.create_telegram_connect_token()
returns table(token text, expires_at timestamptz)
language plpgsql
security invoker
-- pgcrypto (gen_random_bytes/digest) lives in the `extensions` schema on
-- Supabase, not `public` — must be on the search_path or the unqualified
-- calls below fail with "function ... does not exist"
set search_path = public, extensions
as $$
declare
  raw_token text := encode(gen_random_bytes(20), 'hex');
  v_expires_at timestamptz := now() + interval '10 minutes';
begin
  insert into telegram_connect_tokens (user_id, token_hash, expires_at)
  values (auth.uid(), encode(digest(raw_token, 'sha256'), 'hex'), v_expires_at);

  return query select raw_token, v_expires_at;
end;
$$;

grant execute on function public.create_telegram_connect_token() to authenticated;
