# Changelog

Формат дат: YYYY-MM-DD. Версии соответствуют этапам ТЗ, не npm-релизам.

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
