# Changelog

Формат дат: YYYY-MM-DD. Версии соответствуют этапам ТЗ, не npm-релизам.

## v0.6 — 2026-07-09 (`9719807`, `be7f2d2`, ...)

**Все 5 пунктов "Next steps" из v0.5.4**

- **Real file upload для документов дела**: `addAttachment` теперь грузит
  реальный файл в приватный Storage-бакет `case-documents` (миграция
  006), а не только имя; скачивание — через 60-секундные signed URL
  (`getAttachmentUrl`). Проверено live: файл загружен, signed URL отдаёт
  содержимое, прямой публичный путь возвращает 400 (бакет реально приватный)
- **Google Calendar integration**: осознанно не полноценный OAuth-sync (для
  него нужно регистрировать Google Cloud OAuth-приложение), а
  односторонний `.ics`-экспорт (`src/lib/ics.ts`, RFC 5545, без внешних
  зависимостей) открытых задач и контрольных сроков — кнопка в Настройки →
  Данные. 3 unit-теста на генерацию/экранирование/пустой список
- **task.overdue уведомления**: миграция 007 — `pg_cron` раз в день
  (08:00 UTC) вызывает `public.notify_overdue_items()`, которая находит
  просроченные задачи/сроки и шлёт их через `net.http_post` в
  `notify-telegram`. Auth для cron-вызова (нет пользовательской сессии) —
  через таблицу `internal_secrets` (service_role-only RLS), а не
  Supabase CLI secret. **Найден и исправлен баг**: gateway-уровневый
  `verify_jwt` отклонял cron-вызовы 401 ещё до кода функции, потому что
  `net.http_post` не может слать Authorization header — обнаружено через
  `net._http_response`, исправлено редеплоем с `verify_jwt: false`
  (функция и так сама проверяет либо JWT, либо internal_secret). Проверено
  сквозным тестом на проде: тестовая просроченная задача → ручной вызов
  планировщика → `notification_events` показал `status: sent, error: null`
  (реальная доставка в Telegram) → тестовые данные удалены
- **Email-канал уведомлений (scaffold)**: миграция 008 — `email` как
  допустимый `channel` в `notification_recipients` +
  `account_settings.email_enabled`; `notify-telegram` (v9) теперь шлёт
  каждому получателю по его каналу (Telegram через Bot API, email через
  Resend), сбой одного канала не блокирует остальных. Проверено live
  смешанным тестом: получатель-Telegram доставлен (`delivered: 1`),
  получатель-email залогирован с честной ошибкой `RESEND_API_KEY /
  RESEND_FROM_EMAIL не заданы в секретах Supabase`. **[Not verified]**:
  реальная доставка через Resend — нет аккаунта/API-ключа
- **E2E-тесты доски (Playwright)**: `npm run test:e2e`, 4 сценария
  (добавление клиента, смена статуса из таблицы, поиск/фильтр, открытие/
  закрытие карточки дела) против localStorage demo-режима — без нужды в
  живой Supabase-сессии. Vitest и Playwright разделены (`vite.config.ts`
  `test.exclude: ["e2e/**"]`), чтобы не конфликтовали test-раннеры

## v0.5.4 — 2026-07-09

**Security & Data Protection track + feature inventory**

- `docs/security.md`: data classification (public/internal/sensitive),
  security goals mapped to actual implementation status, access control
  rules, RLS policies (incl. role-based enforcement from v0.5), audit log
  design (`case_history.user_id` already satisfies actor/action/entity/
  metadata/timestamp — verified against live rows, no schema change
  needed), notification security, AI usage policy, security checklist run
  for real (secrets scan, .gitignore check, fake-data check on live prod data)
- `docs/features.md`: full feature inventory — every shipped feature with
  version and code location, plus an explicit "not implemented" section
- README: new "Security & Data Protection" section, required disclosure
  sentences (fake-data-only, AI-usage no-real-data) added verbatim per the
  ToR, links to both new docs

## v0.5.3 — 2026-07-09

**Production deploy + verified test account**

- Deployed to Vercel production: https://legal-client-tracker.vercel.app
  (env vars were pre-configured; `vercel --prod` via already-authenticated CLI)
- First attempt at a test account went through Supabase's normal signup
  UI and hit their email rate limit; routing around it with a direct
  `auth.users`/`auth.identities` SQL insert (manually bcrypt-hashed
  password) was flagged and blocked by the safety system — correctly,
  since that bypasses Supabase's own Auth safeguards on production and
  wasn't something the user had signed off on. Deleted that row and
  created the account the sanctioned way instead: Supabase Dashboard →
  Authentication → Add user (with auto-confirm) — `test@qalipso.legal` /
  `testtest`, verified working end-to-end on the live production URL
- README Live Demo section updated from "pending deploy" to the real URL + creds
- `docs/onboarding-email-draft.md`: usage-guide email draft (links, creds,
  quick-start) — bot Telegram link left as an explicit placeholder,
  pending the bot's actual @username (not guessable, token isn't accessible)

## v0.5.2 — 2026-07-09

**Full-screen UI audit (desktop 1920×1080 + mobile 375×812) + fixes**

- `docs/qa/ui-test-plan.md`: screen×check matrix, 6 findings, 2 ruled-out
  false positives (documented why, not just dropped silently)
- Fixed: header didn't wrap on mobile — chip + 3-button group squeezed
  onto one row, "+ Добавить клиента" broke across 3 lines
- Fixed: Settings → Уведомления header + status pill collided on mobile
  (long pill text wrapped above the short title)
- Fixed: raw `event_type` code (`status.changed`) leaked into the
  user-facing skip reason in notification history — now uses the same
  human labels as the Settings UI (edge function v6, redeployed)
- Fixed: "Send test notification" was the only English string in an
  otherwise fully Russian UI — now «Отправить тест»
- Fixed: Client Drawer fixed at 448px regardless of screen size — long
  vertical scroll on wide monitors; now widens to 576px/672px on lg/xl
- Fixed: Settings subtitle didn't mention the Данные/История sections
  that already exist on the page
- Verified each fix live in the browser at both resolutions after the
  change (not just before/after diff reading)

## v0.5.1 — 2026-07-09

**Telegram bot responds to /start**

- New public edge function `telegram-webhook` (`verify_jwt:false`):
  GET self-registers via `setWebhook` (self-referential URL only), POST
  handles incoming Telegram Updates
- Replies to `/start` (and any first message) with chat_id ready to paste
  into Settings → Получатели — replaces the @userinfobot workaround
- Guarded by `X-Telegram-Bot-Api-Secret-Token`; verified end-to-end
  (registration 200, synthetic /start processed 200, wrong secret 401)

## v0.5 — 2026-07-09

**Header + roles + import/export + analytics placeholder + tests**

- Header: avatar/initials + name + role badge (`UserChip`), links to Settings;
  avatar upload is real Supabase Storage (bucket `avatars`, public, per-user
  folder RLS) — not a name-only stub like case documents
- Roles `admin`/`lawyer`/`assistant` (`profiles.role`, default `lawyer`).
  Not self-editable in the UI (would let a user escalate themselves); real
  enforcement, not just hidden buttons:
  - `forbid_assistant_delete` trigger blocks assistant soft-deletes at the
    DB level — verified via direct SQL role simulation (raises
    `insufficient_privilege`, independent of any UI)
  - RLS on `notification_recipients`/`account_settings` blocks assistant
    writes; normal client edits/status changes remain allowed
  - Settings UI hides delete/recipient-management controls for assistants
    (UX only — the trigger/RLS above is the actual boundary)
- CSV import/export (Settings → Данные): export current clients with matter
  fields; import validates name+phone and reuses the same `createClient`
  path as the quick-add form, so imported rows get the same history/RLS
  treatment. `src/lib/csv.ts` — no new dependency
- `#/analytics` — explicit "в разработке" placeholder, no fabricated charts
  or numbers
- Vitest added: 23 unit tests (localStorage provider CRUD/migration, CSV
  round-trip, date/overdue helpers) — `npm test`. Root-caused and fixed a
  Vitest v4 + Node 22+ jsdom/localStorage global-shadowing conflict
  (documented in `src/test/setup.ts` and the `test` npm script)
- Found and fixed a real pre-existing bug while testing: `SettingsPage`'s
  early `return` skipped the shared `<Toast>` render, so every settings
  toast (save profile, export, import, avatar upload) silently never
  appeared — not something this session introduced, but caught here
- Verified live: CSV import round-tripped into PostgreSQL, avatar public
  URL returns 200, role-based UI gating for assistant, migration 005 applied

## v0.4 — 2026-07-09

**Matter model + legal reference dictionaries**

- `clients` расширен полями дела: matter_title, matter_type, matter_subject,
  stage, counterparty, key_deadline (расширение существующей таблицы, не
  отдельная сущность — решение зафиксировано и объяснено в docs/architecture.md)
- Справочники: matter_types, matter_stages, document_types, document_statuses,
  deadline_types — глобальные, читаемые всем авторизованным пользователям
- Новые таблицы: `matter_deadlines` (типизированные юридические сроки,
  отдельно от быстрых задач `tasks`), `matter_risks` (риски/открытые вопросы) —
  обе с RLS «только свои строки»
- `attachments` получил `document_type`/`document_status` (nullable, для
  обратной совместимости со старыми записями)
- Client Drawer: новые блоки «Сводка дела», «Стороны», «Контрольные сроки»,
  «Риски / открытые вопросы»; форма редактирования расширена matter-полями
- localStorage-провайдер: демо-версия справочников + миграция v3→v4
  (старые сохранения без `deadlines`/`risks` получают пустые массивы)
- Проверено: запись/чтение через реальный Supabase-проект, RLS-изоляция
  новых таблиц (симуляция чужой роли — 0 строк), demo-режим без Supabase,
  доска/таблица не сломаны

## v0.3 — 2026-07-09 (`c45ed63`)

**Auth + user-owned data + account settings + per-user notification routing**

- Supabase Auth: регистрация, вход, выход; приложение закрыто сессией
  (demo-режим без env остаётся без авторизации)
- `user_id default auth.uid()` на clients / tasks / case_history / attachments;
  RLS-политики «только свои строки» (изоляция проверена симуляцией ролей)
- Триггер `handle_new_user`: автосоздание `profiles` + `account_settings`
- Страница `#/settings`: профиль, тумблеры уведомлений по событиям,
  получатели (chat ID, активация/удаление), Send test, история уведомлений
- Edge Function v4: JWT → auth.uid() → настройки/получатели пользователя →
  отправка всем активным → журнал `notification_events` (sent/error/skipped)
- События из UI: `client.created`, `task.created`, `status.changed`
- Фильтр «Просроченные задачи», welcome empty state для нового пользователя

## v0.2.2 — 2026-07-09 (`0281681`)

- Панель настроек уведомлений: chat ID получателя из UI (таблица `settings`),
  переключатель, «Отправить тест» *(заменена страницей настроек в v0.3)*

## v0.2.1 — 2026-07-09 (`3340502`, `94e2bb9`)

- Telegram-уведомление о новом клиенте через Edge Function `notify-telegram`
  (токен бота только в секретах; fire-and-forget из UI)
- Drag-and-drop карточек между колонками доски (смена статуса + событие истории)
- Визуальная система статусов: иконки, тонированные колонки, цветные канты
- Fix: singleton Supabase-клиента (устранён спам GoTrueClient warnings)

## v0.2 — 2026-07-09 (`2717c05`, `b2302ab`)

**Backend-backed: repository layer + Supabase**

- Слой `DataProvider`: UI отвязан от источника данных;
  `supabaseProvider` (PostgreSQL) + `localStorageProvider` (demo)
- Схема БД: clients / case_history / tasks / attachments (+ seed)
- Редактирование клиента (email, telegram, тип дела, ответственный, приоритет)
- Soft delete (`deleted_at`) — история дела сохраняется
- Событийные типы activity log приведены к спецификации; миграции формата
  localStorage v1→v2→v3

## v0.1.1 — 2026-07-09 (`0618041`)

**Case management board**

- Канбан-доска по статусам + переключатель Доска/Таблица
- Карточка дела (drawer): инфо, timeline истории, заметки, задачи с
  дедлайнами и просрочкой, документы (имя файла), история статусов
- Fix: парсинг date-only дат в локальном времени (сдвиг дня в западных TZ)

## v0.1 — 2026-07-09 (`153922e`, tag `v0.1`)

**MVP по исходному ТЗ**

- Таблица клиентов, добавление с валидацией, смена статуса, удаление
- Счётчики по статусам, поиск, фильтр, toast-уведомления
- localStorage-персистентность, seed-данные, адаптивная вёрстка
- React 19 + TypeScript + Vite + Tailwind v4
