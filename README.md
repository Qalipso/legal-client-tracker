# Legal Client Tracker — lightweight legal CRM

Не просто таблица клиентов, а **case management board**: юрист работает не со строками,
а с делами — открывает клиента, видит историю, документы, заметки, текущий статус и
следующий шаг.

Клиент пришёл → дело взяли в работу → запросили документы → ждём клиента → закрыли дело.

## Live Demo

[link — pending deploy]

## Документация

- [docs/architecture.md](docs/architecture.md) — компоненты, data model, потоки, решения (ADR) и trade-offs
- [docs/setup.md](docs/setup.md) — локальный запуск, Supabase с нуля, Telegram-бот, Vercel deploy
- [docs/notifications.md](docs/notifications.md) — контракт edge function, события, журнал доставки
- [CHANGELOG.md](CHANGELOG.md) — история версий v0.1 → v0.4

## Features

**Board / Table**
- Канбан-доска по статусам дел (Новый / В работе / Ожидает клиента / Закрыт)
- **Drag-and-drop**: карточку можно перетащить в другую колонку — статус меняется,
  событие пишется в историю дела; колонка-цель подсвечивается
- Цветовая система статусов: иконки, тонированные колонки, цветной акцент карточек
- Карточка дела: имя, телефон, комментарий, следующее действие с дедлайном
- Подсветка просроченных действий прямо на доске
- Переключатель Доска / Таблица (выбор запоминается)
- Live-счётчики по статусам, поиск по имени/телефону/статусу + фильтр

**Карточка клиента / дела (боковая панель)**
- **Сводка дела** — название, тип дела и стадия из справочников, предмет,
  контрольный срок (с подсветкой просрочки), приоритет
- **Стороны** — доверитель (контакты клиента) и контрагент
- Следующие действия — быстрые задачи (дата, чекбокс, признак «просрочено»)
- **Контрольные сроки** — типизированные юридические дедлайны (процессуальный,
  ответ на претензию, оплата и т.д.), отдельно от быстрых задач
- **Риски / открытые вопросы** — список с отметкой «решено»
- Заметки — сохраняются в историю дела
- Документы — имя файла + **тип и статус документа** из справочников
  (в проде — Supabase Storage / S3 вместо имени)
- История дела — единый timeline всех событий; история статусов — его срез

**Auth и приватность данных (v0.3)**
- Supabase Auth: регистрация, вход, выход; без сессии приложение показывает
  страницу входа
- Все данные принадлежат пользователю: `user_id` на clients / tasks /
  case_history / attachments + RLS-политики «только свои строки»
- При регистрации триггер автоматически создаёт `profiles` и
  `account_settings` с дефолтами
- Новый пользователь видит welcome empty state, а не чужие данные

**Настройки аккаунта (`#/settings`)**
- Профиль: имя, компания, email (readonly), выход
- Уведомления: Telegram вкл/выкл + тумблеры по событиям (новый клиент,
  просроченная задача, смена статуса)
- Получатели: список Telegram chat ID (имя + chat_id + активность),
  добавление/отключение/удаление, «Send test notification»
- История уведомлений: последние попытки с статусами sent / error / skipped

**Telegram-уведомления (per-user routing)**
- События: `client.created`, `task.created`, `status.changed` отправляются
  fire-and-forget из UI; `task.overdue` поддержан схемой/настройками
  (автоотправка по расписанию — next step)
- Edge Function получает JWT пользователя → определяет auth.uid() → читает
  его настройки и активных получателей → шлёт всем → пишет каждую попытку
  в `notification_events` (status, error, payload, sent_at)
- Токен бота только в секретах Supabase (`TG_BOT_TOKEN`); нет получателей
  или токена → `{"skipped": true, "reason": ...}`, UI не ломается
- Настройка: @BotFather → токен в секреты → в `#/settings` добавить свой
  chat ID (узнать: @userinfobot) → «Send test notification»

**Справочники (v0.4)**
- Типы дел, стадии дел, типы документов, статусы документов, типы сроков —
  глобальные таблицы-словари (`matter_types`, `matter_stages`,
  `document_types`, `document_statuses`, `deadline_types`), читаемы всем
  авторизованным пользователям, значения используются в UI как select'ы

**Base**
- Add client with inline validation, toast notifications
- **Редактирование клиента**: имя, телефон, email, telegram, тип дела,
  ответственный юрист, приоритет, комментарий — изменение попадает в историю
- Soft delete с подтверждением (дело можно восстановить, история не теряется)
- Персистентность: Supabase (PostgreSQL) или localStorage fallback с миграциями
- Seed demo data on first visit; responsive layout (mobile → desktop)

## Stack

- React 19 + TypeScript (Vite)
- Tailwind CSS v4
- **Supabase (PostgreSQL)** — основное хранилище; схема в `supabase/migrations/`
- **localStorage fallback** — demo/dev-режим, если Supabase env не задан
- Vercel (deploy)

## Architecture

Подробная версия с ADR и trade-offs: [docs/architecture.md](docs/architecture.md).
Кратко: UI никогда не обращается к хранилищу напрямую — только через repository layer:

```
UI (Board / Table / Drawer / Settings / Auth)
  └── App state  →  DataProvider interface (src/lib/providers/types.ts)
        ├── supabaseProvider     — если заданы VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
        └── localStorageProvider — demo-mode fallback (без авторизации, v1→v4 миграции данных)
```

Каждая мутация провайдера сама пишет своё событие в `case_history` (activity log)
и возвращает свежий снимок данных. Клиенты удаляются мягко (`deleted_at`), история
дела сохраняется. Все пользовательские таблицы защищены RLS
(`user_id = auth.uid()`) — данные разных юристов изолированы на уровне БД, не
на уровне кода. Уведомления идут через Edge Function, которая резолвит
`auth.uid()` из JWT пользователя (подробности — [docs/notifications.md](docs/notifications.md)).

Настройка Supabase: создать проект → по порядку выполнить
`supabase/migrations/001…004*.sql` → `supabase/seed.sql` (опционально) →
заполнить `.env` по образцу `.env.example`. Подробный гайд:
[docs/setup.md](docs/setup.md).

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build → dist/
```

## Project structure

```
src/
  components/
    AuthPage.tsx      # login / signup
    BoardView.tsx     # kanban columns + case cards, drag-and-drop
    ClientDetails.tsx # drawer: info, edit, timeline, notes, tasks, files
    ClientForm.tsx    # add-client form with validation
    ClientTable.tsx   # table view
    SettingsPage.tsx  # profile, notification toggles, recipients, history
    StatusCards.tsx   # counters per status
    Filters.tsx       # search + status filter
    Toast.tsx
  lib/
    supabaseClient.ts # singleton Supabase client (null → demo-mode)
    providers/        # DataProvider interface + supabase / localStorage impls
    notify.ts         # fire-and-forget event notifications (user JWT)
    clients.ts        # date/overdue/next-task helpers
    statuses.ts       # status labels, order, visual identity
  types/client.ts     # domain types
  App.tsx             # AuthGate + hash routing + state owner
supabase/
  migrations/         # 001 schema · 002 settings (superseded by 003) ·
                      # 003 auth + RLS + profiles/account_settings ·
                      # 004 matter model + reference dictionaries
  functions/notify-telegram/  # per-user Telegram routing + events log
  seed.sql
docs/                 # architecture · setup · notifications
```

## Data model

Полная схема с типами колонок и RLS — в `supabase/migrations/`. Сокращённая
доменная модель (TypeScript, `src/types/client.ts`):

```ts
Client          { id, name, phone, email?, telegram?, status, note?, priority?,
                   responsibleLawyer?, matterTitle?, matterType?, matterSubject?,
                   stage?, counterparty?, keyDeadline?, createdAt, updatedAt, deletedAt? }
CaseHistoryItem { id, clientId, type: client_created|client_updated|note_added|
                   status_changed|task_created|task_completed|attachment_added,
                   text, metadata?, createdAt }
Task            { id, clientId, title, dueDate?, completed, completedAt?, createdAt }
MatterDeadline  { id, clientId, deadlineType?, title, dueDate, completed, note?, createdAt }
MatterRisk      { id, clientId, text, isResolved, createdAt, resolvedAt? }
Attachment      { id, clientId, fileName, documentType?, documentStatus?, uploadedAt }
ReferenceItem   { code, label }  // matter types/stages, document types/statuses, deadline types
Profile, AccountSettings, NotificationRecipient, NotificationEvent  // account & notifications
```

Все события дела пишутся в единый timeline (`CaseHistoryItem`), история статусов —
это его срез по `type === "status_changed"`. `Task` (быстрые действия) и
`MatterDeadline` (типизированные юридические сроки) — сознательно разные
сущности: первые — ad-hoc «позвонить/проверить», вторые — формальные сроки
с типом из справочника.

## Key decisions & trade-offs

- **Supabase как основное хранилище, localStorage — только demo-режим** —
  начинали с localStorage-first MVP (v0.1), в v0.2 перешли на Supabase через
  repository layer без переписывания UI; localStorage остался fallback'ом,
  когда `VITE_SUPABASE_*` не заданы (без авторизации).
- **RLS вместо фильтрации в коде** — `user_id = auth.uid()` на каждой
  пользовательской таблице; владение данными гарантирует БД, а не дисциплина
  разработчика. Изоляция проверена симуляцией ролей (см. docs/architecture.md).
- **Inline form (not modal)** — fewer moving parts, better on mobile, same UX value.
- **`window.confirm` for delete** — native, accessible, zero code; a styled dialog is polish
  the MVP doesn't need.
- **Search matches status labels too** — "в работе" in the search box works as users expect.
- **Matter model расширяет `clients`, а не заводит отдельную таблицу** —
  меньше миграций и join'ов; `tasks`/`case_history`/`attachments` не
  потребовали изменений при переходе на модель дела (v0.4).

## Next steps

- **Import / export данных** — экспорт клиентов/дел в CSV, импорт из CSV
- **Header**: имя и роль пользователя, загрузка фото профиля
- **Вкладка «История и аналитика»** — пока заглушка, далее: отчёты по делам,
  нагрузке, срокам
- **Роли** (admin / lawyer / assistant) поверх текущего RLS — сейчас
  изоляция «пользователь видит только своё», ролевой модели доступа нет
- **Email reminders** — письма по просроченным задачам и дедлайнам
  (Supabase cron + Resend/Postmark)
- **Google Calendar integration** — синхронизация контрольных сроков и задач
- **Real file upload** — Supabase Storage вместо name-only заглушки:
  загрузка содержимого, `storage_path`, ссылка на скачивание
- **task.overdue уведомления** — схема и тумблер уже готовы (v0.3), не
  хватает планировщика (pg_cron + вызов функции)
- Automated tests (unit для repositories, E2E для доски)

## Feedback от реального юриста

_[Заполняется после короткого теста с реальным пользователем: что понятно
сразу, что мешает, чего не хватает для ежедневной работы.]_

## Deferred on purpose (out of scope so far)

- Хранение содержимого файлов (только имена; в проде — Supabase Storage / S3)
- Import/export, header с фото, вкладка аналитики, ролевая модель — см. Next steps
- Automated tests — every increment (v0.1 → v0.4) was verified manually
  end-to-end in a real browser and, for Supabase-backed changes, cross-checked
  against PostgreSQL directly (RLS isolation via role simulation, row counts,
  round-trips). Coverage per release is in [CHANGELOG.md](CHANGELOG.md);
  nothing here is claimed "tested" without that verification having run.

## AI Usage

I used AI (Claude Code) for:
- generating the initial component structure;
- speeding up Tailwind layout work;
- checking edge cases (empty states, storage failures, validation);
- writing the README draft.

I did myself:
- product decisions and scope definition;
- final code review;
- testing and deployment.

## Time Log

Start: 2026-07-09. Grew across several iterations the same day (base MVP →
case board → Supabase backend → auth/RLS/settings → matter model);
`git log` / [CHANGELOG.md](CHANGELOG.md) has the accurate breakdown.
Total: [заполнить перед отправкой — сумма реального времени, не оценка]

## Notes

The MVP is intentionally simple. It focuses on the core workflow: add client, update case
status, and see the status distribution at a glance.
