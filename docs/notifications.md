# Notifications — контракт и маршрутизация

## Обзор

Уведомления шлёт Edge Function `notify-telegram`
(`supabase/functions/notify-telegram/index.ts`). Фронтенд вызывает её
fire-and-forget (`src/lib/notify.ts`) — основной сценарий никогда не
блокируется и не ломается от ошибок доставки.

Принципы безопасности:
- `TG_BOT_TOKEN` — только в секретах Supabase; фронтенд его не видит.
- Функция получает **JWT пользователя** (`Authorization: Bearer <access_token>`),
  резолвит `auth.uid()` и работает только с данными этого пользователя.
- `service_role` используется внутри функции (чтение настроек, запись журнала)
  и никогда не покидает её.

## Контракт функции

`POST /functions/v1/notify-telegram`

Заголовки: `Authorization: Bearer <user JWT>`, `apikey: <anon key>`,
`Content-Type: application/json`.

```jsonc
// запрос
{ "event_type": "client.created", "payload": { "name": "…", "phone": "…", "status": "…" } }

// успех
{ "sent": true, "delivered": 2, "failed": 0 }

// нечего/некуда отправлять (не ошибка для UI)
{ "skipped": true, "reason": "нет активных получателей — добавьте chat ID в настройках" }

// нет/невалидный JWT
{ "error": "unauthorized" }   // HTTP 401
```

## События

| event_type | Триггер в UI | Тумблер в account_settings | Статус |
|---|---|---|---|
| `client.created` | добавление клиента | `notify_on_client_created` | [Implemented] |
| `task.created` | добавление задачи | `notify_on_client_created` (MVP: общий) | [Implemented] |
| `status.changed` | смена статуса (select/drag-and-drop) | `notify_on_status_changed` (по умолчанию выкл) | [Implemented] |
| `test` | кнопка Send test в настройках | игнорирует тумблеры (явное действие) | [Implemented] |
| `task.overdue` | планировщик | `notify_on_task_overdue` | [Planned] — схема и тексты готовы, нужен pg_cron |

Общий выключатель `telegram_enabled` глушит все события, кроме `test`.

## Порядок обработки

1. JWT → `auth.uid()` (через `GET /auth/v1/user`); нет пользователя → 401.
2. `account_settings` пользователя: `telegram_enabled` → тумблер события.
3. `TG_BOT_TOKEN` из секретов.
4. `notification_recipients`: `is_active = true`, `channel = 'telegram'`.
5. `sendMessage` каждому получателю.
6. **Каждая попытка** (и каждый skip) пишется в `notification_events`.

## Журнал `notification_events`

| Колонка | Значение |
|---|---|
| `event_type` | тип события |
| `recipient_id` | получатель (null для skip до выбора получателей) |
| `status` | `sent` / `error` / `skipped` |
| `error` | причина skip или ошибка Telegram API (например, `Bad Request: chat not found`) |
| `payload` | исходные данные события (jsonb) |
| `created_at` / `sent_at` | попытка / фактическая отправка |

RLS: пользователь читает только свои события (страница Настройки →
История уведомлений); запись — только через функцию (service role).

## Типовые причины «не доставлено»

| Причина в журнале | Что делать |
|---|---|
| `TG_BOT_TOKEN не задан в секретах Supabase` | задать секрет (docs/setup.md §3) |
| `нет активных получателей…` | добавить chat ID в настройках |
| `Bad Request: chat not found` | chat ID неверный, или получатель не написал боту первым |
| `Telegram-уведомления выключены…` / `событие … выключено` | включить тумблер в настройках |
