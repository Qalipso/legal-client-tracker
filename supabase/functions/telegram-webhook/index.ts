// Telegram bot inbound webhook — makes the bot actually respond to /start.
// Public endpoint (verify_jwt: false): Telegram cannot send a Supabase JWT.
// GET  -> registers this function as the bot's webhook (self-URL only, idempotent).
// POST -> handles an incoming Telegram Update.
//
// Two /start paths:
// 1. `/start connect_<token>` — the token-based connect flow (v0.8). The
//    frontend mints a short-lived, single-use token (telegram_connect_tokens,
//    migration 009) and opens t.me/<bot>?start=connect_<token>. This handler
//    verifies the token (exists, not used, not expired), creates the
//    notification_recipients row itself, and marks the token used — the
//    user never has to know or copy a chat_id.
// 2. Plain `/start` (or any other text) — the original fallback: reply with
//    the raw chat_id for manual entry. Kept for anyone who lands here
//    without a valid token (e.g. an expired/reused connect link).

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TOKEN = Deno.env.get("TG_BOT_TOKEN");

// Not a real access-control secret (Telegram has no auth story for the
// receiving end) — just filters out random internet POSTs to a public URL.
const WEBHOOK_SECRET = "lct-elly-webhook-2026";

const svcHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

async function sendMessage(chatId: number, text: string) {
  if (!TOKEN) return;
  await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

function welcomeText(chatId: number, firstName?: string): string {
  const greeting = firstName ? `Привет, ${firstName}!` : "Привет!";
  return [
    `${greeting} Я Элли — ассистентка Legal Client Tracker.`,
    "Буду присылать сюда уведомления: новый клиент, просроченный срок, смена статуса дела.",
    "",
    `Ваш chat ID: ${chatId}`,
    "Вставьте его в приложении: Настройки → Получатели → Добавить.",
    "",
    "Я не даю юридических советов и не пишу первой без повода — только слежу, чтобы важное не потерялось.",
  ].join("\n");
}

// Resolves a connect token to its owning user, atomically claiming it (the
// update's `used_at is null` filter means a raced/replayed request only
// succeeds once — PostgREST returns zero updated rows for the loser).
async function claimConnectToken(token: string): Promise<string | null> {
  const res = await fetch(
    `${SB_URL}/rest/v1/telegram_connect_tokens?token=eq.${token}&used_at=is.null&expires_at=gt.${new Date().toISOString()}`,
    {
      method: "PATCH",
      headers: { ...svcHeaders, Prefer: "return=representation" },
      body: JSON.stringify({ used_at: new Date().toISOString() }),
    },
  );
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) && rows[0] ? rows[0].user_id : null;
}

async function createRecipient(
  userId: string,
  chatId: number,
  displayName?: string,
): Promise<void> {
  await fetch(`${SB_URL}/rest/v1/notification_recipients`, {
    method: "POST",
    headers: svcHeaders,
    body: JSON.stringify({
      user_id: userId,
      name: displayName || "Telegram",
      channel: "telegram",
      destination: String(chatId),
      is_active: true,
    }),
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "GET") {
    if (!TOKEN) return json({ registered: false, reason: "TG_BOT_TOKEN not set" });
    const webhookUrl = `${SB_URL}/functions/v1/telegram-webhook`;
    const res = await fetch(`https://api.telegram.org/bot${TOKEN}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: webhookUrl, secret_token: WEBHOOK_SECRET }),
    });
    return json(await res.json(), res.ok ? 200 : 500);
  }

  if (req.method !== "POST") return json({ error: "GET or POST only" }, 405);

  const incomingSecret = req.headers.get("X-Telegram-Bot-Api-Secret-Token");
  if (incomingSecret !== WEBHOOK_SECRET) return json({ ok: false }, 401);

  const update = await req.json().catch(() => null);
  const message = update?.message;
  const chatId = message?.chat?.id;
  if (!chatId) return json({ ok: true }); // non-message update — nothing to do

  const text: string = message.text ?? "";
  const firstName: string | undefined = message.from?.first_name;
  const lastName: string | undefined = message.from?.last_name;

  const connectMatch = text.match(/^\/start\s+connect_([a-f0-9]+)/);
  if (connectMatch) {
    const userId = await claimConnectToken(connectMatch[1]);
    if (userId) {
      const displayName = [firstName, lastName].filter(Boolean).join(" ");
      await createRecipient(userId, chatId, displayName);
      await sendMessage(chatId, "✅ Уведомления Legal Client Tracker подключены.");
    } else {
      await sendMessage(
        chatId,
        "Ссылка для подключения устарела или уже использована. Сгенерируйте новую в Настройках → Получатели.",
      );
    }
    return json({ ok: true });
  }

  // Any other first contact gets the same reply: /start explicitly, or any
  // other text (bots can't message first, so whatever they send should
  // still surface the chat_id they came here for, as a manual fallback).
  await sendMessage(chatId, welcomeText(chatId, firstName));

  return json({ ok: true });
});
