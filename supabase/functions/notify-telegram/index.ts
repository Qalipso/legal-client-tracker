// Notification routing — Telegram + email (v8, per-user + internal/cron
// callers). Endpoint name/path kept as "notify-telegram" for stability (the
// frontend + pg_cron both call this URL); it now dispatches by recipient
// channel rather than only Telegram.
// - `recipient_id` in the body (v1.0): retries a single failed delivery —
//   fetches exactly that recipient (ownership-checked against the caller's
//   own userId, never someone else's), bypasses the enable-toggle checks
//   (the original attempt already passed them to become an "error" row —
//   re-checking would just risk silently downgrading a retry to a skip),
//   and dispatches to it alone rather than the full recipient list.
// - Telegram bot token lives ONLY in Supabase secrets (TG_BOT_TOKEN)
// - Email delivery uses the Resend API (RESEND_API_KEY + RESEND_FROM_EMAIL
//   edge function secrets, sender must be on a Resend-verified domain) —
//   live-verified against production, see CHANGELOG v0.6.1.
// - Email has an implicit default recipient: if the email channel is
//   enabled and no one explicitly added an email recipient, the account's
//   own profile email is used (see the fallback below). Telegram has no
//   equivalent default — there's no "obvious" chat ID to guess.
// - verify_jwt is OFF at the gateway: pg_cron's net.http_post can't send an
//   Authorization header, so this function does its OWN auth instead:
//   1. USER's JWT (Authorization header) — normal path, from the app UI.
//   2. internal_secret + explicit user_id in the body — used by the
//      task.overdue pg_cron scheduler, which has no user session and must
//      notify many users in one run. The secret lives in the DB
//      (internal_secrets table, service-role-only RLS), never in committed
//      source or CLI-set env — see supabase/migrations/007_overdue_scheduler.sql.
//   Every call is authenticated by one of these two paths before any work happens.
// - Recipients + event toggles come from the user's account settings
// - Every attempt is logged to notification_events
// If a channel is disabled/not configured or there are no recipients for it
// → {skipped:true} (or per-recipient "error" rows for a mixed batch).

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const svcHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

async function getUserId(req: Request): Promise<string | null> {
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const res = await fetch(`${SB_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const user = await res.json().catch(() => null);
  return user?.id ?? null;
}

async function select(path: string): Promise<any[]> {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: svcHeaders });
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) ? rows : [];
}

async function verifyInternalSecret(provided: string): Promise<boolean> {
  const rows = await select(
    `internal_secrets?key=eq.cron_shared_secret&select=value`,
  );
  const expected = rows[0]?.value;
  return Boolean(expected) && provided === expected;
}

async function logEvent(row: Record<string, unknown>): Promise<void> {
  await fetch(`${SB_URL}/rest/v1/notification_events`, {
    method: "POST",
    headers: svcHeaders,
    body: JSON.stringify(row),
  }).catch(() => {});
}

const EVENT_TOGGLES: Record<string, string> = {
  "client.created": "notify_on_client_created",
  "task.created": "notify_on_client_created", // MVP: same switch as new client
  "task.overdue": "notify_on_task_overdue",
  "status.changed": "notify_on_status_changed",
};

// human labels for skip reasons — mirrors SettingsPage's EVENT_LABELS so
// the UI never shows a raw event_type code like "status.changed"
const EVENT_LABELS: Record<string, string> = {
  "client.created": "Новый клиент",
  "task.created": "Новая задача",
  "task.overdue": "Просроченная задача",
  "status.changed": "Смена статуса",
  test: "Тест",
};

// Sends to one recipient over its own channel. Returns the outcome without
// logging — callers log, since the retry path and the batch-dispatch path
// want slightly different log rows (retry doesn't re-derive `payload` etc.).
async function sendToRecipient(
  r: { channel: string; destination: string },
  eventType: string,
  text: string,
  token: string | undefined,
  resendKey: string | undefined,
  resendFrom: string | undefined,
): Promise<{ ok: boolean; errorMsg: string | null }> {
  if (r.channel === "telegram") {
    if (!token) return { ok: false, errorMsg: "TG_BOT_TOKEN не задан в секретах Supabase" };
    const tg = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: r.destination, text }),
    }).catch(() => null);
    const tgBody = await tg?.json().catch(() => null);
    const ok = Boolean(tg?.ok && tgBody?.ok);
    return {
      ok,
      errorMsg: ok ? null : (tgBody?.description ?? `HTTP ${tg?.status ?? "network"}`),
    };
  }
  if (r.channel === "email") {
    if (!resendKey || !resendFrom) {
      return {
        ok: false,
        errorMsg: "RESEND_API_KEY / RESEND_FROM_EMAIL не заданы в секретах Supabase",
      };
    }
    const mail = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: resendFrom,
        to: r.destination,
        subject: EVENT_LABELS[eventType] ?? "Legal Client Tracker",
        text,
      }),
    }).catch(() => null);
    const mailBody = await mail?.json().catch(() => null);
    const ok = Boolean(mail?.ok);
    return {
      ok,
      errorMsg: ok ? null : (mailBody?.message ?? `HTTP ${mail?.status ?? "network"}`),
    };
  }
  return { ok: false, errorMsg: `неизвестный канал: ${r.channel}` };
}

function buildText(eventType: string, p: Record<string, unknown>): string {
  switch (eventType) {
    case "test":
      return "✅ Тестовое уведомление от Legal Client Tracker";
    case "client.created":
      return [
        "Новый клиент добавлен:",
        p.name,
        p.phone ? `Телефон: ${p.phone}` : null,
        p.status ? `Статус: ${p.status}` : null,
      ]
        .filter(Boolean)
        .join("\n");
    case "status.changed":
      return `Статус дела изменён:\n${p.name}\n${p.from} → ${p.to}`;
    case "task.created":
      return [
        "Новая задача:",
        `${p.title} — ${p.name}`,
        p.dueDate ? `Срок: ${p.dueDate}` : null,
      ]
        .filter(Boolean)
        .join("\n");
    case "task.overdue":
      return `⚠️ Просроченная задача:\n${p.title} — ${p.name}\nСрок: ${p.dueDate}`;
    default:
      return `Событие: ${eventType}`;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let body: {
    event_type?: string;
    payload?: Record<string, unknown>;
    internal_secret?: string;
    user_id?: string;
    recipient_id?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }
  const eventType = body.event_type ?? "test";
  const payload = body.payload ?? {};

  let userId: string | null = null;
  if (body.internal_secret && body.user_id) {
    const ok = await verifyInternalSecret(body.internal_secret);
    if (!ok) return json({ error: "unauthorized" }, 401);
    userId = body.user_id;
  } else {
    userId = await getUserId(req);
  }
  if (!userId) return json({ error: "unauthorized" }, 401);

  // Retry: resend to exactly one already-known recipient, regardless of
  // current toggle state (see header comment).
  if (body.recipient_id) {
    const rows = await select(
      `notification_recipients?id=eq.${body.recipient_id}&user_id=eq.${userId}&select=id,channel,destination`,
    );
    const recipient = rows[0];
    if (!recipient) return json({ error: "recipient not found" }, 404);

    const text = buildText(eventType, payload);
    const { ok, errorMsg } = await sendToRecipient(
      recipient,
      eventType,
      text,
      Deno.env.get("TG_BOT_TOKEN"),
      Deno.env.get("RESEND_API_KEY"),
      Deno.env.get("RESEND_FROM_EMAIL"),
    );
    await logEvent({
      user_id: userId,
      event_type: eventType,
      recipient_id: recipient.id,
      channel: recipient.channel,
      status: ok ? "sent" : "error",
      error: ok ? null : errorMsg,
      payload,
      sent_at: ok ? new Date().toISOString() : null,
    });
    return json({ sent: ok, delivered: ok ? 1 : 0, failed: ok ? 0 : 1, errors: errorMsg ? [errorMsg] : [] });
  }

  const skip = async (reason: string) => {
    await logEvent({
      user_id: userId,
      event_type: eventType,
      channel: "telegram",
      status: "skipped",
      error: reason,
      payload,
    });
    return json({ skipped: true, reason });
  };

  // user's notification settings
  const settingsRows = await select(
    `account_settings?user_id=eq.${userId}&select=*`,
  );
  const settings = settingsRows[0] ?? {};
  const toggleColumn = EVENT_TOGGLES[eventType];
  if (toggleColumn && settings[toggleColumn] === false) {
    const label = EVENT_LABELS[eventType] ?? eventType;
    return skip(`событие «${label}» выключено в настройках`);
  }

  // "test" bypasses the enable toggles (same as before) so a user can
  // verify a recipient works even before flipping the channel on.
  const channelsEnabled: string[] =
    eventType === "test"
      ? ["telegram", "email"]
      : [
          ...(settings.telegram_enabled !== false ? ["telegram"] : []),
          ...(settings.email_enabled === true ? ["email"] : []),
        ];
  if (channelsEnabled.length === 0) {
    return skip("все каналы уведомлений выключены в настройках");
  }

  const recipients = await select(
    `notification_recipients?user_id=eq.${userId}&is_active=eq.true&channel=in.(${channelsEnabled.join(",")})&select=id,channel,destination`,
  );

  // Email has an obvious default the user already gave us — their own
  // account email — unlike Telegram, which has no equivalent. If email is
  // enabled and no explicit email recipient exists yet, notify the account
  // owner directly instead of silently doing nothing.
  if (channelsEnabled.includes("email")) {
    const hasExplicitEmail = recipients.some(
      (r) => r.channel === "email",
    );
    if (!hasExplicitEmail) {
      const profileRows = await select(
        `profiles?id=eq.${userId}&select=email`,
      );
      const ownEmail = profileRows[0]?.email;
      if (ownEmail) {
        recipients.push({ id: null, channel: "email", destination: ownEmail });
      }
    }
  }

  if (recipients.length === 0) {
    return skip("нет активных получателей для включённых каналов");
  }

  const text = buildText(eventType, payload);
  const token = Deno.env.get("TG_BOT_TOKEN");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const resendFrom = Deno.env.get("RESEND_FROM_EMAIL");

  let delivered = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const r of recipients) {
    const { ok, errorMsg } = await sendToRecipient(
      r,
      eventType,
      text,
      token,
      resendKey,
      resendFrom,
    );

    if (ok) delivered++;
    else {
      failed++;
      if (errorMsg) errors.push(errorMsg);
    }
    await logEvent({
      user_id: userId,
      event_type: eventType,
      recipient_id: r.id,
      channel: r.channel,
      status: ok ? "sent" : "error",
      error: ok ? null : errorMsg,
      payload,
      sent_at: ok ? new Date().toISOString() : null,
    });
  }

  return json({ sent: delivered > 0, delivered, failed, errors });
});
