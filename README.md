# Legal Client Tracker — lightweight legal CRM

Не просто таблица клиентов, а **case management board**: юрист работает не со строками,
а с делами — открывает клиента, видит историю, документы, заметки, текущий статус и
следующий шаг.

Клиент пришёл → дело взяли в работу → запросили документы → ждём клиента → закрыли дело.

## Live Demo

**https://legal-client-tracker.vercel.app**

Тестовый доступ: `test@qalipso.legal` / `testtest` (создан через Supabase
Dashboard → Authentication → Add user, автоподтверждён).

> **This MVP uses only fake/demo client data — no real personal or legal
> data is stored.** For real legal data, the production version should use
> authenticated database storage with access control (уже есть: Supabase
> Auth + RLS), audit logging (уже есть: `case_history`/`notification_events`)
> and encrypted secrets (уже есть: server-side Edge Function secrets) —
> подробности: [docs/security.md](docs/security.md).

## Документация

- [docs/architecture.md](docs/architecture.md) — компоненты, data model, потоки, решения (ADR) и trade-offs
- [docs/security.md](docs/security.md) — data classification, access control, RLS, audit log, AI usage policy, security checklist
- [docs/features.md](docs/features.md) — полный перечень фич проекта с версией и местом в коде
- [docs/setup.md](docs/setup.md) — локальный запуск, Supabase с нуля, Telegram-бот, Vercel deploy
- [docs/notifications.md](docs/notifications.md) — контракт edge function, события, журнал доставки
- [docs/qa/ui-test-plan.md](docs/qa/ui-test-plan.md) — план UI-тестирования (desktop/mobile), найденные и исправленные баги
- [CHANGELOG.md](CHANGELOG.md) — история версий v0.1 → v0.5.4

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
  добавление/отключение/удаление, «Отправить тест»
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
- **Бот отвечает на `/start`** (`telegram-webhook`, v0.5.1): пишешь боту —
  он присылает в ответ твой chat ID, готовый для вставки в настройки; больше
  не нужен сторонний @userinfobot
- Настройка: @BotFather → токен в секреты → задеплоить обе функции →
  зарегистрировать webhook → написать боту `/start` → скопировать chat ID →
  в `#/settings` добавить получателя → «Отправить тест»

**Справочники (v0.4)**
- Типы дел, стадии дел, типы документов, статусы документов, типы сроков —
  глобальные таблицы-словари (`matter_types`, `matter_stages`,
  `document_types`, `document_statuses`, `deadline_types`), читаемы всем
  авторизованным пользователям, значения используются в UI как select'ы

**Header, роли, импорт/экспорт, аналитика (v0.5)**
- **Header**: аватар (или инициалы) + имя + бейдж роли в шапке, клик ведёт в
  настройки; фото профиля грузится в Supabase Storage (bucket `avatars`,
  публичный, свой каталог на пользователя) — не заглушка, реальная загрузка
- **Роли** `admin` / `lawyer` / `assistant` — `profiles.role`, по умолчанию
  `lawyer`. Не редактируется из UI (иначе пользователь мог бы сам себе
  выдать admin) — назначается напрямую в БД, пока нет команд/workspace.
  Реальное ограничение прав на уровне БД, а не только скрытие кнопок:
  - триггер `forbid_assistant_delete` блокирует soft-delete клиента ассистентом
    (проверено симуляцией роли — прямой SQL `update...deleted_at` кидает
    `insufficient_privilege`, не только UI-кнопка спрятана)
  - RLS-политики `notification_recipients`/`account_settings` запрещают
    ассистенту создавать/менять получателей и настройки уведомлений
- **Импорт / экспорт CSV** (Настройки → Данные): экспорт текущих клиентов
  со всеми matter-полями; импорт валидирует обязательные поля (имя, телефон)
  и создаёт клиентов через тот же `createClient`, что и обычная форма —
  импортированные данные проходят ту же историю событий
- **Вкладка «История и аналитика»** (`#/analytics`) — честная заглушка:
  без выдуманных графиков и цифр, отчёты — в Next steps

**Base**
- Add client with inline validation, toast notifications
- **Редактирование клиента**: имя, телефон, email, telegram, тип дела,
  ответственный юрист, приоритет, комментарий — изменение попадает в историю
- Soft delete с подтверждением (дело можно восстановить, история не теряется)
- Персистентность: Supabase (PostgreSQL) или localStorage fallback с миграциями
- Seed demo data on first visit; responsive layout (mobile → desktop)

## Stack

- React 19 + TypeScript (Vite)
- Tailwind CSS v4 — светлая/тёмная тема (`.dark` класс, localStorage +
  system-preference по умолчанию), переключатель в шапке
- **Supabase (PostgreSQL)** — основное хранилище; схема в `supabase/migrations/`
- **localStorage fallback** — demo/dev-режим, если Supabase env не задан
- **Vercel** — прод задеплоен: https://legal-client-tracker.vercel.app

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
`supabase/migrations/001…005*.sql` → `supabase/seed.sql` (опционально) →
заполнить `.env` по образцу `.env.example`. Подробный гайд:
[docs/setup.md](docs/setup.md).

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc + production build → dist/
npm test         # vitest — providers, csv, date/overdue helpers, ics
npm run test:e2e # playwright — board UI, against localStorage demo-mode
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
    SettingsPage.tsx  # profile+avatar+role, notifications, recipients,
                      # import/export CSV, history
    AnalyticsPage.tsx # "История и аналитика" — honest placeholder
    UserChip.tsx      # header avatar + name + role badge
    StatusCards.tsx   # counters per status
    Filters.tsx       # search + status filter
    Toast.tsx
    ThemeToggle.tsx   # light/dark switch (localStorage + system default)
  lib/
    supabaseClient.ts # singleton Supabase client (null → demo-mode)
    providers/        # DataProvider interface + supabase / localStorage impls
    notify.ts         # fire-and-forget event notifications (user JWT)
    clients.ts        # date/overdue/next-task helpers
    csv.ts            # minimal CSV parse/serialize (no dependency)
    matterReference.ts # static reference dictionaries for demo-mode
    statuses.ts       # status labels, order, visual identity (incl. dark variants)
    theme.ts          # light/dark theme store
  types/client.ts     # domain types
  App.tsx             # AuthGate + hash routing + state owner
supabase/
  migrations/         # 001 schema · 002 settings (superseded by 003) ·
                      # 003 auth + RLS + profiles/account_settings ·
                      # 004 matter model + reference dictionaries ·
                      # 005 roles (admin/lawyer/assistant) + avatars storage ·
                      # 006 case-documents storage · 007 pg_cron overdue
                      # scheduler · 008 email channel
  functions/
    notify-telegram/  # per-user + cron Telegram/email routing + events log
    telegram-webhook/  # bot inbound webhook — replies to /start with chat_id
  seed.sql
docs/                 # architecture · security · features · setup ·
                      # notifications · qa/ui-test-plan · onboarding-email-draft ·
                      # brand/ (Elly bot character card + avatar prompts)
e2e/                  # Playwright — board.spec.ts + fixtures.ts (localStorage
                      # demo-mode, no live Supabase session needed)
playwright.config.ts
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

Сделано в v0.6 (детали и evidence — в CHANGELOG):

- **Real file upload для документов дела** — вложения (`attachments`)
  теперь грузятся в приватный Storage-бакет `case-documents`, как аватар;
  скачивание через 60-секундные signed URL
- **Google Calendar integration** — не полноценный OAuth-sync, а
  односторонний `.ics`-экспорт открытых задач и контрольных сроков
  (Настройки → Данные); осознанный компромисс без нового внешнего интегратора
- **task.overdue уведомления** — pg_cron дергает `notify-telegram` раз в
  день (08:00 UTC); проверено сквозным тестом на проде (см. CHANGELOG)
- **Email-канал уведомлений** — переключатель + получатели + `notify-telegram`
  отправка через Resend с верифицированного домена (`shatalov.dev`).
  Проверено сквозным тестом на проде: `notification_events` показал
  `status: sent, error: null` для канала email в том же батче, что и
  Telegram (см. CHANGELOG)
- **E2E-тесты доски** (Playwright) — `npm run test:e2e`, 4 сценария
  (добавление клиента, смена статуса, поиск/фильтр, карточка дела) против
  localStorage demo-режима (без live Supabase-сессии)

Ещё не сделано:

- **Реальные отчёты в «Истории и аналитике»** — сейчас честная заглушка;
  дальше: сколько дел в работе/просрочено, нагрузка по типам дел, скорость
  закрытия
- **Team workspace + назначение ролей из UI** — сейчас `admin`/`lawyer`/
  `assistant` есть и реально работают (RLS + триггер), но назначаются только
  напрямую в БД, и все пользователи всё ещё видят только свои данные —
  ассистент не может увидеть дела «своего» юриста, потому что нет понятия
  команды/workspace. Это следующий архитектурный шаг, не текущий

## Feedback от реального юриста

_[Заполняется после короткого теста с реальным пользователем: что понятно
сразу, что мешает, чего не хватает для ежедневной работы.]_

## Deferred on purpose (out of scope so far)

- Team workspace / назначение ролей из UI — см. Next steps
- Automated tests — unit-тесты (vitest, 26 тестов: providers, CSV,
  date/overdue helpers, ics) и E2E-тесты доски (Playwright, `npm run
  test:e2e`, 4 сценария) реально проходят. Каждый инкремент вдобавок
  проверялся вручную в браузере и, для Supabase-изменений, напрямую в
  PostgreSQL (RLS-изоляция через симуляцию ролей, round-trip записи/чтения).
  Что именно проверено — в [CHANGELOG.md](CHANGELOG.md); ничего не
  помечено «протестировано» без реального запуска проверки.

## Security & Data Protection

Проект работает с персональными данными (ФИО, телефон, статус дела,
комментарии), поэтому security выделен в отдельный, полноценный этап —
не только «не закоммитить .env», а data classification, access control,
audit trail и security checklist. Полный разбор: **[docs/security.md](docs/security.md)**.

Кратко:
- **MVP использует только fake/demo-данные** — в базе нет ни одного
  реального клиента; тестовый аккаунт для проверки создан без персональных
  данных внутри.
- **Секреты не попадают на frontend**: `TG_BOT_TOKEN` и `SUPABASE_SERVICE_ROLE_KEY`
  живут только в серверных Edge Function secrets; `.env*` в `.gitignore`
  (кроме `.env.example`); перед каждым коммитом — grep-скан бандла и
  исходников на паттерны токенов/ключей.
- **RLS на каждой пользовательской таблице** (`user_id = auth.uid()`) —
  юрист видит и меняет только свои записи; изоляция проверена симуляцией
  ролей через прямой SQL, не только чтением кода.
- **Роли `admin`/`lawyer`/`assistant`** с реальным ограничением на уровне
  БД (триггер блокирует удаление ассистентом, RLS блокирует смену
  настроек уведомлений) — не только скрытые кнопки в UI.
- **Audit trail**: каждое действие над делом пишется в `case_history`
  с `user_id` (кто), `type` (что), `created_at` (когда); попытки отправки
  уведомлений — в `notification_events` (sent/error/skipped).
- **Уведомления идут только через backend** (Edge Function) с минимальным
  набором данных (имя, телефон, статус) — без комментариев, документов,
  финансовых деталей.

## AI Usage

AI tools were used for scaffolding, UI suggestions, code review and README
drafting. No real client data was used or shared with AI tools — every
client name, phone number and case detail used during development and
testing is fictional (see [docs/security.md](docs/security.md) §4).

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
