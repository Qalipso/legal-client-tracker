// Telegram notification on new client.
// The bot token lives ONLY here (Supabase secrets), never in the frontend.
// The recipient chat ID is configured from the app UI (settings table);
// TG_CHAT_ID env works as a fallback.
// Configure the bot: supabase secrets set TG_BOT_TOKEN=...

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

async function loadSettings(): Promise<{
  chatId: string | null;
  enabled: boolean;
}> {
  // SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (url && key) {
    try {
      const res = await fetch(
        `${url}/rest/v1/settings?id=eq.1&select=telegram_chat_id,notify_on_new_client`,
        { headers: { apikey: key, Authorization: `Bearer ${key}` } },
      );
      const rows = await res.json();
      if (Array.isArray(rows) && rows[0]) {
        return {
          chatId: rows[0].telegram_chat_id ?? null,
          enabled: rows[0].notify_on_new_client ?? true,
        };
      }
    } catch {
      // fall through to env fallback
    }
  }
  return { chatId: null, enabled: true };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let payload: {
    name?: string;
    phone?: string;
    status?: string;
    test?: boolean;
  };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }
  if (!payload.name) return json({ error: "name is required" }, 400);

  const settings = await loadSettings();
  const chatId = settings.chatId || Deno.env.get("TG_CHAT_ID") || null;
  const token = Deno.env.get("TG_BOT_TOKEN");

  // an explicit test from the settings panel ignores the enabled toggle
  if (!payload.test && !settings.enabled) {
    return json({ sent: false, reason: "уведомления выключены в настройках" });
  }
  if (!token) {
    return json({ sent: false, reason: "TG_BOT_TOKEN не задан в секретах Supabase" });
  }
  if (!chatId) {
    return json({ sent: false, reason: "chat ID получателя не задан в настройках" });
  }

  const text = payload.test
    ? "✅ Тестовое уведомление от Legal Client Tracker"
    : [
        "Новый клиент добавлен:",
        payload.name,
        payload.phone ? `Телефон: ${payload.phone}` : null,
        payload.status ? `Статус: ${payload.status}` : null,
      ]
        .filter(Boolean)
        .join("\n");

  const tg = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  const tgBody = await tg.json().catch(() => null);

  return json({
    sent: tg.ok && tgBody?.ok === true,
    status: tg.status,
    description: tgBody?.description,
  });
});
