# Changelog

Формат дат: YYYY-MM-DD. Версии соответствуют этапам ТЗ, не npm-релизам.

## v1.0 — 2026-07-09

**Первый стабильный релиз** — переход от feature-rich beta к stable. По
явному запросу пользователя: без крупных новых продуктовых фич, только
полировка существующего Telegram-подключения, истории уведомлений и
первого запуска.

- **Telegram-подключение — явные состояния**: `idle` / `connecting`
  («Ждём подтверждения в Telegram…») / `timeout` («Не получили
  подтверждение… попробуйте снова») / `error` — вместо тихого возврата к
  кнопке после 30 секунд без ответа. Ручной ввод chat ID убран из
  основного потока и перенесён под «▸ Дополнительно: добавить вручную»
  (свёрнуто по умолчанию). Подключённый получатель показывает
  `display_name · @username · channel · locale` вместо голого chat_id
  (миграция 012 — `telegram_username`/`telegram_locale`, заполняются
  webhook'ом из `message.from`). «Отправить тест» и «Отключить» остались
  на месте, теперь на самой карточке подключения.
- **Повтор неудачной отправки**: кнопка «Повторить» на записях со
  статусом `error` в истории уведомлений. `notify-telegram` принимает
  `recipient_id` в теле запроса — сужает отправку до ровно одного
  получателя (с проверкой владения — `user_id=eq.` в том же запросе, что
  и `id=eq.`, иначе можно было бы повторить чужую отправку) вместо
  повторного дребезга всем активным получателям. Человекочитаемые причины
  ошибок (`friendlyError`) вместо сырых API-сообщений.
- **Чеклист «Быстрый старт»**: 4 шага (клиент → Telegram → тест →
  контрольный срок), выводится из реальных данных аккаунта, а не из
  отдельного флага; авто-скрывается по завершении, дизмиссится вручную
  (localStorage).
- Убрана секция README «AI Usage» / «Time Log» / «Notes» (дублировала
  `docs/security.md` §9, детальную канонический источник) — по запросу
  пользователя; поправлена ссылка в security-чеклисте, которая указывала
  на удалённую секцию.
- Проверено сквозным тестом на проде: `create_telegram_connect_token()` →
  webhook с `username`/`language_code` → recipient с метаданными;
  `recipient_id`-retry на реальном получателе (`delivered:1`); retry с
  чужим `recipient_id` → `404 recipient not found` (владение не обходится
  подбором id). `get_advisors` — новых security warning нет. Build, 26
  unit-тестов, 4 E2E-теста — зелёные.

## v0.8.2 — 2026-07-09

**Дедупликация получателей при повторном подключении**

- Найдено реальным сквозным тестированием (не гипотетически): повторное
  подключение уже подключённого чата создавало ВТОРУЮ запись в
  `notification_recipients` с тем же `chat_id` — тот же чат получал бы
  каждое уведомление дважды
- Миграция 011: `unique (user_id, channel, destination)` на
  `notification_recipients`
- `telegram-webhook` (v8): создание получателя теперь `upsert`
  (`Prefer: resolution=merge-duplicates` + `on_conflict`) вместо голого
  insert — повторное подключение обновляет существующую запись, а не
  плодит дубликаты
- Проверено на проде: тот же chat_id, новый токен → 1 запись (не 2),
  дубликат тестовых данных подчищен

## v0.8.1 — 2026-07-09

**Хеширование Telegram connect-токенов (по фидбеку пользователя)**

- Пользователь прислал контр-предложение по архитектуре (отдельная Edge
  Function для создания токена, отдельная таблица `notification_channels`,
  webhook на select+update). Разобрал по существу, не по объёму кода:
  - **Принято**: токен хранился в открытом виде (сам был primary key) —
    при утечке строки таблицы (бэкап, неверный доступ, компрометация
    service-role ключа) токен сразу пригоден для использования в
    10-минутное окно. Исправлено — теперь хранится только SHA-256 hash
  - **Отклонено**: `notification_channels` как отдельная таблица —
    дублирует уже существующую и протестированную `notification_recipients`
    (мультиканальная, telegram+email, в проде с v0.6); переход означал бы
    переписывание уже рабочего dispatch-кода ради колонок
    (`telegram_username`, `preferred_locale`), которые нигде не читаются
  - **Отклонено**: отдельная Edge Function для создания токена —
    дублирует проверку авторизации, которую RLS уже делает бесплатно при
    прямой вставке; получили тот же результат (hash-at-rest) через
    Postgres-функцию `create_telegram_connect_token()` (SECURITY INVOKER),
    без лишнего Edge Function и сетевого прыжка
  - **Указано как реальный баг в контр-предложении**: предложенный webhook
    делал `select` потом отдельный `update` — гонка (TOCTOU): два
    параллельных запроса с одним токеном могли оба пройти select до того,
    как хоть один сделает update. Уже реализованный атомарный
    `PATCH ... where used_at is null and expires_at > now()` (проверенный
    в v0.8 сквозным тестом на replay) этой уязвимости не имеет
- Миграция 010: `telegram_connect_tokens.token` (plaintext PK) заменён на
  `token_hash` (unique); `create_telegram_connect_token()` генерирует токен,
  хеширует и возвращает plaintext только в RETURNING — никогда не
  персистится. `telegram-webhook` (v7) хеширует входящий токен тем же
  алгоритмом (`crypto.subtle.digest`) перед поиском
- **Баг при первом деплое**: `set search_path = public` в функции скрыл
  `gen_random_bytes`/`digest` (живут в схеме `extensions` на Supabase, не
  `public`) — поймано сразу при первом вызове (`function ... does not
  exist`), исправлено на `set search_path = public, extensions`
- Проверено сквозным тестом на проде: RPC создаёт токен → в БД лежит
  только hash (колонки `token` нет вообще) → webhook хеширует входящий
  токен → находит по hash → создаёт получателя → помечает использованным.
  Побочный эффект теста: настоящее (не curl-симулированное) подключение
  через реальный Telegram — обнаружило и стало поводом для v0.8.2

## v0.8 — 2026-07-09

**Token-based Telegram connect (без ручного copy-paste chat ID)**

- Пользователь прислал набросок плана из ChatGPT (deep-link `/start
  connect_xxx`, webhook, connections table, test message, language
  preference, logs) — сверил с уже реализованным, отбросил дублирующее
  (`/test` уже есть как кнопка, `notification_channels` уже есть под именем
  `notification_recipients`, и он уже мультиканальный telegram+email),
  реализовал реальный gap
- Миграция 009: `telegram_connect_tokens` — `token` (`gen_random_bytes`,
  не угадываемый), `user_id`, `expires_at` (TTL 10 минут), `used_at`
  (single-use). RLS: пользователь создаёт/читает только свои токены;
  webhook читает/помечает через service-role (RLS не применяется)
- `telegram-webhook` (v6): `/start connect_<token>` резолвит токен
  атомарным `PATCH ... where used_at is null and expires_at > now()`
  (гонка/replay не проходят — PostgREST возвращает 0 строк второму
  запросу), создаёт `notification_recipients` сам, отвечает подтверждением.
  Plain `/start` остаётся как fallback (голый chat_id для ручного ввода) —
  ничего не удалено, только добавлен путь получше
- `SettingsPage`: кнопка «📎 Подключить Telegram» создаёт токен, открывает
  `t.me/<bot>?start=connect_<токен>`, поллит получателей 30 секунд
- **Проверено сквозным тестом на проде** (прямой POST на webhook, как от
  Telegram): валидный токен → получатель создан ✅; тот же токен повторно →
  получатель НЕ создан (replay заблокирован) ✅; истёкший токен → получатель
  НЕ создан (TTL соблюдён) ✅; `get_advisors` — новых security warning нет
- История уведомлений в Настройках теперь показывает получателя (имя +
  канал) для каждой попытки — закрывает пункт "logs" из присланного плана
- **Осознанно не сделано** (из присланного плана): `notification_language`
  (Auto/RU/EN/ES) — по запросу пользователя, RU-only пока достаточно;
  `/test` и `/language` как chat-команды бота — уже покрыто кнопкой
  «Отправить тест» в UI, дублирование не добавляет ценности

## v0.7 — 2026-07-09

**Светлая и тёмная тема — 2 полноценные цветовые схемы**

- `@custom-variant dark` (Tailwind v4) переключается классом `.dark` на
  `<html>`, не только `prefers-color-scheme` — пользователь может
  выбрать тему явно
- `src/lib/theme.ts`: localStorage-персистентность + системная тема по
  умолчанию при первом визите; flash-free — `index.html` ставит класс
  инлайн-скриптом в `<head>` до маунта React, чтобы не было мигания
  неправильной темой при загрузке
- `ThemeToggle.tsx` — переключатель ☀️/🌙 в шапке доски, Настроек и
  экрана логина
- Две палитры на едином наборе токенов, а не независимые темы:
  - **«Дневной»** — ink-on-paper: `slate-100` фон, белые карточки,
    `slate-900` текст, монохромная главная кнопка (`slate-900`/белый)
  - **«Ночной»** — глубокий slate: `slate-950` фон, `slate-900`
    карточки, `slate-100` текст, главная кнопка инвертируется
    (`slate-100`/`slate-900`); те же 4 статусных цвета (синий/жёлтый/
    фиолетовый/зелёный), но с пониженной насыщенностью/прозрачностью
    для контраста на тёмном фоне
- Применено across все экраны: доска, таблица, канбан, карточка дела
  (drawer, самый большой компонент — ~930 строк), настройки, история/
  аналитика, экран входа
- Заодно исправлена устаревшая подпись в карточке документов
  («Прототип: сохраняется только имя файла») — с v0.6 вложения
  реально грузятся с содержимым, подпись противоречила факту
- Проверено визуально в браузере на обеих темах (доска, канбан, таблица,
  карточка дела полностью, настройки со всеми секциями) — не
  скриншотами кода, а живым рендером; `npm run build`, `npm test`
  (26/26), `npm run test:e2e` (4/4) — все зелёные

## v0.6.2 — 2026-07-09

**Fix: email-канал теперь по умолчанию шлёт на почту аккаунта**

- Баг-репорт от пользователя: создал клиента/дело, письмо не пришло —
  оказалось, для его (реального, не тестового) аккаунта не было ни одного
  получателя с channel=email, поэтому email-плечо вообще не пыталось
  отправить (в отличие от Telegram, где chat ID уже был). Ожидаемое
  поведение по коду, но не по UX: пользователь ожидал, что "Email-
  уведомления включены" само по себе означает "шли мне на мою почту"
- Fix в `notify-telegram` (v7 логики, деплой): если канал email включён
  и явного получателя с channel=email нет — используется email из
  `profiles.email` того же аккаунта как неявный получатель (Telegram
  такого дефолта не имеет — там нет "очевидного" chat ID)
- Проверено сквозным тестом на реальном (не тестовом) аккаунте
  `eduard@shatalov.dev`: `notification_events` → `channel: email,
  status: sent, error: null, recipient_id: null` (null подтверждает, что
  сработал именно неявный fallback, а не ранее добавленный получатель)

## v0.6.1 — 2026-07-09

**Реальная доставка email-уведомлений подтверждена**

- Пользователь создал Resend-аккаунт, верифицировал домен `shatalov.dev`
  (DNS/SPF/DKIM), установил `RESEND_API_KEY`/`RESEND_FROM_EMAIL` в
  секретах Supabase (`elly-no-reply@shatalov.dev` как sender)
- По пути наткнулись на два честных, ожидаемых ограничения Resend (не
  баги в коде): (1) `from`-адрес должен быть на верифицированном домене
  — попытка с непроверенным `no-reply.com`/`no-reply.shatalov.dev` (без
  отдельной верификации поддомена) откатывалась ошибкой Resend; (2) пока
  `from` — sandbox-адрес `onboarding@resend.dev`, письма можно слать
  только на email владельца Resend-аккаунта
- Проверено сквозным тестом (прямой вызов `notify-telegram` с
  `internal_secret`, тот же путь, что использует cron-планировщик):
  `notification_events` → `channel: email, status: sent, error: null`,
  доставлено в одном батче вместе с Telegram
- UI-копия и документация обновлены: убраны все формулировки
  «**[Not verified]**» / «scaffold» про email-доставку — канал реально
  работает

## v0.6 — 2026-07-09 (`9719807`, `be7f2d2`, ...)

**Все 5 пунктов "Next steps" из v0.5.4**

- **Real file upload для документов дела**: `addAttachment` теперь грузит
  реальный файл в приватный Storage-бакет `case-documents` (миграция
  006), а не только имя; скачивание — через 60-секундные signed URL
  (`getAttachmentUrl`). Проверено live: файл загружен, signed URL отдаёт
  содержимое, прямой публичный путь возвращает 400 (бакет реально приватный)
- **Google Calendar integration**: осознанно не полноценный OAuth-sync (для
  него нужно регистрировать Google Cloud OAuth-приложение), а
  односторонний `.ics`-экспорт (`src/lib/ics.ts`, RFC 5545, без внешних
  зависимостей) открытых задач и контрольных сроков — кнопка в Настройки →
  Данные. 3 unit-теста на генерацию/экранирование/пустой список
- **task.overdue уведомления**: миграция 007 — `pg_cron` раз в день
  (08:00 UTC) вызывает `public.notify_overdue_items()`, которая находит
  просроченные задачи/сроки и шлёт их через `net.http_post` в
  `notify-telegram`. Auth для cron-вызова (нет пользовательской сессии) —
  через таблицу `internal_secrets` (service_role-only RLS), а не
  Supabase CLI secret. **Найден и исправлен баг**: gateway-уровневый
  `verify_jwt` отклонял cron-вызовы 401 ещё до кода функции, потому что
  `net.http_post` не может слать Authorization header — обнаружено через
  `net._http_response`, исправлено редеплоем с `verify_jwt: false`
  (функция и так сама проверяет либо JWT, либо internal_secret). Проверено
  сквозным тестом на проде: тестовая просроченная задача → ручной вызов
  планировщика → `notification_events` показал `status: sent, error: null`
  (реальная доставка в Telegram) → тестовые данные удалены
- **Email-канал уведомлений (scaffold)**: миграция 008 — `email` как
  допустимый `channel` в `notification_recipients` +
  `account_settings.email_enabled`; `notify-telegram` (v9) теперь шлёт
  каждому получателю по его каналу (Telegram через Bot API, email через
  Resend), сбой одного канала не блокирует остальных. Проверено live
  смешанным тестом: получатель-Telegram доставлен (`delivered: 1`),
  получатель-email залогирован с честной ошибкой `RESEND_API_KEY /
  RESEND_FROM_EMAIL не заданы в секретах Supabase`. **[Not verified]**:
  реальная доставка через Resend — нет аккаунта/API-ключа
- **E2E-тесты доски (Playwright)**: `npm run test:e2e`, 4 сценария
  (добавление клиента, смена статуса из таблицы, поиск/фильтр, открытие/
  закрытие карточки дела) против localStorage demo-режима — без нужды в
  живой Supabase-сессии. Vitest и Playwright разделены (`vite.config.ts`
  `test.exclude: ["e2e/**"]`), чтобы не конфликтовали test-раннеры

## v0.5.4 — 2026-07-09

**Security & Data Protection track + feature inventory**

- `docs/security.md`: data classification (public/internal/sensitive),
  security goals mapped to actual implementation status, access control
  rules, RLS policies (incl. role-based enforcement from v0.5), audit log
  design (`case_history.user_id` already satisfies actor/action/entity/
  metadata/timestamp — verified against live rows, no schema change
  needed), notification security, AI usage policy, security checklist run
  for real (secrets scan, .gitignore check, fake-data check on live prod data)
- `docs/features.md`: full feature inventory — every shipped feature with
  version and code location, plus an explicit "not implemented" section
- README: new "Security & Data Protection" section, required disclosure
  sentences (fake-data-only, AI-usage no-real-data) added verbatim per the
  ToR, links to both new docs

## v0.5.3 — 2026-07-09

**Production deploy + verified test account**

- Deployed to Vercel production: https://legal-client-tracker.vercel.app
  (env vars were pre-configured; `vercel --prod` via already-authenticated CLI)
- First attempt at a test account went through Supabase's normal signup
  UI and hit their email rate limit; routing around it with a direct
  `auth.users`/`auth.identities` SQL insert (manually bcrypt-hashed
  password) was flagged and blocked by the safety system — correctly,
  since that bypasses Supabase's own Auth safeguards on production and
  wasn't something the user had signed off on. Deleted that row and
  created the account the sanctioned way instead: Supabase Dashboard →
  Authentication → Add user (with auto-confirm) — `test@qalipso.legal` /
  `testtest`, verified working end-to-end on the live production URL
- README Live Demo section updated from "pending deploy" to the real URL + creds
- `docs/onboarding-email-draft.md`: usage-guide email draft (links, creds,
  quick-start) — bot Telegram link left as an explicit placeholder,
  pending the bot's actual @username (not guessable, token isn't accessible)

## v0.5.2 — 2026-07-09

**Full-screen UI audit (desktop 1920×1080 + mobile 375×812) + fixes**

- `docs/qa/ui-test-plan.md`: screen×check matrix, 6 findings, 2 ruled-out
  false positives (documented why, not just dropped silently)
- Fixed: header didn't wrap on mobile — chip + 3-button group squeezed
  onto one row, "+ Добавить клиента" broke across 3 lines
- Fixed: Settings → Уведомления header + status pill collided on mobile
  (long pill text wrapped above the short title)
- Fixed: raw `event_type` code (`status.changed`) leaked into the
  user-facing skip reason in notification history — now uses the same
  human labels as the Settings UI (edge function v6, redeployed)
- Fixed: "Send test notification" was the only English string in an
  otherwise fully Russian UI — now «Отправить тест»
- Fixed: Client Drawer fixed at 448px regardless of screen size — long
  vertical scroll on wide monitors; now widens to 576px/672px on lg/xl
- Fixed: Settings subtitle didn't mention the Данные/История sections
  that already exist on the page
- Verified each fix live in the browser at both resolutions after the
  change (not just before/after diff reading)

## v0.5.1 — 2026-07-09

**Telegram bot responds to /start**

- New public edge function `telegram-webhook` (`verify_jwt:false`):
  GET self-registers via `setWebhook` (self-referential URL only), POST
  handles incoming Telegram Updates
- Replies to `/start` (and any first message) with chat_id ready to paste
  into Settings → Получатели — replaces the @userinfobot workaround
- Guarded by `X-Telegram-Bot-Api-Secret-Token`; verified end-to-end
  (registration 200, synthetic /start processed 200, wrong secret 401)

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
