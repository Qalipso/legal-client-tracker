# Legal Client Tracker — lightweight legal CRM

Не просто таблица клиентов, а **case management board**: юрист работает не со строками,
а с делами — открывает клиента, видит историю, документы, заметки, текущий статус и
следующий шаг.

Клиент пришёл → дело взяли в работу → запросили документы → ждём клиента → закрыли дело.

## Live Demo

[link — pending deploy]

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

**Карточка клиента (боковая панель)**
- Основная информация + смена статуса
- История дела — timeline всех событий (добавление, заметки, статусы, задачи, документы)
- Заметки — сохраняются в историю
- Следующие действия — задачи с датой, чекбоксом выполнения и признаком «просрочено»
- Документы — прототип: сохраняется имя файла (в проде — Supabase Storage / S3)
- История изменения статусов — видно, где дело зависло

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

UI никогда не обращается к хранилищу напрямую — только через repository layer:

```
UI (Board / Table / Drawer / Forms)
  └── App state  →  DataProvider interface (src/lib/providers/types.ts)
        ├── supabaseProvider     — если заданы VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
        └── localStorageProvider — demo-mode fallback (+ v1→v2→v3 миграции данных)
```

Каждая мутация провайдера сама пишет своё событие в `case_history` (activity log)
и возвращает свежий снимок данных. Клиенты удаляются мягко (`deleted_at`), история
дела сохраняется. Благодаря интерфейсу провайдера Supabase можно заменить на
Express/FastAPI без переписывания UI.

Настройка Supabase: создать проект → выполнить `supabase/migrations/001_init.sql`
и `supabase/seed.sql` → заполнить `.env` по образцу `.env.example`.

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
    BoardView.tsx     # kanban columns + case cards (next action, overdue)
    ClientDetails.tsx # side panel: info, timeline, notes, tasks, files, status history
    ClientForm.tsx    # add-client form with validation
    ClientTable.tsx   # table view + status select + delete
    StatusCards.tsx   # counters per status
    Filters.tsx       # search + status filter
    Toast.tsx         # notifications
  lib/
    clients.ts        # storage layer: AppData load/save, migration, seed, helpers
    statuses.ts       # status labels, order, badge styles
  types/
    client.ts         # Client / CaseHistoryItem / Task / Attachment / AppData
  App.tsx             # state owner: data, view mode, selection, all mutations
```

## Data model

```ts
Client          { id, name, phone, status, note?, createdAt, updatedAt }
CaseHistoryItem { id, clientId, type: created|note|status_change|attachment|task, text, createdAt }
Task            { id, clientId, title, dueDate?, completed, createdAt }
Attachment      { id, clientId, fileName, uploadedAt }
```

Все события пишутся в единый timeline (`CaseHistoryItem`), история статусов — это
его срез по `type === "status_change"`.

## Key decisions & trade-offs

- **localStorage over Supabase** — fits the time box; documented limitation: no cross-device
  sync, no auth. The storage module is the single seam for upgrading.
- **Inline form (not modal)** — fewer moving parts, better on mobile, same UX value.
- **`window.confirm` for delete** — native, accessible, zero code; a styled dialog is polish
  the MVP doesn't need.
- **Search matches status labels too** — "в работе" in the search box works as users expect.

## Next steps

- **Email reminders** — письма по просроченным задачам и дедлайнам
  (Supabase cron + Resend/Postmark)
- **Google Calendar integration** — задачи с датой синхронизируются
  в календарь юриста
- **Real file upload** — Supabase Storage вместо name-only заглушки:
  загрузка содержимого, `storage_path`, ссылка на скачивание
- Auth + RLS per-user, роли (admin / lawyer / assistant)
- Automated tests (unit для repositories, E2E для доски)

## Feedback от реального юриста

_[Заполняется после короткого теста с реальным пользователем: что понятно
сразу, что мешает, чего не хватает для ежедневной работы.]_

## Deferred on purpose (out of scope for the time box)

- Хранение содержимого файлов (только имена; в проде — Supabase Storage / S3)
- Automated tests — the app was verified manually end-to-end in a real browser
  (add, status change, delete, drag-and-drop, search, filter, validation, notes,
  tasks, overdue, reload persistence, migrations, mobile layout)

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

Start: 2026-07-09
Total: ~2 hours

## Notes

The MVP is intentionally simple. It focuses on the core workflow: add client, update case
status, and see the status distribution at a glance.
