# Security, Data Protection & Architecture

Отдельный security-этап поверх продукта: legal client tracker работает с
персональными и потенциально конфиденциальными данными (ФИО, телефон,
статус дела, комментарии), поэтому доступ, хранение секретов и audit trail
вынесены в отдельный разбор, а не растворены в фичах.

Каждый пункт помечен: **[Implemented]** — есть в коде/схеме сейчас,
**[Planned]** — architecture заложена, но не построена.

## 1. Security goals — статус

| Цель | Статус | Как реализовано |
|---|---|---|
| Не допустить публичного доступа к клиентской базе | **[Implemented]** | Supabase Auth обязателен; без сессии — страница логина, не доска (`src/App.tsx: AuthGate`) |
| Не хранить чувствительные данные без необходимости | **[Implemented]** | Модель данных — только поля, нужные для ведения дела (§3); документы — имя файла, не содержимое |
| Не раскрывать секреты на frontend | **[Implemented]** | `TG_BOT_TOKEN` и `SUPABASE_SERVICE_ROLE_KEY` — только в Supabase Edge Function secrets; во фронтенд-бандле — только публичный anon key (проверено скан-грепом бандла перед каждым коммитом) |
| Ограничить доступ к данным конкретного юриста | **[Implemented]** | RLS `user_id = auth.uid()` на всех таблицах (clients/tasks/case_history/attachments/matter_deadlines/matter_risks/notification_recipients/account_settings); изоляция проверена симуляцией ролей — чужой пользователь видит 0 строк |
| Базовый audit trail | **[Implemented]** | `case_history.user_id` (кто) + `created_at` (когда) + `type`/`text`/`metadata` (что) на каждое действие; см. §9 |
| Предотвратить утечку через README/screenshots/demo | **[Implemented]** | Все демо-данные — вымышленные имена (см. §4); в README — явная пометка fake data |
| Архитектура, расширяемая до настоящего legal CRM | **[Implemented]** | Repository/provider layer отделяет UI от хранилища; см. `docs/architecture.md` |

## 2. Data classification

| Уровень | Данные | Где хранится |
|---|---|---|
| **Public** | название продукта, demo UI, README, скриншоты | GitHub (публичный репозиторий) |
| **Internal** | список клиентов, статусы, комментарии, история, уведомления, настройки юриста | Supabase PostgreSQL, за Auth + RLS |
| **Sensitive** | реальные ФИО, телефоны, email, документы, детали дела, финансовая информация | **Не хранятся в этом MVP** — вместо реальных клиентов используются вымышленные имена; документы — только имя файла (см. §10 Next steps) |

## 3. Data model — что хранится и почему

Полная схема — `supabase/migrations/`. Ключевое решение: модель **не хранит**
паспортные данные, полные тексты договоров или финансовые детали — только
операционные поля, нужные для ведения дела (имя, телефон, статус, тип дела,
контрольные сроки). Это осознанное ограничение объёма чувствительных данных
(data minimization), а не недосмотр.

```ts
type Client = {
  id: string;
  user_id: string;       // владелец записи — на нём построена вся RLS-изоляция
  name: string;
  phone: string;
  status: "new" | "in_progress" | "waiting_client" | "closed";
  note?: string;
  matterTitle?, matterType?, stage?, keyDeadline?, counterparty?, ...  // matter model, v0.4
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;    // soft delete — запись не исчезает физически
};
```

## 4. MVP data policy — fake data only

- Все клиенты в демо-окружении — вымышленные имена (сериальные персонажи,
  generic «Иван Иванов», тестовые записи), вымышленные телефоны.
- Тестовый аккаунт для проверяющих (`test@qalipso.legal`) создан через
  Supabase Dashboard admin-панель, без реальных персональных данных внутри.
- Документы дела — только имя файла (`contract.pdf`), содержимое не
  загружается и не хранится в этом MVP.
- AI-инструменты при разработке не получали реальных клиентских данных —
  см. §11.

## 5. Access control

| Правило | Статус |
|---|---|
| Неавторизованный пользователь не видит клиентские данные | **[Implemented]** — RLS + AuthGate |
| Юрист видит только своих клиентов | **[Implemented]** — `user_id = auth.uid()` на всех таблицах |
| Изменять клиента может только владелец записи | **[Implemented]** — RLS `with check (user_id = auth.uid())` на update |
| Удаление клиента требует подтверждения | **[Implemented]** — `window.confirm` в UI; soft delete (`deleted_at`), не физическое удаление |
| Роли (owner / lawyer / assistant / read-only) | **[Implemented, частично]** — `admin`/`lawyer`/`assistant` есть с реальным DB-level enforcement (см. §6); `read-only reviewer` — **[Planned]** |

## 6. Row Level Security — реализовано

```sql
-- clients, tasks, case_history, attachments, matter_deadlines, matter_risks,
-- notification_recipients, account_settings:
using (user_id = auth.uid()) with check (user_id = auth.uid())
```

Поверх базовой RLS — ролевое ограничение (migration `005_roles_and_avatars.sql`):

```sql
-- assistant не может soft-delete клиента (BEFORE UPDATE trigger, а не только
-- скрытая кнопка в UI)
if current_user_role() = 'assistant' and old.deleted_at is null
   and new.deleted_at is not null then
  raise exception 'insufficient_privilege';
end if;

-- assistant не может создавать/менять получателей и настройки уведомлений
with check (user_id = auth.uid() and current_user_role() <> 'assistant')
```

Проверено симуляцией роли через прямой SQL (`set_config('request.jwt.claims', ...)`),
не только чтением кода — см. `docs/architecture.md` §Trade-offs.

**[Planned]**: team workspace, при котором ассистент видит дела «своего»
юриста — сейчас каждый пользователь строго изолирован от всех остальных,
общего рабочего пространства нет.

## 7. Audit log

`case_history` уже выполняет роль audit trail для всех операций над делом:

| Поле | Аналог из ТЗ | Значение |
|---|---|---|
| `user_id` | `actorId` | кто совершил действие (default `auth.uid()` при insert) |
| `type` | `action` | `client_created \| client_updated \| note_added \| status_changed \| task_created \| task_completed \| attachment_added` |
| `client_id` | `entityId` | какое дело затронуто |
| `metadata` | `metadata` | структурированные детали (например, `{from, to}` для смены статуса) |
| `created_at` | `createdAt` | когда |

`notification_events` — отдельный audit trail для попыток отправки
уведомлений (`sent`/`error`/`skipped` + причина) — покрывает «отправку
уведомления» и «ошибку отправки» из требований.

**Что осознанно не логируется**: полный текст комментария/заметки не
дублируется нигде, кроме одного места (`text` в самой записи истории) —
не пишется отдельно в системные логи приложения; паспортные данные,
документы, финансовые детали в этот MVP не попадают в принципе (see §4),
поэтому и логировать нечего.

## 8. Notification security (Telegram)

| Правило | Статус |
|---|---|
| `TELEGRAM_BOT_TOKEN` не во frontend | **[Implemented]** — только в Supabase Edge Function secrets |
| Уведомление не отправляется напрямую из браузера | **[Implemented]** — фронт вызывает Edge Function (`notify-telegram`), функция сама шлёт в Telegram Bot API |
| `.env` не закоммичен | **[Implemented]** — `.gitignore`: `.env`, `.env.*`, кроме `.env.example` |
| Минимальные данные в уведомлении | **[Implemented]** — сообщение содержит имя, телефон, статус; не содержит комментариев, документов, дат рождения, финансовых деталей (см. `supabase/functions/notify-telegram/index.ts: buildText`) |

Пример реального сообщения (`client.created`):
```
Новый клиент добавлен:
Иван Петров
Телефон: +7 912 413 0000
Статус: Новый
```

## 9. AI usage policy

**Использовалось для:** генерации структуры компонентов, UI/Tailwind-вёрстки,
README/документации, тестовых fake-данных, проверки edge cases, ревью кода.

**Не использовалось для:** обработки реальных клиентских документов;
передачи реальных ФИО/телефонов/деталей дела в AI-инструменты — все данные,
использованные при разработке и тестировании (включая этот документ),
вымышленные (см. §4).

Формулировка для README:
> AI tools were used for scaffolding, UI suggestions, code review and
> README drafting. No real client data was used or shared with AI tools.

## 10. Security checklist — результат прогона (2026-07-09)

```
[x] В demo нет реальных клиентов          — проверено SQL-запросом, только вымышленные имена
[x] В репозитории нет .env                — git ls-files: только .env.example
[x] В коде нет Telegram token             — git grep по паттернам токена: чисто
[x] В коде нет Supabase service role key  — git grep: чисто; 0 вхождений в dist/ бандле
[x] README объясняет MVP limitations      — см. README → Deferred / Next steps
[x] README описывает AI usage             — см. README → AI Usage
[x] README описывает security considerations — этот документ + ссылка из README
[x] Данные fake/sample                    — подтверждено
[x] Live demo работает                    — https://legal-client-tracker.vercel.app, HTTP 200
[x] GitHub repository открыт              — github.com/Qalipso/legal-client-tracker, public
[ ] Есть краткий time log                 — плейсхолдер в README, финальные цифры — за автором проекта
```

## 11. Next steps (security-relevant, не входит в текущий объём)

- Team workspace + назначение ролей из UI (сейчас — прямой SQL/Dashboard)
- Реальное шифрование/хранение содержимого документов (Supabase Storage
  вместо имени файла) с отдельным контролем доступа
- Rate limiting / anomaly detection на уровне API (сейчас полагаемся на
  стандартные лимиты Supabase)
- Формальный retention/deletion policy для persональных данных
- 2FA / passkeys для входа юриста (Supabase поддерживает, не включено)
