# Feature Inventory — Legal Client Tracker

Полный перечень фич проекта на текущий момент (v0.5.2 + bot `/start`).
Каждая фича — с версией появления и файлом/местом в коде. `[Implemented]` —
работает и проверено; `[Planned]` — заложено в архитектуре, не построено.

## 1. Аутентификация и доступ

| Фича | Версия | Где в коде |
|---|---|---|
| Регистрация / вход / выход (email + пароль) | v0.3 | `src/components/AuthPage.tsx` |
| Защищённые маршруты — без сессии показывается только логин | v0.3 | `src/App.tsx: AuthGate` |
| Автосоздание профиля и настроек при регистрации | v0.3 | триггер `handle_new_user`, migration 003 |
| Demo-режим без авторизации (localStorage) при отсутствии Supabase env | v0.1–v0.5 | `src/lib/providers/localStorageProvider.ts` |
| Роли `admin` / `lawyer` / `assistant` с реальным ограничением прав в БД | v0.5 | migration 005, триггер `forbid_assistant_delete`, RLS |

## 2. Доска и таблица клиентов

| Фича | Версия | Где в коде |
|---|---|---|
| Канбан-доска по 4 статусам (Новый/В работе/Ожидает клиента/Закрыт) | v0.1 | `src/components/BoardView.tsx` |
| Drag-and-drop карточек между колонками | v0.2.1 | `BoardView.tsx` (HTML5 DnD) |
| Табличный вид (переключатель Доска/Таблица) | v0.1 | `src/components/ClientTable.tsx` |
| Live-счётчики по статусам | v0.1 | `src/components/StatusCards.tsx` |
| Поиск по имени/телефону/статусу | v0.1 | `src/components/Filters.tsx` |
| Фильтр по статусу | v0.1 | `Filters.tsx` |
| Фильтр «Просроченные задачи» | v0.3 | `src/App.tsx` |
| Цветовая система статусов (иконки, тонированные колонки) | v0.2.1 | `src/lib/statuses.ts` |
| Welcome empty state для нового пользователя | v0.3 | `src/App.tsx` |

## 3. Карточка клиента / дела (Client Drawer)

| Фича | Версия | Где в коде |
|---|---|---|
| Добавление клиента (форма, валидация имени/телефона) | v0.1 | `src/components/ClientForm.tsx` |
| Редактирование клиента | v0.2 | `ClientDetails.tsx: EditForm` |
| Soft delete с подтверждением | v0.2 | `deleted_at`, `window.confirm` |
| Сводка дела (название, тип, стадия, предмет, срок, приоритет) | v0.4 | `ClientDetails.tsx: MatterSummarySection` |
| Стороны (доверитель + контрагент) | v0.4 | `ClientDetails.tsx: PartiesSection` |
| Следующие действия (быстрые задачи) | v0.1 | `ClientDetails.tsx: TasksSection` |
| Контрольные сроки (типизированные юридические дедлайны) | v0.4 | `ClientDetails.tsx: DeadlinesSection` |
| Риски / открытые вопросы | v0.4 | `ClientDetails.tsx: RisksSection` |
| Заметки (попадают в историю дела) | v0.1 | `ClientDetails.tsx: NoteSection` |
| Документы — реальная загрузка в приватный Storage (тип/статус документа) | v0.4→v0.6 | `ClientDetails.tsx: DocumentsSection`, migration 006, `case-documents` bucket |
| История дела — единый timeline событий | v0.1 | `ClientDetails.tsx: HistorySection` |
| История изменения статусов (срез истории) | v0.1 | `HistorySection` |
| Подсветка просроченных сроков/задач | v0.1 | `src/lib/clients.ts: isOverdue` |

## 4. Matter model — юридический workflow

| Фича | Версия | Где в коде |
|---|---|---|
| Поля дела: matter_title, matter_type, matter_subject, stage, counterparty, key_deadline | v0.4 | migration 004, `src/types/client.ts` |
| Справочник «Типы дел» (Договор/Претензия/Суд/Консультация/Корпоративное/Миграционное) | v0.4 | `matter_types` table |
| Справочник «Стадии дел» | v0.4 | `matter_stages` table |
| Справочник «Типы документов» | v0.4 | `document_types` table |
| Справочник «Статусы документов» | v0.4 | `document_statuses` table |
| Справочник «Типы сроков» | v0.4 | `deadline_types` table |
| `MatterDeadline` — типизированные сроки, отдельно от быстрых задач | v0.4 | `matter_deadlines` table |
| `MatterRisk` — риски/открытые вопросы | v0.4 | `matter_risks` table |

## 5. Настройки аккаунта (`#/settings`)

| Фича | Версия | Где в коде |
|---|---|---|
| Профиль: имя, компания, email (readonly) | v0.3 | `SettingsPage.tsx` |
| Фото профиля — реальная загрузка в Supabase Storage | v0.5 | `uploadAvatar`, bucket `avatars` |
| Бейдж роли в профиле и в header | v0.5 | `UserChip.tsx` |
| Тумблеры уведомлений (Telegram вкл/выкл + по событиям) | v0.3 | `SettingsPage.tsx: Уведомления` |
| Получатели уведомлений (Telegram chat ID), добавление/отключение/удаление | v0.2.2 | `SettingsPage.tsx: Получатели` |
| «Отправить тест» — проверка доставки уведомления | v0.2.2 | `sendTestNotification` |
| Импорт клиентов из CSV | v0.5 | `SettingsPage.tsx: handleImportSelect`, `src/lib/csv.ts` |
| Экспорт клиентов в CSV | v0.5 | `SettingsPage.tsx: exportCsv` |
| История уведомлений (sent/error/skipped + причина) | v0.2.2 | `SettingsPage.tsx: История уведомлений` |

## 6. Уведомления (Telegram + email)

| Фича | Версия | Где в коде |
|---|---|---|
| Edge Function маршрутизации уведомлений (per-user, по JWT) | v0.2.1→v0.3 | `supabase/functions/notify-telegram` |
| События: client.created, task.created, status.changed, task.overdue, test | v0.2.1–v0.6 | `notify-telegram/index.ts: buildText` |
| Журнал попыток отправки (`notification_events`) | v0.3 | migration 003 |
| Бот отвечает на `/start` — присылает свой chat ID | v0.5.1 | `supabase/functions/telegram-webhook` |
| Fire-and-forget вызов из UI (не блокирует основной сценарий) | v0.2.1 | `src/lib/notify.ts` |
| `task.overdue` планировщик (pg_cron, ежедневно 08:00 UTC) | v0.6 | migration 007, `notify_overdue_items()` |
| Email-канал (получатели, toggle, dispatch через Resend, верифицированный домен `shatalov.dev`) | v0.6 | migration 008, `notify-telegram/index.ts` |

## 7. История и аналитика

| Фича | Версия | Где в коде |
|---|---|---|
| Вкладка `#/analytics` — честный плейсхолдер (без выдуманных данных) | v0.5 | `src/components/AnalyticsPage.tsx` |
| Реальные отчёты (нагрузка, просрочки, скорость закрытия) | — | **[Planned]** |

## 8. Архитектура и инфраструктура

| Фича | Версия | Где в коде |
|---|---|---|
| Repository/provider layer (UI не знает источник данных) | v0.2 | `src/lib/providers/types.ts` |
| Supabase provider (PostgreSQL, основной) | v0.2 | `supabaseProvider.ts` |
| localStorage provider (demo-режим) | v0.1 | `localStorageProvider.ts` |
| Миграции данных localStorage v1→v2→v3→v4 | v0.2–v0.4 | `localStorageProvider.ts: migrate` |
| RLS на всех пользовательских таблицах | v0.3 | migrations 003–005 |
| Единый Supabase-клиент (singleton) | v0.5.1 fix | `src/lib/supabaseClient.ts` |
| Vercel production deploy | v0.5.3 | `https://legal-client-tracker.vercel.app` |

## 9. Тестирование

| Фича | Версия | Где в коде |
|---|---|---|
| Unit-тесты провайдера (CRUD, миграция v1) | v0.5 | `src/lib/providers/localStorageProvider.test.ts` |
| Unit-тесты CSV parse/serialize | v0.5 | `src/lib/csv.test.ts` |
| Unit-тесты date/overdue helpers | v0.5 | `src/lib/clients.test.ts` |
| Unit-тесты `.ics` генератора | v0.6 | `src/lib/ics.test.ts` |
| E2E-тесты доски (Playwright, 4 сценария) | v0.6 | `e2e/board.spec.ts` (`npm run test:e2e`) |

## 10. Что осознанно НЕ реализовано (см. README → Next steps)

- Team workspace / общий доступ ассистента к делам юриста
- Полноценный Google Calendar OAuth-sync (сейчас — односторонний `.ics`-экспорт)
- Роль/приглашение через UI (сейчас — прямой SQL/Supabase Dashboard)
