# Setup — Legal Client Tracker

## 1. Локальный запуск (demo-mode, без backend)

```bash
git clone https://github.com/Qalipso/legal-client-tracker.git
cd legal-client-tracker
npm install
npm run dev        # http://localhost:5173
```

Без env-переменных приложение работает в **demo-режиме**: авторизации нет,
данные (включая seed-клиентов) живут в localStorage браузера. Подходит для
быстрого просмотра UI.

## 2. Полный режим (Supabase)

### 2.1 Создать проект

1. [supabase.com](https://supabase.com) → New project (free tier достаточно).
2. SQL Editor → выполнить по порядку:
   - `supabase/migrations/001_init.sql`
   - `supabase/migrations/002_settings.sql` *(таблица из v0.2; `003` её удаляет — можно пропустить)*
   - `supabase/migrations/003_auth_ownership.sql` — auth, `user_id`+RLS, profiles/account_settings
   - `supabase/migrations/004_matter_model.sql` — matter-поля clients,
     справочники (типы/стадии дел, типы/статусы документов, типы сроков),
     таблицы `matter_deadlines`, `matter_risks`
   - `supabase/seed.sql` — опционально, демо-данные (после `003` seed-строки
     не имеют владельца; привяжите к своему пользователю:
     `update clients set user_id = '<ваш auth.uid>' where user_id is null;`
     аналогично tasks / case_history / attachments)

### 2.2 Задеплоить Edge Functions

```bash
npx supabase login
npx supabase link --project-ref <PROJECT_REF>
npx supabase functions deploy notify-telegram
npx supabase functions deploy telegram-webhook --no-verify-jwt
```

`telegram-webhook` обязательно с `--no-verify-jwt` — Telegram не умеет
слать Supabase JWT, эндпоинт должен быть публичным (защищён отдельным
`secret_token`, см. docs/notifications.md).

### 2.3 Env для фронтенда

```bash
cp .env.example .env.local
# VITE_SUPABASE_URL      = https://<PROJECT_REF>.supabase.co
# VITE_SUPABASE_ANON_KEY = <anon key: Dashboard → Settings → API>
```

Anon key — публичный (данные защищает RLS). `.env*` в `.gitignore`,
кроме `.env.example`.

### 2.4 Auth

По умолчанию Supabase требует подтверждение email при регистрации.
Для теста/демо: Dashboard → Authentication → Providers → Email →
выключить **Confirm email**.

## 3. Telegram-уведомления

1. В Telegram: **@BotFather** → `/newbot` → получить токен.
2. Положить токен в секреты (только server-side):
   ```bash
   npx supabase secrets set TG_BOT_TOKEN=<токен>
   ```
   или Dashboard → Edge Functions → Secrets.
3. Задеплоить `notify-telegram` и `telegram-webhook` (см. §2.2), затем
   зарегистрировать webhook одним запросом:
   ```bash
   curl https://<PROJECT_REF>.supabase.co/functions/v1/telegram-webhook
   # {"ok":true,"result":true,"description":"Webhook was set"}
   ```
4. Написать боту `/start` (или любое сообщение) — он ответит приветствием
   с вашим chat ID, готовым для копирования (бот не может писать первым —
   это ограничение Telegram, поэтому начинать должны вы).
5. В приложении: ⚙ → Настройки → Получатели → добавить имя + chat ID →
   **Отправить тест** → должно прийти «✅ Тестовое уведомление».

Все попытки отправки видны в Настройки → История уведомлений
(sent / error / skipped с причиной).

## 4. Deploy на Vercel

1. [vercel.com/new](https://vercel.com/new) → Import репозитория
   (Vite определяется автоматически: build `npm run build`, output `dist`).
2. Environment Variables (Production + Preview):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Deploy. Telegram-секреты в Vercel **не добавлять** — они живут в Supabase.

Смоук после деплоя: регистрация → добавить клиента → перетащить карточку →
reload (данные на месте, футер: «Данные хранятся в Supabase») → Send test.

## 5. Команды

```bash
npm run dev        # dev-сервер
npm run build      # tsc + vite build → dist/
npm run preview    # локальный просмотр прод-сборки
```
