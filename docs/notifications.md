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

## Входящий webhook: подключение Telegram

Функция `telegram-webhook` (`supabase/functions/telegram-webhook/index.ts`)
обрабатывает два пути `/start`:

1. **`/start connect_<token>`** (v0.8, основной путь) — токен минтится
   фронтендом (`telegram_connect_tokens`, migration 009: crypto-random,
   single-use, TTL 10 минут) при клике «📎 Подключить Telegram». Webhook
   атомарно "заявляет" токен (`PATCH … where used_at is null and
   expires_at > now()` — гонка/replay возвращают 0 строк второму запросу),
   резолвит `user_id`, создаёт `notification_recipients` сам и отвечает
   подтверждением. Пользователь никогда не видит и не вводит chat_id.
2. **Plain `/start`** (fallback) — на случай истёкшего/потерянного токена:
   отвечает голым chat_id для ручного ввода в Настройках. Раньше это был
   единственный путь (заменял сторонний бот `@userinfobot`); теперь это
   запасной вариант, а не основной UX.

**Контракт:**
- `GET /functions/v1/telegram-webhook` — регистрирует саму функцию как
  webhook бота через `setWebhook` (URL всегда self-referential — нельзя
  перенаправить на чужой адрес через запрос). Вызывается один раз при
  настройке; повторные вызовы безопасны (идемпотентно).
- `POST /functions/v1/telegram-webhook` — принимает Telegram Update.
  Заголовок `X-Telegram-Bot-Api-Secret-Token` должен совпадать с
  захардкоженным `WEBHOOK_SECRET` (не секрет доступа в полном смысле —
  Telegram сам это гарантирует при регистрации через `secret_token`;
  здесь просто отсекает случайные POST на публичный URL). Несовпадение → 401.
- Функция задеплоена с `verify_jwt: false` — Telegram не может послать
  Supabase JWT, эндпоинт обязан быть публичным.

**Ответ бота** на любое сообщение:
```
Привет[, Имя]! Я Элли — ассистентка Legal Client Tracker.
Буду присылать сюда уведомления: новый клиент, просроченный срок, смена статуса дела.

Ваш chat ID: <chat_id>
Вставьте его в приложении: Настройки → Получатели → Добавить.

Я не даю юридических советов и не пишу первой без повода — только слежу, чтобы важное не потерялось.
```

Проверено: регистрация webhook (`GET` → `{"ok":true,"result":true}`),
обработка синтетического `/start`-апдейта (200, лог подтверждён), отказ
при неверном секрете (401). Для connect-flow (v0.8) — прямой POST на
проде, три сценария: валидный токен → получатель создан; тот же токен
повторно → получатель НЕ создан (replay заблокирован); истёкший токен →
получатель НЕ создан (TTL соблюдён). См. CHANGELOG v0.8.
