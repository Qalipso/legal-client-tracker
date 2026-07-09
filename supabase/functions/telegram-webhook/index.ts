// Telegram bot inbound webhook — makes the bot actually respond to /start.
// Public endpoint (verify_jwt: false): Telegram cannot send a Supabase JWT.
// GET  -> registers this function as the bot's webhook (self-URL only, idempotent).
// POST -> handles an incoming Telegram Update.
//
// Why this exists: users had no way to discover their own chat_id without a
// third-party bot (@userinfobot). Now messaging Elly directly returns it,
// ready to paste into Настройки → Получатели.

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const TOKEN = Deno.env.get("TG_BOT_TOKEN");

// Not a real access-control secret (Telegram has no auth story for the
// receiving end) — just filters out random internet POSTs to a public URL.
const WEBHOOK_SECRET = "lct-elly-webhook-2026";

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

  // Any first contact gets the same reply: /start explicitly, or any other
  // text (bots can't message first, so whatever they send should still
  // surface the chat_id they came here for).
  await sendMessage(chatId, welcomeText(chatId, firstName));

  return json({ ok: true });
});
