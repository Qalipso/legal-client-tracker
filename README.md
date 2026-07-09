# Legal Client Tracker MVP

Small working prototype for lawyers to manage clients and case statuses.
Юрист открывает страницу → видит клиентов → добавляет нового → меняет статус дела → счётчики обновляются.

## Live Demo

[link — pending deploy]

## Features

- Add client (name, phone, status, optional note) with inline validation
- Update case status via dropdown right in the table
- Delete client with confirmation
- Live status counters (Новый / В работе / Ожидает клиента / Закрыт / Всего)
- Search by name, phone, or status + status filter
- Toast notifications for add / update / delete
- Local persistence — data survives page reload (localStorage)
- Seed demo data on first visit so the dashboard looks alive
- Responsive layout (mobile → desktop)

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
    ClientForm.tsx    # add-client form with validation
    ClientTable.tsx   # table + status select + delete
    StatusCards.tsx   # counters per status
    Filters.tsx       # search + status filter
    Toast.tsx         # notifications
  lib/
    clients.ts        # storage layer: load/save/create, seed data
    statuses.ts       # status labels, order, badge styles
  types/
    client.ts         # Client / ClientStatus types
  App.tsx             # state owner: clients, search, filter, toast
```

## Key decisions & trade-offs

- **localStorage over Supabase** — fits the time box; documented limitation: no cross-device
  sync, no auth. The storage module is the single seam for upgrading.
- **Inline form (not modal)** — fewer moving parts, better on mobile, same UX value.
- **`window.confirm` for delete** — native, accessible, zero code; a styled dialog is polish
  the MVP doesn't need.
- **Search matches status labels too** — "в работе" in the search box works as users expect.

## Deferred on purpose (out of scope for the time box)

- Telegram notification on new client (would be a serverless API route + Bot API call)
- Supabase persistence + auth
- Client detail page / status history
- Automated tests — the app was verified manually end-to-end in a real browser
  (add, status change, delete, search, filter, validation, reload persistence, mobile layout)

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
