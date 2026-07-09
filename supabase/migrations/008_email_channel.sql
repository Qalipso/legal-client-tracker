-- v0.6: email notification channel (scaffold).
-- Adds 'email' as a valid notification_recipients.channel value and an
-- account_settings.email_enabled toggle, mirroring the existing telegram
-- pattern. Delivery itself needs a Resend/Postmark API key set as an edge
-- function secret (RESEND_API_KEY, RESEND_FROM_EMAIL) — not settable from
-- this migration tooling, so actual email delivery is [Not verified] until
-- someone configures it. See docs/features.md.

alter table notification_recipients
  drop constraint if exists notification_recipients_channel_check;
alter table notification_recipients
  add constraint notification_recipients_channel_check
  check (channel in ('telegram', 'email'));

alter table account_settings
  add column if not exists email_enabled boolean not null default false;
