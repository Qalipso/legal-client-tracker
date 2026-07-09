-- v0.8: token-based Telegram connect flow, replacing manual chat-ID copy/paste.
-- User clicks "Подключить Telegram" -> we mint a short-lived, single-use,
-- crypto-random token -> opens t.me/<bot>?start=connect_<token> -> the bot's
-- webhook resolves the token to a user_id and creates the recipient itself.
--
-- Security properties (see telegram-webhook/index.ts for the consuming side):
-- - token is gen_random_bytes-based, not guessable/sequential
-- - single-use: used_at is set the moment it's consumed, checked before reuse
-- - short expiry (10 min): stale links from old screenshots/chat logs can't
--   be replayed later to hijack a notification channel

create table if not exists telegram_connect_tokens (
  token text primary key default encode(gen_random_bytes(20), 'hex'),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  used_at timestamptz
);

alter table telegram_connect_tokens enable row level security;

-- authenticated users can create and read only their own tokens; the webhook
-- consumes/marks-used tokens via the service-role key, which bypasses RLS,
-- so no update/delete policy is needed for the authenticated role at all.
create policy "own tokens select" on telegram_connect_tokens
  for select using (user_id = auth.uid());

create policy "own tokens insert" on telegram_connect_tokens
  for insert with check (user_id = auth.uid());
