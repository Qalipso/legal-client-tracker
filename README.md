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

**Base**
- Add client with inline validation, toast notifications, delete with confirmation
- Local persistence (localStorage) with v1 → v2 data migration
- Seed demo data on first visit; responsive layout (mobile → desktop)

## Stack

- React 19 + TypeScript (Vite)
- Tailwind CSS v4
- localStorage (no backend)
- Vercel (deploy)

**Why this stack:** the assignment budget is 2–4 hours; React + localStorage + Vercel is the
fastest path to a working, deployable product without backend complexity. The data layer is
isolated in `src/lib/clients.ts`, so swapping localStorage for Supabase later is a one-file change.

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

## Deferred on purpose (out of scope for the time box)

- Drag-and-drop карточек между колонками (статус меняется из панели/таблицы)
- Хранение содержимого файлов (только имена; в проде — Supabase Storage / S3)
- Telegram notification on new client (would be a serverless API route + Bot API call)
- Supabase persistence + auth, ответственный юрист / тип дела
- Automated tests — the app was verified manually end-to-end in a real browser
  (add, status change, delete, search, filter, validation, notes, tasks, overdue,
  reload persistence, v1→v2 migration, mobile layout)

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
