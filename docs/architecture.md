# Architecture & Technical Decisions — Legal Client Tracker

> Отражает состояние кода на v0.7. Каждый пункт помечен `[Implemented]`
> (есть в коде, путь указан) или `[Planned]` (намерение, ещё не сделано).
> Стек и высокоуровневые фичи — в [README.md](../README.md); здесь —
> компоненты, схема данных, ADR и trade-offs, для кого интересны детали.

## 1. System Context

```
┌──────────────┐   HTTPS (anon key + user JWT)   ┌─────────────────────────┐
│   Browser    │────────────────────────────────▶│  Supabase               │
│  React SPA   │                                 │  ├─ Auth (GoTrue)       │
│  (Vercel)    │──── POST /functions/v1/ ───────▶│  ├─ PostgreSQL + RLS    │
└──────────────┘     notify-telegram             │  ├─ Storage (avatars,   │
       │                                         │  │  case-documents)     │
       │ demo-mode fallback                      │  ├─ pg_cron (task.overdue)│
       ▼                                         │  └─ Edge Functions      │
  localStorage                                   └───────┬─────────┬───────┘
                                                          │         │
                                                    Bot API    Resend API
                                                          │         │
                                                          ▼         ▼
                                                     Telegram    Email
```

Актор — юрист (`admin`/`lawyer`/`assistant`, без team workspace — см. §7).
Внешние системы: Supabase (auth + данные + функции + cron + storage),
Telegram Bot API, Resend (email). Граница доверия: браузер владеет только
anon key + JWT пользователя; `TG_BOT_TOKEN`, `RESEND_API_KEY` и
`service_role` живут исключительно в Edge Function secrets.

## 2. Stack

- React 19 + TypeScript (Vite), Tailwind CSS v4
- Светлая/тёмная тема — class-based dark mode (`@custom-variant dark`),
  `src/lib/theme.ts` (localStorage + system-preference), flash-free via
  инлайн-скрипт в `index.html`
- **Supabase (PostgreSQL)** — основное хранилище; схема в `supabase/migrations/`
- **localStorage fallback** — demo/dev-режим, если `VITE_SUPABASE_*` не задан
- **Vercel** — прод: https://legal-client-tracker.vercel.app
- Vitest (unit) + Playwright (E2E, против localStorage demo-режима)

## 3. Components

| Компонент | Путь | Ответственность | Статус |
|---|---|---|---|
| Root / AuthGate | `src/App.tsx` | сессия Supabase Auth; без сессии → AuthPage; demo-mode без env — без auth | `[Implemented]` |
| MainApp | `src/App.tsx` | владелец состояния: AppData, hash-роутинг, поиск/фильтры, все мутации через провайдер | `[Implemented]` |
| AuthPage | `src/components/AuthPage.tsx` | login / signup / ошибки / подтверждение email | `[Implemented]` |
| BoardView | `src/components/BoardView.tsx` | канбан по статусам, drag-and-drop, подсветка просрочки | `[Implemented]` |
| ClientTable | `src/components/ClientTable.tsx` | табличный вид, клик по имени открывает drawer | `[Implemented]` |
| ClientDetails | `src/components/ClientDetails.tsx` | drawer дела: сводка, стороны, задачи, сроки, риски, заметки, документы, история — каждая секция своя карточка | `[Implemented]` |
| SettingsPage | `src/components/SettingsPage.tsx` | профиль+аватар+роль, уведомления (Telegram+email), получатели, импорт/экспорт CSV, `.ics`-экспорт, история | `[Implemented]` |
| AnalyticsPage | `src/components/AnalyticsPage.tsx` | «История и аналитика» — честная заглушка | `[Implemented]` |
| ThemeToggle | `src/components/ThemeToggle.tsx` | переключатель светлой/тёмной темы | `[Implemented]` |
| Data layer | `src/lib/providers/types.ts` | интерфейс `DataProvider` — UI не знает источник данных | `[Implemented]` |
| Supabase provider | `src/lib/providers/supabaseProvider.ts` | PostgREST-доступ; каждая мутация пишет событие в `case_history` | `[Implemented]` |
| localStorage provider | `src/lib/providers/localStorageProvider.ts` | demo-mode; миграции формата v1→v4; seed-данные | `[Implemented]` |
| Supabase client | `src/lib/supabaseClient.ts` | модульный синглтон (один GoTrueClient на страницу) | `[Implemented]` |
| Notify | `src/lib/notify.ts` | fire-and-forget вызов функции с JWT пользователя | `[Implemented]` |
| notify-telegram | `supabase/functions/notify-telegram/index.ts` | маршрутизация Telegram+email по каналу получателя; auth через JWT или internal_secret (для cron); email по умолчанию шлётся на профильный адрес, если явный получатель не задан | `[Implemented]` |
| telegram-webhook | `supabase/functions/telegram-webhook/index.ts` | `/start connect_<token>` — хеширует токен, резолвит по hash, upsert получателя (v0.8→v0.8.2); plain `/start` — fallback, присылает chat_id для ручного ввода | `[Implemented]` |
| create_telegram_connect_token | migration 010, Postgres function | генерирует токен, хеширует, персистит только hash; plaintext — только в RETURNING | `[Implemented]` |
| pg_cron scheduler | migration 007, `notify_overdue_items()` | ежедневно (08:00 UTC) находит просроченные task/deadline и шлёт уведомление | `[Implemented]` |
| Schema | `supabase/migrations/001…011*.sql` | таблицы, RLS, триггеры, storage buckets, cron | `[Implemented]` |

## 4. Data model

Основные таблицы:

- `clients` — карточка дела + matter-поля (`matter_title/type/subject/stage/
  counterparty/key_deadline`); `status` check; soft delete через `deleted_at`;
  `user_id default auth.uid()`.
- `case_history` — единый timeline: `client_created, client_updated,
  note_added, status_changed (metadata {from,to}), task_created,
  task_completed, attachment_added`. История статусов — его срез по
  `type='status_changed'`.
- `tasks` — ad-hoc следующие действия (позвонить/проверить); `due_date` +
  `completed/completed_at`; просрочка — на клиенте (`src/lib/clients.ts:
  isOverdue`).
- `matter_deadlines` — типизированные юридические сроки (процессуальный,
  ответ на претензию и т.д.) — сознательно отдельная сущность от `tasks`.
- `matter_risks` — риски/открытые вопросы с отметкой «решено».
- `attachments` — реальная загрузка в приватный Storage-бакет
  `case-documents` (не только имя файла); скачивание через 60-секундные
  signed URL.
- `matter_types`, `matter_stages`, `document_types`, `document_statuses`,
  `deadline_types` — глобальные справочники, read-only для всех
  авторизованных.
- `profiles`, `account_settings` — создаются триггером при регистрации;
  `profiles.role` (`admin`/`lawyer`/`assistant`).
- `notification_recipients` — получатели, `channel` in (`telegram`,
  `email`); `unique (user_id, channel, destination)` (v0.8.2) — reconnect
  апсертит существующую запись вместо дублирования (найдено реальным
  end-to-end тестом: без constraint один и тот же chat_id получал
  уведомление дважды).
- `notification_events` — журнал попыток: `status sent|error|skipped`,
  `error`, `payload jsonb`, `sent_at`.
- `internal_secrets` — service_role-only, shared secret для cron→function
  auth (не читается ни anon, ни authenticated ролью).
- `telegram_connect_tokens` — короткоживущий (10 мин), одноразовый токен
  для подключения Telegram без ручного ввода chat_id (v0.8). Хранится
  только `token_hash` (SHA-256, v0.8.1) — plaintext существует лишь
  внутри `create_telegram_connect_token()` и её единственного возврата,
  никогда не персистится. `user_id` читает только свои токены (RLS);
  создание — через `create_telegram_connect_token()` (SECURITY INVOKER,
  auth.uid() резолвится как у вызывающего пользователя); резолвинг и
  пометка использованным — через service-role в `telegram-webhook`.

Сокращённая доменная модель (TypeScript, `src/types/client.ts`):

```ts
Client          { id, name, phone, email?, telegram?, status, note?, priority?,
                   responsibleLawyer?, matterTitle?, matterType?, matterSubject?,
                   stage?, counterparty?, keyDeadline?, createdAt, updatedAt, deletedAt? }
CaseHistoryItem { id, clientId, type, text, metadata?, createdAt }
Task            { id, clientId, title, dueDate?, completed, completedAt?, createdAt }
MatterDeadline  { id, clientId, deadlineType?, title, dueDate, completed, note?, createdAt }
MatterRisk      { id, clientId, text, isResolved, createdAt, resolvedAt? }
Attachment      { id, clientId, fileName, documentType?, documentStatus?, uploadedAt }
ReferenceItem   { code, label }
Profile, AccountSettings, NotificationRecipient, NotificationEvent
```

RLS: `using (user_id = auth.uid())` на всех пользовательских таблицах;
`notification_events`/`overdue_notifications_sent`/`internal_secrets` —
service_role-only для запись/чтение служебных данных.

## 5. Data & Control Flow

**Мутация данных** (например, смена статуса): UI → `provider.updateClientStatus()`
→ update `clients` + insert `case_history` → провайдер возвращает свежий
`AppData` → перерисовка. При ошибке UI сохраняет прежнее состояние + toast.

**Уведомление (UI-триггер):**

```
UI action ──▶ notifyEvent(type, payload)          (fire-and-forget, user JWT)
                 ▼
notify-telegram:
  JWT ─▶ auth.uid() ─▶ account_settings (toggles) ─▶ notification_recipients
  email без явного получателя ─▶ fallback на profiles.email
  для каждого получателя ─▶ Bot API / Resend API
  каждая попытка ─▶ insert notification_events
```

**Уведомление (cron-триггер, task.overdue):** pg_cron → `notify_overdue_items()`
→ находит просроченные `tasks`/`matter_deadlines` без сегодняшней записи в
`overdue_notifications_sent` → `net.http_post` в `notify-telegram` с
`internal_secret`+`user_id` (нет пользовательской сессии) → та же логика
диспатча по каналам, что и у UI-триггера.

## 6. Decisions (ADR, кратко)

1. **Repository/provider layer** — UI зависит только от `DataProvider`.
   *Следствие:* backend заменяем без правок компонентов; demo-mode бесплатен.
2. **`user_id default auth.uid()` + RLS вместо фильтров в коде** — владение
   данными обеспечивает БД. Изоляция проверена SQL-симуляцией ролей.
3. **Activity log как единый timeline** (`case_history`) — аудит и отчёты
   без дополнительных таблиц; metadata jsonb для деталей.
4. **Секреты только server-side** — токен бота/Resend недоступны фронтенду;
   фронт шлёт JWT, функция резолвит получателей сама.
5. **Hash-роутинг вместо react-router** — одна зависимость меньше для
   нескольких экранов.
6. **Soft delete** (`deleted_at`) — дело можно восстановить, история не теряется.
7. **Matter model расширяет `clients`, а не заводит отдельную таблицу** —
   меньше миграций и join'ов; `tasks`/`case_history`/`attachments` не
   потребовали изменений при переходе на модель дела.
8. **`.ics`-экспорт вместо Google Calendar OAuth** — односторонний экспорт
   без регистрации внешнего OAuth-приложения; полноценный two-way sync
   явно вынесен в Planned, а не изображён готовым.
9. **pg_cron auth через DB-таблицу секрета, а не Supabase CLI secret** — у
   агентской тулинг-цепочки нет доступа к `supabase secrets set`; секрет в
   `internal_secrets` (service_role-only RLS) читается по обе стороны
   (SQL-функцией и Edge Function через service-role REST).
10. **Email fallback на `profiles.email`** — тумблер «Email-уведомления
    включены» без явного получателя интуитивно должен слать на аккаунт
    владельца, а не молча ничего не делать.
11. **Inline form (not modal)** — меньше движущихся частей, лучше на mobile.
12. **`window.confirm` for delete** — нативный, доступный, без кода; кастомный
    диалог — полировка, которая MVP не нужна.
13. **Search matches status labels too** — «в работе» в поиске работает,
    как ожидает пользователь.
14. **Token-based Telegram connect вместо ручного копирования chat_id** (v0.8) —
    пользователь не должен знать, что такое chat_id, и не должен по нему
    копипастить между Telegram и приложением. Токен: `gen_random_bytes`
    (не угадываемый), single-use (`used_at`, PostgREST-условие делает
    атомарный claim — гонка/replay не проходит), TTL 10 минут. Старый путь
    (`/start` → голый chat_id в ответ) оставлен как fallback, а не удалён —
    ничего не сломано для тех, кто уже так подключился.
15. **Токен хешируется, а не хранится в открытом виде** (v0.8.1) — если
    строка когда-нибудь утечёт (бэкап, неверный доступ, компрометация
    service-role ключа), голый токен сразу пригоден для использования в
    10-минутное окно; hash — нет. Сделано через Postgres-функцию
    (SECURITY INVOKER), а не отдельную Edge Function — тот же эффект, RLS
    уже даёт нужную проверку авторизации бесплатно при вызове от имени
    пользователя.
16. **Upsert получателя вместо insert** (v0.8.2) — реальный, а не
    гипотетический баг, найденный сквозным тестированием: reconnect уже
    подключённого чата плодил вторую запись, тот же чат получал бы
    уведомления дважды. `unique (user_id, channel, destination)` +
    `Prefer: resolution=merge-duplicates`.
17. **Retry через `recipient_id`, не через повторный полный dispatch** (v1.0) —
    повторная отправка всем активным получателям при retry одного
    провалившегося события переуведомила бы тех, кто уже получил его
    успешно. `recipient_id` в теле запроса сужает `notify-telegram` до
    ровно одного адресата, с явной проверкой владения (`user_id=eq.` в том
    же запросе, что и `id=eq.`) — иначе можно было бы повторить чужую
    отправку, подобрав `recipient_id`.
18. **Чеклист онбординга выводится из реальных данных, а не из отдельного
    флага** (v1.0) — «клиент есть» / «Telegram подключён» / «уведомление
    отправлено» / «срок есть» вычисляются на лету из уже загруженных
    данных плюс двух дешёвых запросов (получатели, последние события).
    Нет риска рассинхронизации между «флагом онбординга» и фактическим
    состоянием аккаунта. Дизмисс — простой флаг в localStorage.

## 7. Trade-offs

- **Refetch-all после мутации** (простота > трафик): при каждой записи
  провайдер перечитывает данные заново. На объёмах юриста (сотни записей)
  это дешевле, чем кэш-инварианты; при росте — точечные обновления/realtime
  `[Planned]`.
- **Permissive email-confirm flow**: Supabase по умолчанию требует
  подтверждение email; UI honest-сообщает об этом.
- **Роли без team workspace**: `admin`/`lawyer`/`assistant` реально
  работают на уровне БД (RLS + триггер), но назначаются только напрямую в
  БД, и ассистент не видит дела «своего» юриста — нет понятия команды.
  Следующий архитектурный шаг, не текущий.
- **`verify_jwt: false` на gateway у `notify-telegram`**: необходимо, т.к.
  `pg_cron`'s `net.http_post` не может слать Authorization header; функция
  компенсирует собственной проверкой (user JWT ИЛИ internal_secret) — риск
  осознан и задокументирован в коде функции.

## 8. Codebase map

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
    OnboardingChecklist.tsx # first-run quick-start card (v1.0)
  lib/
    supabaseClient.ts # singleton Supabase client (null → demo-mode)
    providers/        # DataProvider interface + supabase / localStorage impls
    notify.ts         # fire-and-forget event notifications (user JWT)
    clients.ts        # date/overdue/next-task helpers
    csv.ts            # minimal CSV parse/serialize (no dependency)
    ics.ts             # RFC 5545 calendar export (no dependency)
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
                      # scheduler · 008 email channel · 009 telegram connect
                      # tokens · 010 hash tokens at rest · 011 recipient dedup
                      # · 012 telegram_username/telegram_locale metadata
  functions/
    notify-telegram/  # per-user + cron Telegram/email routing + events log
    telegram-webhook/  # bot inbound webhook — /start connect_<token> flow +
                      # plain /start chat_id fallback
  seed.sql
docs/                 # this file · security · features · setup ·
                      # notifications · qa/ui-test-plan ·
                      # brand/ (Elly bot character card + avatar prompts) ·
                      # screenshots/ (README images)
e2e/                  # Playwright — board.spec.ts + fixtures.ts (localStorage
                      # demo-mode, no live Supabase session needed)
scripts/
  capture-screenshots.mjs # one-off Playwright script for README screenshots
playwright.config.ts
```

## 9. Open Questions / Planned

- Реальные отчёты в «Истории и аналитике» (нагрузка, просрочки, скорость
  закрытия) — сейчас честная заглушка.
- Team workspace + назначение ролей из UI.
- Полноценный Google Calendar OAuth two-way sync (сейчас — `.ics`-экспорт).
- Реальная доставка email — работает и live-verified (см. CHANGELOG v0.6.1),
  но зависит от конкретного Resend-аккаунта/домена конечного деплоя.
- Realtime-обновления, пагинация.
