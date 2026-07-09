-- v1.0: enrich notification_recipients with metadata already present in the
-- Telegram update that creates the row, for the connection-status UI
-- (display_name / username / locale instead of just a raw chat_id).
-- Nullable and channel-agnostic: email recipients and pre-v1.0 manually
-- added telegram recipients simply have nulls here, which the UI treats as
-- "not available", not an error.

alter table notification_recipients
  add column if not exists telegram_username text,
  add column if not exists telegram_locale text;
