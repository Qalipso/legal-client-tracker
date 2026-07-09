# Architecture — Legal Client Tracker

> Отражает состояние кода на v0.3 (commit `c45ed63`). Каждый пункт помечен
> `[Implemented]` (есть в коде, путь указан) или `[Planned]` (намерение).

## 1. System Context

```
┌──────────────┐   HTTPS (anon key + user JWT)   ┌─────────────────────────┐
│   Browser    │────────────────────────────────▶│  Supabase               │
│  React SPA   │                                 │  ├─ Auth (GoTrue)       │
│  (Vercel)    │──── POST /functions/v1/ ───────▶│  ├─ PostgreSQL + RLS    │
└──────────────┘     notify-telegram             │  └─ Edge Function       │
       │                                         └───────────┬─────────────┘
       │ demo-mode fallback                                  │ Bot API
       ▼                                                     ▼
  localStorage                                     Telegram (получатели)
```

Актор — юрист (один пользователь = один аккаунт, ролей нет). Внешние системы:
Supabase (auth + данные + функция), Telegram Bot API (уведомления).
Граница доверия: браузер владеет только anon key + JWT пользователя;
`TG_BOT_TOKEN` и `service_role` живут исключительно в Edge Function
(секреты Supabase).

## 2. Components

| Компонент | Путь | Ответственность | Статус |
|---|---|---|---|
| Root / AuthGate | `src/App.tsx` | сессия Supabase Auth; без сессии → AuthPage; demo-mode без env — без auth | `[Implemented]` |
| MainApp | `src/App.tsx` | владелец состояния: AppData, hash-роутинг (`#/settings`), поиск/фильтры, все мутации через провайдер | `[Implemented]` |
| AuthPage | `src/components/AuthPage.tsx` | login / signup / ошибки / подсказка о подтверждении email | `[Implemented]` |
| BoardView | `src/components/BoardView.tsx` | канбан по статусам, drag-and-drop карточек (HTML5 DnD), подсветка просрочки | `[Implemented]` |
| ClientTable | `src/components/ClientTable.tsx` | табличный вид, клик по имени открывает drawer | `[Implemented]` |
| ClientDetails | `src/components/ClientDetails.tsx` | drawer дела: инфо, редактирование, заметки, задачи, документы (имя файла), timeline, история статусов | `[Implemented]` |
| SettingsPage | `src/components/SettingsPage.tsx` | профиль, тумблеры уведомлений, получатели, тест, история отправок | `[Implemented]` |
| Data layer | `src/lib/providers/types.ts` | интерфейс `DataProvider` — UI не знает источник данных | `[Implemented]` |
| Supabase provider | `src/lib/providers/supabaseProvider.ts` | PostgREST-доступ; каждая мутация пишет событие в `case_history` | `[Implemented]` |
| localStorage provider | `src/lib/providers/localStorageProvider.ts` | demo-mode; миграции формата v1→v2→v3; seed | `[Implemented]` |
| Supabase client | `src/lib/supabaseClient.ts` | модульный синглтон (один GoTrueClient на страницу) | `[Implemented]` |
| Notify | `src/lib/notify.ts` | fire-and-forget вызов функции с JWT пользователя | `[Implemented]` |
| Edge Function | `supabase/functions/notify-telegram/index.ts` | per-user маршрутизация Telegram + журнал попыток | `[Implemented]` |
| Schema | `supabase/migrations/00{1,2,3}_*.sql` | таблицы, RLS, триггер провижининга | `[Implemented]` |

## 3. Data model

Основные таблицы (`001_init.sql`, `003_auth_ownership.sql`):

- `clients` — карточка дела; `status` check (new / in_progress / waiting_client / closed);
  soft delete через `deleted_at`; `user_id default auth.uid()`.
- `case_history` — activity log дела: `client_created, client_updated, note_added,
  status_changed (metadata {from,to}), task_created, task_completed, attachment_added`.
- `tasks` — следующие действия; `due_date` + `completed/completed_at`;
  просрочка вычисляется на клиенте (`src/lib/clients.ts: isOverdue`).
- `attachments` — MVP: только `file_name`; колонки `file_url/storage_path`
  заложены под реальную загрузку `[Planned]`.
- `profiles`, `account_settings` — создаются триггером `handle_new_user`
  при регистрации.
- `notification_recipients` — получатели (channel='telegram', destination=chat_id).
- `notification_events` — журнал попыток: status `sent|error|skipped`,
  error, payload jsonb, sent_at.

RLS: политики `using (user_id = auth.uid())` на всех пользовательских таблицах;
`notification_events` — select-only для владельца (пишет функция через service role).

## 4. Data & Control Flow

**Мутация данных (например, смена статуса):**
UI → `provider.updateClientStatus()` → update `clients` + insert `case_history`
→ провайдер возвращает свежий `AppData` → `setData` → счётчики/доска
перерисовываются. При ошибке UI сохраняет прежнее состояние и показывает toast.

**Уведомление:**

```
UI action ──▶ notifyEvent(type, payload)          (fire-and-forget)
                 │  POST + Authorization: Bearer <user JWT>
                 ▼
notify-telegram (Deno):
  JWT ─▶ auth.uid()
  auth.uid() ─▶ account_settings (telegram_enabled + тумблер события)
             ─▶ notification_recipients (active, telegram)
  для каждого получателя ─▶ Bot API sendMessage
  каждая попытка ─▶ insert notification_events (service role)
  нет токена / получателей / выключено ─▶ {skipped, reason}
```

События: `client.created`, `task.created`, `status.changed` — отправляются из UI
`[Implemented]`; `test` — из SettingsPage `[Implemented]`; `task.overdue` —
поддержан схемой и настройками, но автоматического планировщика нет `[Planned]`
(нужен pg_cron / scheduled function).

## 5. Decisions (ADR, кратко)

1. **Repository/provider layer** — UI зависит только от `DataProvider`.
   *Следствие:* Supabase заменяем на Express/FastAPI без правок компонентов;
   demo-mode бесплатен. Принято в v0.2.
2. **`user_id default auth.uid()` + RLS вместо фильтров в коде** — владение
   данными обеспечивает БД, а не дисциплина разработчика. *Следствие:* мутации
   провайдера не изменились при переходе на multi-user; изоляция проверяется
   SQL-симуляцией ролей. Принято в v0.3.
3. **Activity log как единый timeline** (`case_history`), история статусов —
   его срез по `type='status_changed'`. *Следствие:* аудит и отчёты без
   дополнительных таблиц; metadata jsonb для машиночитаемых деталей.
4. **Секреты только server-side** — токен бота недоступен фронтенду в принципе;
   фронт шлёт JWT, функция резолвит получателей сама. *Отвергнуто:* хранение
   chat_id/токена в клиенте (утечёт из бандла).
5. **Hash-роутинг вместо react-router** — одна зависимость меньше для двух
   экранов. *Следствие:* при росте числа страниц заменить на router `[Planned]`.
6. **Soft delete** (`deleted_at`) — дело можно восстановить, история не теряется.

## 6. Trade-offs

- **Refetch-all после мутации** (простота > трафик): при каждой записи провайдер
  перечитывает 4 таблицы. На объёмах юриста (сотни записей) это дешевле, чем
  кэш-инварианты; при росте — точечные обновления/realtime `[Planned]`.
- **Permissive email-confirm flow**: Supabase по умолчанию требует подтверждение
  email; UI honest-сообщает об этом. Отключается в Dashboard → Auth.
- **task.overdue без планировщика**: подсветка на доске есть, push-уведомление
  требует cron — осознанно отложено.

## 7. Open Questions / Planned

- Реальная загрузка файлов в Supabase Storage (`storage_path` уже в схеме).
- Scheduled `task.overdue` (pg_cron + функция) и email reminders.
- Роли (admin / lawyer / assistant) поверх RLS.
- Google Calendar integration; realtime-обновления; пагинация.
- Автотесты: unit на провайдеры, E2E на доску (сейчас — ручная браузерная
  верификация каждого релиза).
