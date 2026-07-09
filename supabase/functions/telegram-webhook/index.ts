// Telegram bot inbound webhook — makes the bot actually respond to /start.
// Public endpoint (verify_jwt: false): Telegram cannot send a Supabase JWT.
// GET  -> registers this function as the bot's webhook (self-URL only, idempotent).
// POST -> handles an incoming Telegram Update.
//
// Two /start paths:
// 1. `/start connect_<token>` — the token-based connect flow (v0.8, hashed
//    at rest since v0.8.1). The frontend calls create_telegram_connect_token()
//    (migration 010), which mints a short-lived, single-use token and
//    persists only its SHA-256 hash — the plaintext exists nowhere but this
//    one response. The frontend opens t.me/<bot>?start=connect_<token>; this
//    handler hashes the incoming token the same way, verifies it (exists,
//    not used, not expired) by hash, creates the notification_recipients row
//    itself, and marks the token used — the user never has to know or copy
//    a chat_id, and the DB never stores anything replayable.
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

// SHA-256 hex digest — must match Postgres's
// encode(digest(raw_token, 'sha256'), 'hex') exactly (lowercase hex),
// since the token is looked up by hash, never by plaintext (migration 010).
async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Resolves a connect token to its owning user, atomically claiming it (the
// update's `used_at is null` filter means a raced/replayed request only
// succeeds once — PostgREST returns zero updated rows for the loser).
async function claimConnectToken(rawToken: string): Promise<string | null> {
  const tokenHash = await sha256Hex(rawToken);
  const res = await fetch(
    `${SB_URL}/rest/v1/telegram_connect_tokens?token_hash=eq.${tokenHash}&used_at=is.null&expires_at=gt.${new Date().toISOString()}`,
    {
      method: "PATCH",
      headers: { ...svcHeaders, Prefer: "return=representation" },
      body: JSON.stringify({ used_at: new Date().toISOString() }),
    },
  );
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) && rows[0] ? rows[0].user_id : null;
}

// Upserts on (user_id, channel, destination) — migration 011. Without this,
// reconnecting an already-connected chat (e.g. tapping an old connect link
// again) created a second row for the same chat_id, and that chat would
// get every notification twice. Found via real end-to-end testing, not a
// hypothetical.
async function createRecipient(
  userId: string,
  chatId: number,
  displayName?: string,
): Promise<void> {
  await fetch(
    `${SB_URL}/rest/v1/notification_recipients?on_conflict=user_id,channel,destination`,
    {
      method: "POST",
      headers: {
        ...svcHeaders,
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        user_id: userId,
        name: displayName || "Telegram",
        channel: "telegram",
        destination: String(chatId),
        is_active: true,
      }),
    },
  );
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
