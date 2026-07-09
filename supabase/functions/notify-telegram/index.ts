// Telegram notification routing (v5, per-user + internal/cron callers).
// - Bot token lives ONLY in Supabase secrets (TG_BOT_TOKEN)
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
// If Telegram is not configured or there are no recipients → {skipped:true}.

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
  if (settings.telegram_enabled === false && eventType !== "test") {
    return skip("Telegram-уведомления выключены в настройках");
  }
  const toggleColumn = EVENT_TOGGLES[eventType];
  if (toggleColumn && settings[toggleColumn] === false) {
    const label = EVENT_LABELS[eventType] ?? eventType;
    return skip(`событие «${label}» выключено в настройках`);
  }

  const token = Deno.env.get("TG_BOT_TOKEN");
  if (!token) return skip("TG_BOT_TOKEN не задан в секретах Supabase");

  const recipients = await select(
    `notification_recipients?user_id=eq.${userId}&is_active=eq.true&channel=eq.telegram&select=id,destination`,
  );
  if (recipients.length === 0) {
    return skip("нет активных получателей — добавьте chat ID в настройках");
  }

  const text = buildText(eventType, payload);
  let delivered = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const r of recipients) {
    const tg = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: r.destination, text }),
    }).catch(() => null);
    const tgBody = await tg?.json().catch(() => null);
    const ok = Boolean(tg?.ok && tgBody?.ok);
    if (ok) delivered++;
    else {
      failed++;
      errors.push(tgBody?.description ?? `HTTP ${tg?.status ?? "network"}`);
    }
    await logEvent({
      user_id: userId,
      event_type: eventType,
      recipient_id: r.id,
      channel: "telegram",
      status: ok ? "sent" : "error",
      error: ok ? null : (tgBody?.description ?? `HTTP ${tg?.status ?? "network"}`),
      payload,
      sent_at: ok ? new Date().toISOString() : null,
    });
  }

  return json({ sent: delivered > 0, delivered, failed, errors });
});
