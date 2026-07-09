-- v0.8.2: prevent duplicate recipients on reconnect.
-- Found via real end-to-end testing of the Telegram connect flow: tapping
-- Start on an already-connected chat created a second notification_recipients
-- row for the same (user_id, channel, destination) -- meaning the same chat
-- would receive every notification twice. telegram-webhook now upserts on
-- this constraint instead of blindly inserting.

alter table notification_recipients
  add constraint notification_recipients_unique_destination
  unique (user_id, channel, destination);
